// Central multi-tier subscription plan config. clinics.plan (TEXT, one of the
// keys below) drives feature gating everywhere: staff limits, role
// restrictions, and which payment methods a clinic may collect from patients.
// Real pricing/limits confirmed by the business owner (not placeholder data).
const PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 0,
    trialDays: 7, // auto-blocked after 7 days, matches existing subscription_expires_at gating in middleware/auth.js
    staffLimit: 3,
    allowedRoles: ['admin', 'doctor', 'secretary'],
    paymentMethods: ['cash'],
    tagline: 'Pour démarrer, gratuitement',
    features: [
      'Jusqu\'à 3 collaborateurs (Admin, Médecin, Secrétaire)',
      'Patients & Dossiers illimités',
      'Rendez-vous, Ordonnances & Pharmacie',
      'Laboratoire & Comptabilité',
      'Encaissements en espèces uniquement',
      '7 jours d\'utilisation, puis compte bloqué automatiquement'
    ]
  },
  clinique: {
    id: 'clinique',
    name: 'Clinique',
    price: 9000,
    trialDays: null,
    staffLimit: 5,
    allowedRoles: null, // null = tous les rôles autorisés
    paymentMethods: ['cash'],
    tagline: 'Pour les cliniques en croissance',
    features: [
      'Jusqu\'à 5 collaborateurs, tous rôles',
      'Patients & Dossiers illimités',
      'Rendez-vous, Ordonnances & Pharmacie',
      'Laboratoire & Comptabilité',
      'Encaissements en espèces uniquement'
    ]
  },
  hopital: {
    id: 'hopital',
    name: 'Hôpital',
    price: 14500,
    trialDays: null,
    staffLimit: null, // illimité
    allowedRoles: null,
    paymentMethods: ['cash', 'wave', 'orange_money', 'mtn_momo'],
    tagline: 'La solution complète, sans limites',
    features: [
      'Utilisateurs & rôles illimités',
      'Patients & Dossiers illimités',
      'Rendez-vous, Ordonnances & Pharmacie',
      'Laboratoire & Comptabilité',
      'Encaissements Mobile Money (Wave, Orange Money, MTN)'
    ]
  }
};

const PLAN_IDS = Object.keys(PLANS);

function getPlan(planId) {
  return PLANS[planId] || PLANS.hopital; // unknown/legacy clinics degrade to the most permissive plan, never lock anyone out silently
}

function isRoleAllowedForPlan(planId, role) {
  const plan = getPlan(planId);
  if (!plan.allowedRoles) return true;
  return plan.allowedRoles.includes(role);
}

function isStaffLimitReached(planId, currentActiveStaffCount, unlimitedOverride = false) {
  if (unlimitedOverride) return false;
  const plan = getPlan(planId);
  if (plan.staffLimit === null || plan.staffLimit === undefined) return false;
  return currentActiveStaffCount >= plan.staffLimit;
}

function isPaymentMethodAllowed(planId, method) {
  const plan = getPlan(planId);
  return plan.paymentMethods.includes(method);
}

module.exports = {
  PLANS,
  PLAN_IDS,
  getPlan,
  isRoleAllowedForPlan,
  isStaffLimitReached,
  isPaymentMethodAllowed
};
