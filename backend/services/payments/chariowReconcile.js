// Cœur du crédit d'abonnement Chariow. Appelé par les TROIS chemins — retour
// navigateur, webhook, cron — et seul endroit autorisé à faire passer une
// ligne subscription_payments à 'paid' pour ce fournisseur.
//
// Principe non négociable : rien n'est cru sur parole. Même déclenchée par un
// webhook affirmant « payé », cette fonction redemande le statut à Chariow.
// Chariow ne signe pas ses webhooks : leur corps ne prouve rien.
const { supabase } = require('../../database');
const chariow = require('./chariow');
const { creditSubscription } = require('../../routes/webhooks');

// Une vente réglée après que nous avons abandonné la ligne est un cas réel
// documenté par Chariow. On continue donc de re-vérifier les échecs pendant
// deux semaines avant de les considérer définitifs.
const FAILED_RETRY_DAYS = 14;
const AMOUNT_TOLERANCE = 0.02; // 2 %

/**
 * Filtre les lignes qu'il vaut la peine de réconcilier. Isolé de la boucle du
 * cron pour être testable sans réseau ni base.
 * @param {object[]} rows
 * @returns {object[]}
 */
function selectReconcilable(rows) {
  const cutoff = Date.now() - FAILED_RETRY_DAYS * 24 * 3600 * 1000;
  return (rows || []).filter((row) => {
    if (row.provider !== 'chariow') return false;
    if (row.status === 'pending') return true;
    if (row.status !== 'failed') return false;
    return new Date(row.created_at).getTime() >= cutoff;
  });
}

/**
 * @param {number} subscriptionPaymentId
 * @returns {Promise<{status: 'paid'|'pending'|'failed'|'unknown', reason?: string}>}
 */
async function reconcileChariowSubscription(subscriptionPaymentId) {
  const { data: row, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('id', subscriptionPaymentId)
    .maybeSingle();

  if (error || !row) return { status: 'unknown', reason: 'introuvable' };
  if (row.provider !== 'chariow') return { status: 'unknown', reason: 'autre fournisseur' };
  if (row.status === 'paid') return { status: 'paid' };

  if (row.status === 'failed') {
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age > FAILED_RETRY_DAYS * 24 * 3600 * 1000) return { status: 'failed', reason: 'hors fenêtre de rattrapage' };
  }

  if (!row.provider_reference) return { status: 'unknown', reason: 'aucune référence de vente' };

  const sale = await chariow.getSale(row.provider_reference);
  if (!sale.ok) {
    console.error(`[CHARIOW] Lecture de la vente ${row.provider_reference} impossible :`, sale.error);
    return { status: 'unknown', reason: 'fournisseur injoignable' };
  }

  if (sale.status === 'failed' || sale.status === 'abandoned') {
    await supabase
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', row.id)
      .eq('status', 'pending');
    return { status: 'failed' };
  }

  if (sale.status !== 'succeeded') return { status: 'pending' };

  // Contrôle du montant AVANT tout crédit, sur la valeur relue chez le
  // fournisseur — pas sur celle mémorisée au checkout, qui ne prouve rien de
  // ce qui a été réellement encaissé.
  if (sale.amount.currency !== 'XOF') {
    console.error(`[CHARIOW] ANOMALIE devise sur la vente ${row.provider_reference} : ${sale.amount.currency} au lieu de XOF — NON crédité.`);
    return { status: 'unknown', reason: 'devise inattendue' };
  }
  if (!Number.isFinite(sale.amount.value) || Math.abs(sale.amount.value - row.amount) > row.amount * AMOUNT_TOLERANCE) {
    console.error(`[CHARIOW] ANOMALIE montant sur la vente ${row.provider_reference} : ${sale.amount.value} au lieu de ${row.amount} — NON crédité.`);
    return { status: 'unknown', reason: 'montant inattendu' };
  }

  // Date du fournisseur, sinon celle de création de la ligne. JAMAIS
  // new Date() : un rattrapage tardif daterait la recette du jour du
  // rattrapage au lieu du jour du paiement.
  const paidAt = sale.settledAt || row.created_at;

  const { data: updated } = await supabase
    .from('subscription_payments')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', row.id)
    .in('status', ['pending', 'failed'])
    .select()
    .maybeSingle();

  // Écriture conditionnelle : si elle n'a touché aucune ligne, un autre chemin
  // a crédité entre-temps. Le paiement est bien réglé, mais ce n'est pas à
  // nous de le créditer une seconde fois.
  if (!updated) return { status: 'paid' };

  // La ligne est déjà 'paid' : si le crédit échoue maintenant, plus aucun
  // chemin ne rejouera (les trois sortent sur status === 'paid') et la clinique
  // resterait payante sans échéance prolongée, sans le moindre signal. On
  // remet donc la ligne en 'pending' pour que le webhook, le retour navigateur
  // ou le cron reprennent le travail.
  try {
    await creditSubscription(row, { provider: 'chariow', paidAt });
  } catch (err) {
    console.error(`[CHARIOW] Crédit de l'abonnement #${row.id} impossible, ligne remise en attente :`, err);
    await supabase
      .from('subscription_payments')
      .update({ status: 'pending', paid_at: null })
      .eq('id', row.id)
      .eq('status', 'paid');
    return { status: 'pending', reason: 'crédit à rejouer' };
  }

  return { status: 'paid' };
}

module.exports = { reconcileChariowSubscription, selectReconcilable, FAILED_RETRY_DAYS };
