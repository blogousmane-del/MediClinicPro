// PayPal Orders v2 adapter — abonnements MediClinic uniquement (ni paiements
// patients, ni dépôts). PayPal ne règle pas en XOF : les montants sont
// convertis FCFA -> USD à un taux fixe configuré par l'exploitant
// (XOF_TO_USD_RATE), pas via une API de change en direct.
// https://developer.paypal.com/docs/api/orders/v2/
const API_LIVE = 'https://api-m.paypal.com';
const API_SANDBOX = 'https://api-m.sandbox.paypal.com';
const FETCH_TIMEOUT_MS = 15_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000; // renouvelle 1 min avant l'expiration réelle

let cachedToken = null; // { key: string, value: string, expiresAt: number }

function isConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function apiUrl() {
  return (process.env.PAYPAL_MODE || 'sandbox') === 'live' ? API_LIVE : API_SANDBOX;
}

// Clé du cache de jeton : base API + client id, pour qu'un jeton obtenu en
// sandbox ne soit jamais envoyé en live si PAYPAL_MODE change en cours de
// process (ex. process worker réutilisé entre requêtes).
function tokenCacheKey() {
  return `${apiUrl()}::${process.env.PAYPAL_CLIENT_ID || ''}`;
}

/**
 * Convertit un montant FCFA en USD au taux fixe configuré.
 * Renvoie null si le taux est absent/invalide — l'appelant doit alors
 * échouer proprement plutôt que d'envoyer un montant faux à PayPal.
 * @param {number} amountXof
 * @returns {number|null} montant USD arrondi à 2 décimales (exigé par PayPal)
 */
function xofToUsd(amountXof) {
  const raw = String(process.env.XOF_TO_USD_RATE || '').trim();
  // Format strict "chiffres[.chiffres]" uniquement : parseFloat() accepterait
  // silencieusement une virgule décimale ("600,5" -> 6) ou un séparateur de
  // milliers espace ("6 000" -> 6), une saisie francophone plausible qui
  // multiplierait chaque paiement par ~100. La fourchette 100-2000 borne le
  // taux FCFA/USD à des valeurs plausibles pour rejeter toute valeur
  // manifestement mal saisie (ex. un taux inversé USD/FCFA).
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const rate = parseFloat(raw);
  if (!Number.isFinite(rate) || rate < 100 || rate > 2000) return null;
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
  const key = tokenCacheKey();
  if (cachedToken && cachedToken.key === key && cachedToken.expiresAt > Date.now()) {
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
    key,
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - TOKEN_EXPIRY_MARGIN_MS
  };
  return { ok: true, token: data.access_token };
}

/**
 * Exécute un appel authentifié à PayPal. Si le jeton en cache est rejeté par
 * PayPal (401 — expiré côté serveur avant notre marge, ou invalidé après un
 * changement de mode en cours de process), vide le cache et réessaie l'appel
 * une seule fois avec un jeton neuf ; un second 401 remonte tel quel.
 * @param {(token: string) => Promise<Response>} makeRequest
 * @returns {Promise<{ok: true, res: Response, data: any} | {ok: false, error: string}>}
 */
async function callWithAuth(makeRequest) {
  const auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  let res;
  try {
    res = await makeRequest(auth.token);
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  if (res.status === 401) {
    cachedToken = null;
    const retryAuth = await getAccessToken();
    if (!retryAuth.ok) return { ok: false, error: retryAuth.error };
    try {
      res = await makeRequest(retryAuth.token);
    } catch (err) {
      return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
    }
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  return { ok: true, res, data };
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
 */
async function initiateCheckout(params) {
  if (!isConfigured()) {
    return { ok: false, error: 'not_configured' };
  }

  if (!params || typeof params.reference !== 'string' || !params.reference.trim()) {
    return { ok: false, error: 'PayPal: référence de paiement manquante.' };
  }

  // Vérifié séparément du résultat de xofToUsd() : cette dernière renvoie null
  // aussi bien pour un taux invalide que pour un montant nul/négatif/non
  // numérique, ce qui afficherait à tort le message sur XOF_TO_USD_RATE pour
  // un problème de montant.
  if (typeof params.amount !== 'number' || !Number.isFinite(params.amount) || params.amount <= 0) {
    return { ok: false, error: 'PayPal: montant invalide (doit être un nombre positif).' };
  }

  const amountUsd = xofToUsd(params.amount);
  if (amountUsd === null) {
    return { ok: false, error: 'PayPal: taux de conversion XOF_TO_USD_RATE absent ou invalide.' };
  }

  const paypalSource = {
    experience_context: {
      brand_name: 'MediClinic Pro',
      locale: 'fr-FR',
      user_action: 'PAY_NOW',
      return_url: params.returnUrl,
      cancel_url: params.cancelUrl
    }
  };
  if (typeof params.customerEmail === 'string' && params.customerEmail.trim()) {
    paypalSource.email_address = params.customerEmail.trim();
  }

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
    payment_source: { paypal: paypalSource }
  };

  const call = await callWithAuth((token) =>
    paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Empêche PayPal de créer une commande en double si cet appel est
        // rejoué (timeout, retry applicatif) — clé sur notre référence maison.
        'PayPal-Request-Id': params.reference
      },
      body: JSON.stringify(body)
    })
  );
  if (!call.ok) return { ok: false, error: call.error };
  const { res, data } = call;

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
 * recapturer une commande déjà capturée ne provoque pas de double débit, mais
 * renvoie le sentinel 'already_captured' plutôt que le statut réel de la
 * capture existante (voir @returns).
 * @param {string} orderId
 * @returns {Promise<{ok: true, status: string} | {ok: false, error: string}>}
 *   `status` recouvre trois familles distinctes, à ne jamais traiter comme
 *   équivalentes :
 *   - le statut réel renvoyé par PayPal pour une capture qui vient d'aboutir
 *     (2xx) : peut valoir 'COMPLETED', mais aussi 'PENDING' ou une autre
 *     valeur non terminale — seul 'COMPLETED' prouve que le paiement est
 *     réglé ;
 *   - 'already_captured' (sentinel maison) : PayPal a rejeté la capture car
 *     la commande l'était déjà, mais ne rapporte pas le statut de cette
 *     capture existante — elle peut être PENDING ou DECLINED ;
 *   - 'unknown' (sentinel maison) : PayPal a répondu 2xx sans champ `status`.
 *   Dans tous les cas hors 'COMPLETED', l'appelant NE DOIT PAS créditer
 *   l'abonnement sur la seule foi de `ok: true` — il doit attendre le webhook
 *   signé (`verifyWebhookSignature` + `parseEvent`) avant tout crédit.
 */
async function captureOrder(orderId) {
  if (!isConfigured()) return { ok: false, error: 'not_configured' };

  const call = await callWithAuth((token) =>
    paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Empêche une capture en double si cet appel est rejoué — clé sur
        // l'id de commande PayPal, stable pour une capture donnée.
        'PayPal-Request-Id': orderId
      },
      body: '{}'
    })
  );
  if (!call.ok) return { ok: false, error: call.error };
  const { res, data } = call;

  // ORDER_ALREADY_CAPTURED = le webhook ou un rechargement de page a déjà fait
  // le travail. Ce n'est pas une erreur pour nous, mais ce n'est pas non plus
  // une preuve que la capture existante a réussi (elle peut être PENDING ou
  // DECLINED) : on ne réinvente jamais un statut que PayPal n'a pas rapporté.
  const alreadyCaptured =
    data.name === 'UNPROCESSABLE_ENTITY' &&
    (data.details || []).some((d) => d.issue === 'ORDER_ALREADY_CAPTURED');

  if (!res.ok && !alreadyCaptured) {
    return { ok: false, error: `PayPal capture a échoué (${res.status}): ${data.message || 'raison inconnue'}` };
  }

  if (alreadyCaptured) {
    return { ok: true, status: 'already_captured' };
  }

  return { ok: true, status: data.status || 'unknown' };
}

/**
 * Vérifie la signature d'un webhook via l'API PayPal Verify Webhook Signature.
 * Asynchrone (appel réseau) — contrairement à l'équivalent Bictorys/PayTech qui
 * calcule un HMAC localement. L'appelant doit `await`.
 * @param {import('express').Request} req
 * @param {Buffer} rawBody
 */
async function verifyWebhookSignature(req, rawBody) {
  if (!isConfigured()) return { ok: false, error: 'not_configured' };

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

  const call = await callWithAuth((token) =>
    paypalFetch('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
    })
  );
  if (!call.ok) return { ok: false, error: call.error };
  const { res, data } = call;

  // Un échec d'authentification (ex. PAYPAL_CLIENT_SECRET invalide) n'a pas de
  // verification_status dans le corps — sans cette branche, il tombait dans le
  // message "signature webhook invalide" ci-dessous, qui pointe à tort
  // l'opérateur vers PAYPAL_WEBHOOK_ID alors que le vrai problème est
  // l'authentification à l'API PayPal elle-même.
  if (!res.ok) {
    return { ok: false, error: `PayPal: échec d'authentification à l'API de vérification (${res.status}): ${data.message || 'raison inconnue'}` };
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
 * Note : `providerReference` renvoyé ici est l'id de la **capture**
 * (resource.id sur un événement PAYMENT.CAPTURE.*), pas l'id de **commande**
 * renvoyé par `initiateCheckout()`. Contrairement aux adaptateurs
 * bictorys.js/paytech.js, qui renvoient le même identifiant à l'initiation et
 * à la confirmation, PayPal expose deux ids distincts — ne pas supposer
 * qu'ils sont interchangeables lors d'un rapprochement.
 */
function parseEvent(body) {
  if (!body || !body.resource) return null;

  const resource = body.resource;
  const eventType = String(body.event_type || '');
  // custom_id est le seul champ fiable ici : initiateCheckout() ne renseigne
  // jamais invoice_id (le suivre élargirait sans raison la surface de
  // référence de confiance à de l'activité que cette app n'a pas générée),
  // et resource.purchase_units n'existe pas sur les événements PAYMENT.CAPTURE.*
  // traités par cette fonction (resource y est un objet capture, pas commande).
  const reference = resource.custom_id;

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

  if (eventType === 'PAYMENT.CAPTURE.DENIED') {
    return {
      providerReference: resource.id,
      status: 'failed',
      failureReason: eventType,
      reportedAmount: amount,
      reportedCurrency: currency,
      paymentReference: reference
    };
  }

  // PAYMENT.CAPTURE.REVERSED = rétrofacturation sur un paiement déjà réussi,
  // pas une capture qui n'a jamais abouti : la mapper sur 'failed' serait un
  // no-op silencieux (fulfillEvent ne met à jour que les lignes encore
  // 'pending') qui déguiserait un chargeback en simple échec. Les
  // rétrofacturations sont volontairement hors périmètre pour l'instant et
  // nécessiteraient leur propre traitement dédié.
  if (eventType === 'PAYMENT.CAPTURE.REVERSED') {
    console.error(`[PAYPAL] Rétrofacturation/chargeback reçu et non traité — capture id: ${resource.id}, référence: ${reference}`);
    return null;
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
