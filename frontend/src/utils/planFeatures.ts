// Grille de comparaison des plans, partagée par la vitrine (LandingPage) et
// l'onglet Abonnement (SettingsPage). Les deux écrans affichaient la même
// grille écrite deux fois : elles avaient déjà divergé une fois.
//
// Les lignes ne gardent que ce qui DIFFÈRE d'un plan à l'autre. Les cinq
// lignes précédentes étaient identiques sur trois cartes sur quatre d'entre
// elles : la grille occupait de la place sans aider personne à choisir. Ce
// qui est commun aux trois plans s'écrit une seule fois, sous la grille.
//
// Tout est dérivé de la configuration réelle renvoyée par le backend
// (`staffLimit`, `allowedRoles`, `price`) et jamais d'une chaîne marketing
// recopiée, pour que l'affichage ne puisse pas mentir sur ce qui est appliqué.

export const ROLE_LABELS: Record<string, string> = {
  admin: 'administrateur', doctor: 'médecin', secretary: 'secrétaire',
  pharmacist: 'pharmacien', lab_tech: 'laborantin', manager: 'gestionnaire', nurse: 'infirmier'
};

export interface PlanFeatureInput {
  price: number;
  staffLimit: number | null;
  allowedRoles: string[] | null;
  /** Durée de l'essai, pour les plans gratuits : « 7 jours ». */
  trialLabel?: string;
}

export const buildPlanFeatureRows = (plan: PlanFeatureInput): { label: string; ok: boolean }[] => [
  {
    label: plan.staffLimit === null || plan.staffLimit === undefined
      ? 'Comptes utilisateurs illimités'
      : `${plan.staffLimit} comptes utilisateurs actifs`,
    ok: true
  },
  {
    label: plan.allowedRoles
      ? `${plan.allowedRoles.length} rôles : ${plan.allowedRoles.map(r => ROLE_LABELS[r] || r).join(', ')}`
      : 'Les 7 rôles, dont pharmacien et laborantin',
    ok: true
  },
  {
    label: plan.price === 0
      ? `Essai unique de ${plan.trialLabel || '7 jours'}, non renouvelable`
      : 'Reconductible de 1 à 12 mois, sans engagement',
    ok: true
  }
];

/** Ce que les trois plans partagent — affiché une fois, sous la grille. */
export const PLAN_COMMON_NOTE =
  'Tous les plans incluent : patients et dossiers illimités, rendez-vous, ordonnances, '
  + 'pharmacie, laboratoire, comptabilité, encaissement en espèces, accès web et mobile.';
