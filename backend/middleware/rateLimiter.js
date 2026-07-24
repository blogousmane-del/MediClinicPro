const rateLimit = require('express-rate-limit');
const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const RATE_LIMIT_MESSAGE = "Trop de requêtes de connexion depuis cette IP, veuillez réessayer après 15 minutes.";

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || '';
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || '';

let authLimiter;

if (upstashUrl && upstashToken) {
  // Upstash's REST-based Redis is shared across all serverless instances, unlike
  // express-rate-limit's default in-memory store which resets on every cold start
  // and isn't shared between concurrent Vercel function instances.
  const redis = new Redis({ url: upstashUrl, token: upstashToken });
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '15 m'),
    prefix: 'mediclinic:auth'
  });

  authLimiter = async (req, res, next) => {
    try {
      const { success, limit, remaining, reset } = await ratelimit.limit(req.ip);
      res.setHeader('RateLimit-Limit', limit);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', reset);

      if (!success) {
        return res.status(429).json({ error: RATE_LIMIT_MESSAGE });
      }
      next();
    } catch (error) {
      console.error('[RateLimit] Erreur Upstash, requête autorisée par sécurité:', error);
      next();
    }
  };
} else {
  console.warn('[RateLimit] UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN non définis - repli sur la limitation en mémoire (non partagée entre instances serverless).');
  authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: RATE_LIMIT_MESSAGE },
    standardHeaders: true,
    legacyHeaders: false
  });
}

module.exports = { authLimiter };
