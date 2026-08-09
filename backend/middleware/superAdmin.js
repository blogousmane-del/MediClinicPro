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

  // `active` fait partie du filtre : un compte Super Admin désactivé ne doit
  // pas conserver l'accès à la console au seul motif que son email figure dans
  // l'allowlist.
  const { data: user, error } = await supabase
    .from('users')
    .select('email, active')
    .eq('id', req.user.userId)
    .eq('active', 1)
    .maybeSingle();

  if (error || !user || !SUPER_ADMIN_EMAILS.includes(user.email)) {
    return res.status(403).json({ error: "Accès refusé." });
  }

  next();
}

module.exports = { superAdminOnly, SUPER_ADMIN_EMAILS };
