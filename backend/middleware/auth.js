const jwt = require('jsonwebtoken');
const { supabase } = require('../database');

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

    // Check clinic subscription status
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('subscription_status, subscription_expires_at')
      .eq('id', decoded.clinicId)
      .maybeSingle();

    if (clinicError) {
      console.error("Auth Middleware Clinic Error:", clinicError);
    }

    if (clinic) {
      req.clinicStatus = clinic.subscription_status;
      req.clinicExpiresAt = clinic.subscription_expires_at;

      // If subscription is expired and user is trying to perform a write operation
      // Allow only settings/billing update or GET requests.
      const isReadRequest = req.method === 'GET';
      const isBillingRoute = req.originalUrl.includes('/settings/subscription') || req.originalUrl.includes('/auth/logout');

      const now = new Date();
      const expiresAt = clinic.subscription_expires_at ? new Date(clinic.subscription_expires_at) : null;
      const isExpired = clinic.subscription_status === 'expired' || (expiresAt && expiresAt < now);

      if (isExpired && !isReadRequest && !isBillingRoute) {
        return res.status(403).json({
          error: "Abonnement MediClinic expiré",
          code: "SUBSCRIPTION_EXPIRED",
          message: "Veuillez renouveler votre abonnement de 15 000 FCFA/mois via Mobile Money pour réactiver l'écriture des données."
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
