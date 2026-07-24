// Orchestrates checkout initiation across providers with failover.
// Bictorys is primary (broadest Côte d'Ivoire mobile money coverage);
// PayTech is only tried if Bictorys fails at INITIATION (network/5xx/WAF) —
// never after the buyer has started paying on a hosted page.
const bictorys = require('./bictorys');
const paytech = require('./paytech');

/**
 * @param {object} params - shared checkout params (amount, reference, returnUrl, cancelUrl, ...)
 * @param {object} paytechExtra - PayTech-only required fields (itemName, ipnUrl)
 * @returns {Promise<{ok: true, provider: string, checkoutUrl: string, providerReference: string} | {ok: false, error: string}>}
 */
async function initiateCheckoutWithFailover(params, paytechExtra = {}) {
  const bictorysReady = bictorys.isConfigured();
  const paytechReady = paytech.isConfigured();

  if (!bictorysReady && !paytechReady) {
    return {
      ok: false,
      error: "Le paiement en ligne n'est pas encore configuré pour cette clinique. Merci de réessayer plus tard ou de contacter le support MediClinic."
    };
  }

  if (bictorysReady) {
    const result = await bictorys.initiateCheckout(params);
    if (result.ok) return { ...result, provider: 'bictorys' };
    console.error('[PAYMENTS] Échec initiation Bictorys, bascule PayTech si disponible:', result.error);
  }

  if (paytechReady) {
    const result = await paytech.initiateCheckout({ ...params, ...paytechExtra });
    if (result.ok) return { ...result, provider: 'paytech' };
    return { ok: false, error: result.error };
  }

  return { ok: false, error: "Échec de l'initialisation du paiement auprès du fournisseur disponible." };
}

module.exports = { initiateCheckoutWithFailover, bictorys, paytech };
