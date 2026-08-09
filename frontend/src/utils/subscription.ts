import type { Clinic } from '../contexts/AuthContext';

/**
 * État d'abonnement tel que le serveur le calcule (backend/utils/subscription.js)
 * et le renvoie dans GET /auth/me. Le client ne le recalcule pas : deux règles
 * parallèles finissaient par se contredire d'une journée entière — l'en-tête
 * annonçait « expire dans 1 jour » pendant que le serveur refusait déjà tout.
 */
export interface SubscriptionState {
  /** La date est passée (ou le statut vaut 'expired'). Écritures refusées. */
  expired: boolean;
  /** Expiré ET délai de grâce écoulé : l'application se ferme. */
  locked: boolean;
  expiresAt: string | null;
  /** Instant où le verrou tombe. */
  graceEndsAt: string | null;
  /** Jours entiers restants avant le verrou, null si non expiré. */
  graceDaysLeft: number | null;
}

/** Durée du délai de grâce, en jours. Doit rester égale à GRACE_PERIOD_DAYS du backend. */
export const GRACE_PERIOD_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Repli local, appliquant la même règle que le serveur. Sert uniquement quand
 * `/auth/me` ne renvoie pas encore le bloc `subscription` : onglet resté ouvert
 * pendant un déploiement, ou réponse mise en cache. En régime normal, l'état
 * vient du serveur.
 */
export function deriveSubscriptionState(clinic: Clinic | null, now: Date = new Date()): SubscriptionState {
  const expiresAtRaw = clinic?.subscription_expires_at || null;
  const expiresAt = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const expired = Boolean(
    clinic && (clinic.subscription_status === 'expired' || (expiresAt !== null && expiresAt < now))
  );

  if (!expired) {
    return { expired: false, locked: false, expiresAt: expiresAtRaw, graceEndsAt: null, graceDaysLeft: null };
  }

  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    return { expired: true, locked: true, expiresAt: expiresAtRaw, graceEndsAt: null, graceDaysLeft: 0 };
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

/**
 * Onglets fermés par le verrou. Le tableau de bord n'y figure pas : il reste
 * accessible, mais vidé de ses chiffres (il interroge des routes verrouillées),
 * pour ne pas jeter l'utilisateur contre un mur dès la connexion. Paramètres,
 * Profil et la console plateforme restent ouverts — c'est par eux qu'on paie.
 */
export const LOCKED_TABS = [
  'patients',
  'appointments',
  'prescriptions',
  'laboratory',
  'pharmacy',
  'accounting',
  'deposits'
] as const;

/** `locked` vaut aussi bien pour un abonnement verrouillé que pour une suspension plateforme. */
export function isTabLocked(tab: string, locked: boolean): boolean {
  if (!locked) return false;
  return (LOCKED_TABS as readonly string[]).includes(tab);
}

/** Format court d'une date ISO pour les messages d'abonnement (« 09/08/2026 »). */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
}
