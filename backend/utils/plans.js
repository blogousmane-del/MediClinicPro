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
    // « Encaissements Mobile Money » a été retiré de cette liste : cet argument
    // décrivait ce que la clinique encaisse auprès de ses patients, capacité
    // supprimée par le passage à Chariow (voir
    // docs/superpowers/specs/2026-08-08-chariow-integration-design.md).
    // paymentMethods ci-dessus n'est volontairement pas encore modifié — le
    // retrait fonctionnel est une tâche distincte ; seule la promesse
    // commerciale disparaît, en avance, pour ne rien vendre qui va cesser
    // d'exister.
    features: [
      'Utilisateurs & rôles illimités',
      'Patients & Dossiers illimités',
      'Rendez-vous, Ordonnances & Pharmacie',
      'Laboratoire & Comptabilité'
    ]
  }
};

const PLAN_IDS = Object.keys(PLANS);

// Liste canonique des rôles, alignée sur frontend/src/contexts/AuthContext.tsx.
// La colonne users.role est du texte libre (aucun ENUM ni CHECK côté base) et
// isRoleAllowedForPlan() renvoie `true` pour n'importe quelle chaîne dès que le
// plan n'a pas de restriction (clinique, hôpital) : sans ce garde-fou, un
// administrateur pouvait créer un collaborateur avec le rôle « directeur » ou
// « Admin ». Aucune escalade de privilèges — checkRole() compare à des listes
// fermées, donc un rôle inconnu n'ouvre rien — mais le compte devient
// inutilisable et l'interface affiche un rôle qu'elle ne sait pas filtrer.
const VALID_ROLES = ['admin', 'doctor', 'secretary', 'pharmacist', 'lab_tech', 'manager', 'nurse'];

function isKnownRole(role) {
  return VALID_ROLES.includes(role);
}

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
  VALID_ROLES,
  isKnownRole,
  getPlan,
  isRoleAllowedForPlan,
  isStaffLimitReached,
  isPaymentMethodAllowed
};
