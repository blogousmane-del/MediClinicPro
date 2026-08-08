// Adaptateur Chariow — checkout hébergé Mobile Money + carte bancaire, utilisé
// uniquement pour l'abonnement MediClinic (jamais les paiements patients ni
// les dépôts : Chariow débite le prix de SON produit et n'accepte aucun
// montant libre, voir docs/superpowers/specs/2026-08-08-chariow-integration-design.md).
//
// Différence structurante avec bictorys.js / paytech.js / paypal.js : la
// configuration ne vient pas de l'environnement mais de platform_settings,
// saisie depuis Platform Admin. isConfigured() est donc ASYNCHRONE ici, et
// loadConfig() met en cache 60 s pour ne pas faire un SELECT par requête.
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { getSettings, getSecret } = require('../../utils/platformSettings');

const FETCH_TIMEOUT_MS = 15_000;
const CONFIG_CACHE_MS = 60_000;

let cachedConfig = null; // { value, expiresAt }

function clearConfigCache() {
  cachedConfig = null;
}

/**
 * Normalise un statut Chariow.
 *
 * L'ORDRE DES TESTS EST CRITIQUE : « unpaid » contient « paid ». Tester les
 * succès en premier créditerait une vente non payée. À l'autre bout,
 * « settled » (réglé, fonds encaissés) EST un succès — l'oublier a déjà coûté
 * une vente jamais créditée.
 *
 * @param {string} raw
 * @returns {'succeeded'|'failed'|'abandoned'|'pending'}
 */
function mapChariowStatus(raw) {
  const status = String(raw || '').toLowerCase();
  if (!status) return 'pending';
  if (status.includes('unpaid')) return 'pending';
  if (status.includes('fail') || status.includes('error')) return 'failed';
  if (status.includes('cancel') || status.includes('abandon') || status.includes('refund')) return 'abandoned';
  if (status.includes('settle') || status.includes('complete') || status.includes('paid') || status.includes('success')) {
    return 'succeeded';
  }
  return 'pending';
}

/**
 * Chariow exige { number: <national, sans indicatif ni 0>, country_code: ISO2 }.
 * Un E.164 brut dans `number` provoque un 400 « Invalid phone number » — c'est
 * la première cause d'échec de checkout documentée par Chariow.
 *
 * @param {{phone?: string, phoneCountry?: string, phoneLocal?: string}} input
 * @returns {{number: string, country_code: string}|null}
 */
function resolveChariowPhone({ phone, phoneCountry, phoneLocal } = {}) {
  const iso2 = phoneCountry ? String(phoneCountry).trim().toUpperCase() : null;

  if (iso2 && phoneLocal) {
    const parsed = parsePhoneNumberFromString(String(phoneLocal), iso2);
    if (parsed && parsed.isValid()) return { number: parsed.nationalNumber, country_code: parsed.country || iso2 };
  }

  if (phone) {
    const parsed = parsePhoneNumberFromString(String(phone));
    if (parsed && parsed.isValid() && parsed.country) {
      return { number: parsed.nationalNumber, country_code: parsed.country };
    }
  }

  // Dernier repli : ISO2 connu + chiffres bruts, sans validation stricte. Un
  // numéro valide localement mais mal reconnu par la librairie vaut mieux
  // qu'un checkout refusé.
  if (iso2 && (phoneLocal || phone)) {
    const digits = String(phoneLocal || phone).replace(/\D/g, '').replace(/^0+/, '');
    if (digits) return { number: digits, country_code: iso2 };
  }

  return null;
}

function parseProducts(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    console.error('[CHARIOW] chariow_products illisible (JSON invalide) — aucun produit disponible.');
    return {};
  }
}

/**
 * @param {object} products - correspondance <plan>_<mois> -> id produit
 * @param {string} planId
 * @param {number} months
 * @returns {string|null}
 */
function productIdFor(products, planId, months) {
  if (!products || typeof products !== 'object') return null;
  const id = products[`${planId}_${months}`];
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function loadConfig() {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.value;

  const { values } = await getSettings();
  const value = {
    apiKey: await getSecret('chariow_api_key'),
    apiUrl: String(values.chariow_api_url || 'https://api.chariow.com/v1').replace(/\/+$/, ''),
    products: parseProducts(values.chariow_products)
  };

  cachedConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_MS };
  return value;
}

async function isConfigured() {
  const config = await loadConfig();
  return !!config.apiKey;
}

async function chariowFetch(pathname, init, apiKey, apiUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${apiUrl}${pathname}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init && init.headers) }
    });
  } finally {
    clearTimeout(timer);
  }
}

function excerpt(text) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (!flat) return 'corps vide';
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
}

/**
 * Extrait un motif d'erreur lisible. Chariow n'a pas un format unique — selon
 * l'endpoint et la version on voit `message`, `error`, `errors[]` ou `detail`.
 * Ne lire que `message` renvoyait « raison inconnue » alors que la réponse
 * portait l'explication, ce qui envoie chercher la panne au mauvais endroit.
 */
function describeError(body, raw) {
  if (!body || typeof body !== 'object') return excerpt(raw);
  const direct = body.message || body.error || body.detail || body.error_description;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  if (direct && typeof direct === 'object') return excerpt(JSON.stringify(direct));
  if (Array.isArray(body.errors) && body.errors.length) return excerpt(JSON.stringify(body.errors));
  if (body.errors && typeof body.errors === 'object') return excerpt(JSON.stringify(body.errors));
  return excerpt(raw);
}

// `overrides.apiKey` sert à tester une clé AVANT de l'enregistrer : la console
// de configuration doit pouvoir rejeter une clé fausse sans l'avoir d'abord
// écrite en base, sinon l'écran l'annonce « configurée » alors que Chariow la
// refuse.
async function callChariow(pathname, init, overrides = {}) {
  const config = await loadConfig();
  const apiKey = overrides.apiKey || config.apiKey;
  if (!apiKey) return { ok: false, error: "La clé API Chariow n'est pas configurée." };

  let res;
  try {
    res = await chariowFetch(pathname, init, apiKey, config.apiUrl);
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers Chariow : ${err.message}` };
  }

  // Le corps est lu en texte d'abord : une passerelle ou un WAF répond en HTML,
  // et « réponse non JSON » sans le moindre extrait ne dit pas si le problème
  // vient de la clé, de l'URL ou du réseau.
  const raw = await res.text();
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, error: `Chariow a répondu ${res.status} (réponse non JSON) : ${excerpt(raw)}` };
  }

  if (!res.ok) {
    return { ok: false, error: `Chariow a refusé la requête (${res.status}) : ${describeError(body, raw)}` };
  }
  return { ok: true, data: body.data || body };
}

/**
 * @returns {Promise<{ok: true, saleId: string, checkoutUrl: string, amount: {value: number, currency: string}} | {ok: false, error: string}>}
 */
async function createCheckout({ productId, email, firstName, lastName, phone, redirectUrl, metadata }) {
  const payload = {
    product_id: productId,
    email,
    first_name: firstName,
    last_name: lastName,
    redirect_url: redirectUrl,
    custom_metadata: metadata || {}
  };
  if (phone) payload.phone = phone;

  const call = await callChariow('/checkout', { method: 'POST', body: JSON.stringify(payload) });
  if (!call.ok) return call;

  const purchase = call.data.purchase;
  const checkoutUrl = call.data.payment && call.data.payment.checkout_url;
  if (!purchase || !purchase.id || !checkoutUrl) {
    // Jamais de redirection en dur sur une réponse incomplète : envoyer
    // l'acheteur vers une URL devinée est le meilleur moyen de perdre un
    // paiement sans trace.
    return { ok: false, error: 'Chariow : réponse de checkout incomplète (identifiant ou URL manquant).' };
  }

  return {
    ok: true,
    saleId: String(purchase.id),
    checkoutUrl,
    amount: {
      value: Number(purchase.amount && purchase.amount.value),
      currency: String((purchase.amount && purchase.amount.currency) || '').toUpperCase()
    }
  };
}

/**
 * Source de vérité du règlement. Tout crédit passe par là, jamais par le
 * corps d'un webhook.
 * @returns {Promise<{ok: true, status: string, amount: {value: number, currency: string}, settledAt: string|null} | {ok: false, error: string}>}
 */
async function getSale(saleId) {
  const call = await callChariow(`/sales/${encodeURIComponent(saleId)}`, { method: 'GET' });
  if (!call.ok) return call;

  const sale = call.data;
  return {
    ok: true,
    status: mapChariowStatus(sale.status),
    amount: {
      value: Number(sale.amount && sale.amount.value),
      currency: String((sale.amount && sale.amount.currency) || '').toUpperCase()
    },
    // Le nom du champ varie selon la version de l'API : on prend le premier
    // présent, et surtout jamais l'heure courante en repli (voir
    // chariowReconcile.js, qui retombe sur created_at de la ligne).
    settledAt: sale.settled_at || sale.paid_at || sale.completed_at || null
  };
}

/**
 * Produits publiés de la boutique. Sert à valider la clé API à
 * l'enregistrement et à peupler la liste de l'écran de configuration.
 * @returns {Promise<{ok: true, products: {id: string, name: string, price: number, currency: string}[]} | {ok: false, error: string}>}
 */
async function listProducts(overrides = {}) {
  const call = await callChariow('/products', { method: 'GET' }, overrides);
  if (!call.ok) return call;
  const rows = Array.isArray(call.data) ? call.data : call.data.products || [];
  return {
    ok: true,
    products: rows.map((p) => ({
      id: String(p.id),
      name: p.name || '',
      price: Number(p.price && p.price.value !== undefined ? p.price.value : p.price),
      currency: String((p.price && p.price.currency) || p.currency || '').toUpperCase()
    }))
  };
}

module.exports = {
  mapChariowStatus,
  describeError,
  resolveChariowPhone,
  productIdFor,
  loadConfig,
  clearConfigCache,
  isConfigured,
  createCheckout,
  getSale,
  listProducts
};
