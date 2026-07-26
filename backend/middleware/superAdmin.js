const { supabase } = require('../database');

const SUPER_ADMIN_EMAILS = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

// Gates the cross-clinic platform dashboard. Runs after the normal `auth`
// middleware — checks the caller's own email against an allowlist, since the
// JWT payload doesn't carry email and there is no cross-clinic role concept
// in the `users` table (role is always scoped to one clinic).
async function superAdminOnly(req, res, next) {
  if (SUPER_ADMIN_EMAILS.length === 0) {
    return res.status(403).json({ error: "Tableau de bord plateforme non configuré." });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('email')
    .eq('id', req.user.userId)
    .maybeSingle();

  if (error || !user || !SUPER_ADMIN_EMAILS.includes(user.email)) {
    return res.status(403).json({ error: "Accès refusé." });
  }

  next();
}

module.exports = { superAdminOnly, SUPER_ADMIN_EMAILS };
