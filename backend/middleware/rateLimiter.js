const rateLimit = require('express-rate-limit');
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const RATE_LIMIT_MESSAGE = "Trop de requêtes de connexion depuis cette IP, veuillez réessayer après 15 minutes.";
// Message distinct du précédent : ici ce n'est pas l'IP qui est bridée mais le
// compte visé. Le dire évite qu'un utilisateur légitime derrière la même IP que
// l'attaquant croie être lui-même bloqué.
const ACCOUNT_LIMIT_MESSAGE = "Trop de tentatives de connexion sur ce compte, veuillez réessayer après 15 minutes.";

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const useUpstash = Boolean(upstashUrl && upstashToken);

const redis = useUpstash ? new Redis({ url: upstashUrl, token: upstashToken }) : null;

if (!useUpstash) {
  console.warn('[RateLimit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN non définis - repli sur la limitation en mémoire (non partagée entre instances serverless).');
}

// Fabrique un limiteur : Upstash Redis quand il est configuré (compteur partagé
// entre toutes les instances serverless, seule façon d'avoir un sens sur
// Vercel), repli express-rate-limit en mémoire sinon (par instance, remis à
// zéro à chaque démarrage à froid).
//
// `keyOf(req)` renvoie la valeur comptée : l'IP, ou l'email visé. Renvoyer une
// valeur vide désactive le limiteur pour cette requête — le cas d'un POST
// /login sans email, que le gestionnaire de route rejettera de toute façon.
function createLimiter({ prefix, limit, windowLabel, windowMs, message, keyOf, upstashKeyOf }) {
  if (useUpstash) {
    keyOf = keyOf || upstashKeyOf;
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, windowLabel),
      prefix
    });

    return async (req, res, next) => {
      try {
        const key = keyOf(req);
        if (!key) return next();

        const result = await ratelimit.limit(key);
        res.setHeader('RateLimit-Limit', result.limit);
        res.setHeader('RateLimit-Remaining', result.remaining);
        res.setHeader('RateLimit-Reset', result.reset);

        if (!result.success) {
          return res.status(429).json({ error: message });
        }
        next();
      } catch (error) {
        // Ouvert en cas de panne, délibérément : une clinique doit pouvoir
        // soigner même si Upstash est injoignable. La contrepartie est que la
        // limitation disparaît le temps de la panne.
        console.error('[RateLimit] Erreur Upstash, requête autorisée par sécurité:', error);
        next();
      }
    };
  }

  return rateLimit({
    windowMs,
    max: limit,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    // Sans `keyOf`, on laisse express-rate-limit compter par IP lui-même : sa
    // clé par défaut normalise déjà les adresses IPv6, ce qu'un `req => req.ip`
    // écrit à la main ne fait pas.
    ...(keyOf
      ? { keyGenerator: (req) => keyOf(req) || 'anonyme', skip: (req) => !keyOf(req) }
      : {})
  });
}

const WINDOW_MS = 15 * 60 * 1000;

// Limite par IP, inchangée, sur /login, /register et /google.
const authLimiter = createLimiter({
  prefix: 'mediclinic:auth',
  limit: 100,
  windowLabel: '15 m',
  windowMs: WINDOW_MS,
  message: RATE_LIMIT_MESSAGE,
  // Upstash n'a pas de clé par défaut : il lui faut l'IP explicitement. Le
  // repli express-rate-limit, lui, garde la sienne (voir createLimiter).
  upstashKeyOf: (req) => req.ip
});

// Limite par compte visé, sur /login seulement. La limite par IP ne protège
// pas d'une attaque par force brute distribuée (100 essais par IP et par
// quart d'heure, autant d'IP que l'attaquant en loue), et la durcir punirait
// une clinique entière derrière une seule IP partagée. Compter par email vise
// exactement ce qui est attaqué. L'email est normalisé comme dans
// routes/auth.js, sinon « Admin@… » et « admin@… » useraient deux compteurs
// distincts pour le même compte.
const loginAccountLimiter = createLimiter({
  prefix: 'mediclinic:login-account',
  limit: 10,
  windowLabel: '15 m',
  windowMs: WINDOW_MS,
  message: ACCOUNT_LIMIT_MESSAGE,
  keyOf: (req) => String((req.body && req.body.email) || '').trim().toLowerCase()
});

module.exports = { authLimiter, loginAccountLimiter };
