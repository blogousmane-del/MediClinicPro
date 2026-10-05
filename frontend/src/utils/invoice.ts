// Calculs des factures patients, partagés par la caisse, le reçu et le grand livre.

export const VAT_RATE = 0.18;

// La TVA est un réglage de la clinique (`clinics.settings.vat_enabled`), parce que
// les soins et les médicaments en sont souvent exonérés. Absent, il vaut « oui » :
// les cliniques d'avant ce réglage continuent de facturer comme avant, et aucun
// montant ne change sans que la clinique l'ait choisi.
export const isVatEnabled = (settings: unknown): boolean =>
  !(settings !== null && typeof settings === 'object' && (settings as { vat_enabled?: unknown }).vat_enabled === false);

export interface InvoiceTotals {
  subtotal: number;
  vat: number;
  total: number;
}

export const computeInvoiceTotals = (subtotal: number, vatEnabled: boolean): InvoiceTotals => {
  const vat = vatEnabled ? Math.round(subtotal * VAT_RATE) : 0;
  return { subtotal, vat, total: subtotal + vat };
};

// Un encaissement ne stocke pas sa TVA à part : seulement ses lignes (`items`) et
// le total payé (`amount_total`). La réimpression la déduit donc de leur écart,
// ce qui reste juste quel que soit le réglage actuel de la clinique : un reçu émis
// avec TVA garde sa TVA, un reçu émis sans n'en affiche pas. Sans lignes
// exploitables, ou si elles dépassent le total, on n'invente aucun détail.
export const receiptBreakdown = (items: { cost?: number }[], amountTotal: number): InvoiceTotals | null => {
  const subtotal = items.reduce((acc, it) => acc + (Number(it.cost) || 0), 0);
  const total = Number(amountTotal) || 0;
  if (subtotal <= 0 || total < subtotal) return null;
  return { subtotal, vat: total - subtotal, total };
};

// Le taux n'est cité que s'il explique le montant : un reçu ancien ou corrigé à
// la main n'affiche pas « 18 % » à côté d'une somme qui n'en est pas 18 %.
export const vatLabel = (subtotal: number, vat: number): string =>
  vat === Math.round(subtotal * VAT_RATE) ? `TVA (${Math.round(VAT_RATE * 100)} %)` : 'TVA';

// Valeurs réellement stockées dans `payments.payment_method` : espèces seulement
// aujourd'hui, Mobile Money avant le passage à Chariow.
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  wave: 'Wave',
  orange_money: 'Orange Money',
  mtn_momo: 'MTN Mobile Money',
};

export const paymentMethodLabel = (method: unknown): string => {
  const key = method === null || method === undefined ? '' : String(method);
  return PAYMENT_METHOD_LABELS[key] || key;
};
