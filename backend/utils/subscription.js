// Shared "is this clinic's subscription expired" check — used by
// middleware/auth.js (write-gating enforcement) and routes/platform.js
// (Cliniques/Abonnements tab display). Keeping this in one place means the
// two can't drift the way they did before this file existed.
function isClinicExpired(clinic, now = new Date()) {
  if (!clinic) return false;
  const expiresAt = clinic.subscription_expires_at ? new Date(clinic.subscription_expires_at) : null;
  return clinic.subscription_status === 'expired' || (expiresAt !== null && expiresAt < now);
}

module.exports = { isClinicExpired };
