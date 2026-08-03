// PayPal Orders v2 adapter — abonnements MediClinic uniquement (ni paiements
// patients, ni dépôts). PayPal ne règle pas en XOF : les montants sont
// convertis FCFA -> USD à un taux fixe configuré par l'exploitant
// (XOF_TO_USD_RATE), pas via une API de change en direct.
// https://developer.paypal.com/docs/api/orders/v2/
const API_LIVE = 'https://api-m.paypal.com';
const API_SANDBOX = 'https://api-m.sandbox.paypal.com';
const FETCH_TIMEOUT_MS = 15_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000; // renouvelle 1 min avant l'expiration réelle

let cachedToken = null; // { value: string, expiresAt: number }

function isConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function apiUrl() {
  return (process.env.PAYPAL_MODE || 'sandbox') === 'live' ? API_LIVE : API_SANDBOX;
}

/**
 * Convertit un montant FCFA en USD au taux fixe configuré.
 * Renvoie null si le taux est absent/invalide — l'appelant doit alors
 * échouer proprement plutôt que d'envoyer un montant faux à PayPal.
 * @param {number} amountXof
 * @returns {number|null} montant USD arrondi à 2 décimales (exigé par PayPal)
 */
function xofToUsd(amountXof) {
  const rate = parseFloat(process.env.XOF_TO_USD_RATE || '');
  if (!rate || rate <= 0 || !Number.isFinite(rate)) return null;
  const usd = Math.round((amountXof / rate) * 100) / 100;
  return usd > 0 ? usd : null;
}

async function paypalFetch(path, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${apiUrl()}${path}`, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Jeton OAuth2 client_credentials, mis en cache mémoire jusqu'à expiration
 * (sinon un aller-retour OAuth complet par paiement).
 * @returns {Promise<{ok: true, token: string} | {ok: false, error: string}>}
 */
async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.value };
  }

  const basic = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  let res;
  try {
    res = await paypalFetch('/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  if (!res.ok || !data.access_token) {
    return { ok: false, error: `PayPal OAuth a échoué (${res.status}): ${data.error_description || data.error || 'raison inconnue'}` };
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - TOKEN_EXPIRY_MARGIN_MS
  };
  return { ok: true, token: data.access_token };
}

/**
 * Crée une commande PayPal (intent CAPTURE) et renvoie le lien d'approbation.
 * `reference` est notre référence maison ("sub-12") : elle est posée à la fois
 * en reference_id ET en custom_id, car seul custom_id est repropagé dans la
 * ressource capture reçue par webhook.
 * @param {object} params
 * @param {number} params.amount - montant en FCFA (entier)
 * @param {string} params.description
 * @param {string} params.reference
 * @param {string} params.returnUrl
 * @param {string} params.cancelUrl
 * @param {string} [params.customerEmail]
 * @param {string} [params.customerName]
 */
async function initiateCheckout(params) {
  if (!isConfigured()) {
    return { ok: false, error: 'not_configured' };
  }

  const amountUsd = xofToUsd(params.amount);
  if (amountUsd === null) {
    return { ok: false, error: 'PayPal: taux de conversion XOF_TO_USD_RATE absent ou invalide.' };
  }

  const auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: params.reference,
        custom_id: params.reference,
        description: (params.description || 'Abonnement MediClinic').slice(0, 127),
        amount: { currency_code: 'USD', value: amountUsd.toFixed(2) }
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'MediClinic Pro',
          locale: 'fr-FR',
          user_action: 'PAY_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl
        }
      }
    }
  };

  let res;
  try {
    res = await paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  if (!res.ok || !data.id) {
    return { ok: false, error: `PayPal a refusé la commande (${res.status}): ${data.message || 'raison inconnue'}` };
  }

  const approveLink = (data.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!approveLink || !approveLink.href) {
    return { ok: false, error: "PayPal: réponse sans lien d'approbation." };
  }

  return { ok: true, providerReference: data.id, checkoutUrl: approveLink.href, status: 'pending' };
}

/**
 * Capture une commande déjà approuvée par l'acheteur. Idempotent côté PayPal :
 * recapturer une commande déjà capturée renvoie son statut, sans double débit.
 * @param {string} orderId
 */
async function captureOrder(orderId) {
  if (!isConfigured()) return { ok: false, error: 'not_configured' };

  const auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  let res;
  try {
    res = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  // ORDER_ALREADY_CAPTURED = le webhook ou un rechargement de page a déjà fait
  // le travail. Ce n'est pas une erreur pour nous.
  const alreadyCaptured =
    data.name === 'UNPROCESSABLE_ENTITY' &&
    (data.details || []).some((d) => d.issue === 'ORDER_ALREADY_CAPTURED');

  if (!res.ok && !alreadyCaptured) {
    return { ok: false, error: `PayPal capture a échoué (${res.status}): ${data.message || 'raison inconnue'}` };
  }

  return { ok: true, status: data.status || 'COMPLETED' };
}

/**
 * Vérifie la signature d'un webhook via l'API PayPal Verify Webhook Signature.
 * Asynchrone (appel réseau) — contrairement à l'équivalent Bictorys/PayTech qui
 * calcule un HMAC localement. L'appelant doit `await`.
 * @param {import('express').Request} req
 * @param {Buffer} rawBody
 */
async function verifyWebhookSignature(req, rawBody) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return { ok: false, error: 'PAYPAL_WEBHOOK_ID non configuré' };

  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const transmissionSig = req.headers['paypal-transmission-sig'];
  const certUrl = req.headers['paypal-cert-url'];
  const authAlgo = req.headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return { ok: false, error: 'PayPal: en-têtes de signature manquants' };
  }

  // PayPal n'accepte pas le cert-url de n'importe quel domaine : refuser tout ce
  // qui ne vient pas de paypal.com évite de suivre une URL fournie par un tiers.
  let certHost;
  try {
    certHost = new URL(String(certUrl)).hostname;
  } catch {
    return { ok: false, error: 'PayPal: paypal-cert-url illisible' };
  }
  if (certHost !== 'api.paypal.com' && !certHost.endsWith('.paypal.com')) {
    return { ok: false, error: 'PayPal: paypal-cert-url hors domaine paypal.com' };
  }

  let webhookEvent;
  try {
    webhookEvent = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return { ok: false, error: 'PayPal: corps de requête illisible' };
  }

  const auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  let res;
  try {
    res = await paypalFetch('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent
      })
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  if (data.verification_status !== 'SUCCESS') {
    return { ok: false, error: `PayPal: signature webhook invalide (${data.verification_status || res.status})` };
  }

  return { ok: true };
}

/**
 * Normalise un événement PayPal vers la forme attendue par fulfillEvent().
 * reportedAmount est en USD — c'est amountMatches() qui gère la comparaison
 * avec le montant FCFA stocké en base.
 */
function parseEvent(body) {
  if (!body || !body.resource) return null;

  const resource = body.resource;
  const eventType = String(body.event_type || '');
  const reference =
    resource.custom_id ||
    resource.invoice_id ||
    (resource.purchase_units && resource.purchase_units[0] && resource.purchase_units[0].custom_id);

  if (!reference) return null;

  const rawAmount = resource.amount && resource.amount.value;
  const amount = rawAmount === undefined || rawAmount === null ? undefined : parseFloat(rawAmount);
  const currency = (resource.amount && resource.amount.currency_code) || undefined;

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    return {
      providerReference: resource.id,
      status: 'completed',
      reportedAmount: amount,
      reportedCurrency: currency,
      paymentReference: reference
    };
  }

  if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
    return {
      providerReference: resource.id,
      status: 'failed',
      failureReason: eventType,
      reportedAmount: amount,
      reportedCurrency: currency,
      paymentReference: reference
    };
  }

  return null; // pending/en attente/autres types -> ignoré
}

module.exports = {
  isConfigured,
  xofToUsd,
  getAccessToken,
  initiateCheckout,
  captureOrder,
  verifyWebhookSignature,
  parseEvent
};
