const jwt = require('jsonwebtoken');
const { supabase } = require('../database');
const { getSubscriptionState } = require('../utils/subscription');

// Domaines métier fermés quand le verrou tombe (expiration + délai de grâce
// écoulé) : plus aucune lecture, pas seulement plus d'écriture. Sans cette
// liste, le verrou de l'interface serait cosmétique — l'API continuerait de
// rendre tous les dossiers à qui les demande.
const LOCKED_API_PREFIXES = [
  '/api/patients',
  '/api/appointments',
  '/api/consultations',
  '/api/pharmacy',
  '/api/laboratory',
  '/api/deposits',
  '/api/financials'
];

// Testées AVANT la liste ci-dessus : /api/financials/subscription est le tunnel
// de paiement, la seule porte de sortie du verrou, et il vit sous le préfixe
// /api/financials. Inverser l'ordre enfermerait la clinique dehors.
const LOCK_EXEMPT_PREFIXES = [
  '/api/financials/subscription',
  '/api/auth',
  '/api/settings',
  '/api/notifications',
  '/api/platform'
];

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "⚠️  JWT_SECRET manquant. En local, renseignez backend/.env. " +
    "Sur Vercel, ajoutez cette variable dans Project Settings > Environment Variables."
  );
}

// General auth middleware
async function auth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Accès refusé. Token non fourni ou invalide." });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Deux lectures indépendantes, en parallèle : la clinique (abonnement,
    // suspension) et le compte lui-même.
    const [
      { data: clinic, error: clinicError },
      { data: account, error: accountError }
    ] = await Promise.all([
      supabase
        .from('clinics')
        .select('subscription_status, subscription_expires_at, suspended_by_platform')
        .eq('id', decoded.clinicId)
        .maybeSingle(),
      supabase
        .from('users')
        .select('id, active')
        .eq('id', decoded.userId)
        .eq('clinic_id', decoded.clinicId)
        .maybeSingle()
    ]);

    if (clinicError) {
      console.error("Auth Middleware Clinic Error:", clinicError);
    }

    // Le JWT vit 24 h et rien ne le révoque : sans cette relecture, désactiver
    // un compte (PUT /settings/users/:id ou PUT /api/platform/users/:id) ne
    // produisait aucun effet avant l'expiration du jeton — le collaborateur
    // renvoyé gardait lecture ET écriture pendant une journée entière. Une
    // erreur de lecture (base injoignable) ne déconnecte personne : seul un
    // `active` explicitement à 0, ou un compte disparu, ferme la porte.
    if (accountError) {
      console.error("Auth Middleware Account Error:", accountError);
    } else if (!account) {
      return res.status(401).json({ error: "Compte introuvable. Veuillez vous reconnecter." });
    } else if (Number(account.active) !== 1) {
      return res.status(401).json({
        error: "Ce compte a été désactivé. Contactez l'administrateur de votre clinique.",
        code: "ACCOUNT_DEACTIVATED"
      });
    }

    if (clinic) {
      req.clinicStatus = clinic.subscription_status;
      req.clinicExpiresAt = clinic.subscription_expires_at;

      // If subscription is expired and user is trying to perform a write operation
      // Allow only settings/billing update or GET requests.
      const isReadRequest = req.method === 'GET';
      // Route checks below must match against the PATH only, never the raw
      // originalUrl (which includes the query string). req.originalUrl.includes()
      // on the full URL let any caller bypass every gate below by appending an
      // arbitrary query string, e.g. POST /api/patients?x=/platform — a real,
      // exploitable bug caught in code review before this shipped.
      const requestPath = req.originalUrl.split('?')[0];
      // Exact-segment match (not substring) — 'includes' would also match an
      // unrelated future route sharing the same prefix, e.g. /settings/planning.
      const pathIs = (base) => requestPath === base || requestPath.startsWith(base + '/');
      // A clinic that's actually expired must still be able to reach the renewal
      // endpoint itself — otherwise paying to unlock is blocked by the very
      // gate it's supposed to lift. (/settings/subscription never existed as a
      // real route; this previously meant expired clinics had NO way to renew.)
      const isBillingRoute =
        pathIs('/api/financials/subscription') ||
        pathIs('/api/settings/plan') ||
        pathIs('/api/auth/logout');
      // A Super Admin's OWN clinic being expired or suspended must never lock
      // them out of the Platform Admin console — that's the one place able to
      // lift a suspension in the first place. Safe to exempt broadly: every
      // /api/platform route is already gated by superAdminOnly (email
      // allowlist), so this doesn't open anything to a caller who couldn't
      // already reach it.
      const isPlatformRoute = pathIs('/api/platform');
      // Notifications (marking read/read-all) must keep working even for a
      // suspended/expired clinic — per the design spec, a suspended or
      // expired clinic's users still see and read notifications normally.
      // Safe to exempt: these POST routes only ever write the caller's OWN
      // row in notification_reads keyed by req.user.userId, no clinic data
      // is read or written there.
      const isNotificationsRoute = pathIs('/api/notifications');

      const subscription = getSubscriptionState(clinic);
      const isExpired = subscription.expired;
      const isSuspended = clinic.suspended_by_platform === true;
      req.subscriptionState = subscription;

      // Suspension is a platform decision, not a billing state — unlike
      // SUBSCRIPTION_EXPIRED there is deliberately no billing-route bypass:
      // paying does not lift a suspension, only a Super Admin reversing the
      // toggle does. Checked first so its message wins if both are true.
      if (isSuspended && !isReadRequest && !isPlatformRoute && !isNotificationsRoute) {
        return res.status(403).json({
          error: "Compte suspendu",
          code: "ACCOUNT_SUSPENDED",
          message: "Ce compte a été suspendu par l'administrateur de la plateforme. Contactez le support pour plus d'informations."
        });
      }

      // Verrou dur : l'abonnement est expiré depuis plus que le délai de grâce.
      // Contrairement au blocage d'écriture ci-dessous, il ferme AUSSI les
      // lectures des domaines métier — c'est ce qui rend l'application
      // réellement inutilisable et pousse au paiement. Les exemptions passent
      // en premier ; `pathIs` compare par segment, donc
      // /api/financials/subscription/checkout est exempté sans exempter un
      // hypothétique /api/financials-autre-chose.
      //
      // Placé APRÈS le bloc de suspension : une clinique à la fois suspendue et
      // expirée doit lire « contactez le support », pas « payez » — payer ne
      // lève pas une suspension. D'où aussi le code renvoyé ci-dessous quand
      // les deux sont vrais sur une simple lecture, que le bloc suspension
      // laisse passer.
      if (subscription.locked) {
        const isExempt = LOCK_EXEMPT_PREFIXES.some(pathIs);
        if (!isExempt && LOCKED_API_PREFIXES.some(pathIs)) {
          if (isSuspended) {
            return res.status(403).json({
              error: "Compte suspendu",
              code: "ACCOUNT_SUSPENDED",
              message: "Ce compte a été suspendu par l'administrateur de la plateforme. Contactez le support pour plus d'informations."
            });
          }
          return res.status(403).json({
            error: "Abonnement MediClinic expiré",
            code: "SUBSCRIPTION_LOCKED",
            message: "Votre abonnement a expiré. Choisissez un plan depuis Paramètres → Abonnez-vous pour réactiver votre clinique.",
            graceEndsAt: subscription.graceEndsAt
          });
        }
      }

      if (isExpired && !isReadRequest && !isBillingRoute && !isPlatformRoute && !isNotificationsRoute) {
        return res.status(403).json({
          error: "Abonnement MediClinic expiré",
          code: "SUBSCRIPTION_EXPIRED",
          // Ni prix ni moyen de paiement en dur ici : ce message annonçait
          // « 15 000 FCFA/mois », un tarif qui n'existe dans aucun plan
          // (Clinique 9 000, Hôpital 14 500 — voir utils/plans.js, seule
          // source de vérité), et un moyen de paiement qui change.
          message: "Veuillez renouveler votre abonnement depuis Paramètres → Abonnez-vous pour réactiver l'écriture des données."
        });
      }
    }

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(401).json({ error: "Token invalide ou expiré." });
  }
}

// Role authorization middleware
function checkRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Non authentifié." });
    }

    const hasRole = roles.includes(req.user.role) || req.user.role === 'admin';
    if (!hasRole) {
      return res.status(403).json({ error: "Accès refusé. Permissions insuffisantes." });
    }

    next();
  };
}

module.exports = {
  auth,
  checkRole,
  JWT_SECRET
};
