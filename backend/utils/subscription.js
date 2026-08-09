// Shared "is this clinic's subscription expired" check — used by
// middleware/auth.js (write-gating enforcement) and routes/platform.js
// (Cliniques/Abonnements tab display). Keeping this in one place means the
// two can't drift the way they did before this file existed.
function isClinicExpired(clinic, now = new Date()) {
  if (!clinic) return false;
  const expiresAt = clinic.subscription_expires_at ? new Date(clinic.subscription_expires_at) : null;
  return clinic.subscription_status === 'expired' || (expiresAt !== null && expiresAt < now);
}

// Délai de grâce entre l'expiration et le verrouillage effectif de
// l'application. Pendant ces trois jours l'abonnement est déjà expiré — plus
// aucune écriture n'est acceptée — mais la clinique garde la lecture de ses
// dossiers. Sans ce délai, la coupure tomberait à la seconde près : un cabinet
// qui règle son abonnement le lendemain perdrait l'accès à ses dossiers
// médicaux toute une matinée, sans autre préavis que l'email de rappel.
const GRACE_PERIOD_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// État d'abonnement complet, calculé UNE fois côté serveur et transmis tel quel
// au client par GET /auth/me. Le frontend ne recalcule rien : il affichait
// jusqu'ici des jours restants avec Math.ceil pendant que le serveur comparait
// des instants, et les deux pouvaient se contredire d'une journée entière.
//
//   expired       : la date est passée (ou le statut vaut 'expired')
//   locked        : expiré ET délai de grâce écoulé → l'application se ferme
//   graceEndsAt   : instant où le verrou tombe
//   graceDaysLeft : jours entiers restants avant le verrou (0 quand il tombe
//                   aujourd'hui), null si l'abonnement n'est pas expiré
function getSubscriptionState(clinic, now = new Date()) {
  const expiresAtRaw = clinic && clinic.subscription_expires_at ? clinic.subscription_expires_at : null;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const expired = isClinicExpired(clinic, now);

  if (!expired) {
    return {
      expired: false,
      locked: false,
      expiresAt: expiresAtRaw,
      graceEndsAt: null,
      graceDaysLeft: null
    };
  }

  // Un statut 'expired' posé à la main sans date d'expiration n'offre aucun
  // point de départ à la grâce : le verrou s'applique tout de suite.
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return {
      expired: true,
      locked: true,
      expiresAt: expiresAtRaw,
      graceEndsAt: null,
      graceDaysLeft: 0
    };
  }

  const graceEnds = new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * DAY_MS);
  const locked = now >= graceEnds;

  return {
    expired: true,
    locked,
    expiresAt: expiresAtRaw,
    graceEndsAt: graceEnds.toISOString(),
    graceDaysLeft: locked ? 0 : Math.max(0, Math.ceil((graceEnds.getTime() - now.getTime()) / DAY_MS))
  };
}

// Vrai quand l'application doit se fermer sur cette clinique.
function isClinicLocked(clinic, now = new Date()) {
  return getSubscriptionState(clinic, now).locked;
}

module.exports = { isClinicExpired, isClinicLocked, getSubscriptionState, GRACE_PERIOD_DAYS };
