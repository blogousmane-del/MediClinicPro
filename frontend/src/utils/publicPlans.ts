// Catalogue public des formules, lu par la vitrine et la page d'inscription
// dans GET /settings/public/plans (backend/utils/plans.js, durée d'essai
// effective comprise). Le repli ne sert que si l'API ne répond pas : la
// vitrine doit s'afficher backend éteint, sans devenir la référence des prix.
export type PlanId = 'starter' | 'clinique' | 'hopital';

export interface PublicPlan {
  price: number;
  staffLimit: number | null;
  trialDays: number | null;
}

export type PublicCatalog = Record<PlanId, PublicPlan>;

export const FALLBACK_CATALOG: PublicCatalog = {
  starter: { price: 0, staffLimit: 3, trialDays: 7 },
  clinique: { price: 9000, staffLimit: 5, trialDays: null },
  hopital: { price: 14500, staffLimit: null, trialDays: null },
};

const PLAN_IDS = Object.keys(FALLBACK_CATALOG) as PlanId[];

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const nullableCount = (value: unknown, fallback: number | null): number | null =>
  value === null || isCount(value) ? value : fallback;

// Chaque valeur reçue n'est retenue que si elle est plausible : une réponse
// partielle ou malformée garde le repli plutôt qu'afficher « NaN FCFA ».
export const mergeCatalog = (live: unknown): PublicCatalog => {
  const source = live !== null && typeof live === 'object' ? (live as Record<string, unknown>) : {};
  const merged = {} as PublicCatalog;
  for (const id of PLAN_IDS) {
    const fallback = FALLBACK_CATALOG[id];
    const raw = source[id];
    const plan = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    merged[id] = {
      price: isCount(plan.price) ? plan.price : fallback.price,
      staffLimit: nullableCount(plan.staffLimit, fallback.staffLimit),
      trialDays: nullableCount(plan.trialDays, fallback.trialDays),
    };
  }
  return merged;
};

// Durée de l'essai gratuit, en jours : jamais zéro ni vide à l'écran.
export const trialDaysOf = (catalog: PublicCatalog): number => {
  const days = catalog.starter.trialDays;
  return days !== null && days > 0 ? days : (FALLBACK_CATALOG.starter.trialDays as number);
};

// 9000 donne « 9 000 », avec l'espace fine insécable de la typographie
// française : un prix ne se coupe jamais en fin de ligne.
export const formatFcfa = (amount: number): string =>
  String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
