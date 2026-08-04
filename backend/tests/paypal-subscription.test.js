// Tests du flux d'abonnement PayPal.
//
// Lancer avec :  npm test   (depuis backend/)
//
// Principe : on charge les VRAIES routes Express (routes/webhooks.js,
// routes/financials.js) et on ne remplace que ce qui sort de la machine —
// Supabase, les appels réseau PayPal et le middleware d'authentification.
// Toute la logique métier testée ici (vérification de montant, conversion
// FCFA->USD, périmètre des références, crédit de l'abonnement) est donc le
// code de production, pas une copie.
//
// Aucune dépendance de test à installer : `node:test` et `node:assert` sont
// livrés avec Node.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const express = require('express');

// --------------------------------------------------------------------------
// 1. Environnement. Ces variables sont lues au CHARGEMENT des modules de
//    routes, elles doivent donc être posées avant tout require de ces routes.
// --------------------------------------------------------------------------
process.env.XOF_TO_USD_RATE = '600'; // 1 USD = 600 FCFA
process.env.APP_URL = 'https://app.test';
process.env.API_PUBLIC_URL = 'https://api.test';
process.env.PAYPAL_CLIENT_ID = 'test-client-id';
process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
process.env.PAYPAL_WEBHOOK_ID = 'test-webhook-id';

const BACKEND = path.join(__dirname, '..');

// Remplace un module du backend dans le cache de require. Tout `require()`
// ultérieur de ce chemin recevra `exports` au lieu du vrai fichier.
function stubModule(relativePath, exports) {
  const file = require.resolve(path.join(BACKEND, relativePath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports, children: [], paths: [] };
}

// --------------------------------------------------------------------------
// 2. Faux Supabase — base de données en mémoire.
//    Reproduit la partie de l'API PostgREST utilisée par les routes :
//    .from().select().eq().maybeSingle() / .single() / .insert() / .update(),
//    le tout « thenable » pour fonctionner avec await.
// --------------------------------------------------------------------------
const db = new Proxy({}, {
  get(tables, name) {
    if (typeof name === 'string' && !tables[name]) tables[name] = [];
    return tables[name];
  }
});

function resetDb() {
  for (const table of Object.keys(db)) db[table].length = 0;
}

function queryBuilder(table) {
  const state = { op: 'select', filters: [], payload: null, singleRow: false };
  const rowMatches = (row) => state.filters.every(([column, value]) => row[column] === value);

  const run = () => {
    const rows = db[table];

    if (state.op === 'insert') {
      const row = { id: rows.length + 1, ...state.payload };
      rows.push(row);
      return { data: state.singleRow ? row : [row], error: null };
    }

    const hits = rows.filter(rowMatches);

    if (state.op === 'update') {
      hits.forEach((row) => Object.assign(row, state.payload));
      return { data: state.singleRow ? hits[0] || null : hits, error: null };
    }

    return { data: state.singleRow ? hits[0] || null : hits, error: null };
  };

  const builder = {
    select() { return builder; },
    eq(column, value) { state.filters.push([column, value]); return builder; },
    insert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
    update(payload) { state.op = 'update'; state.payload = payload; return builder; },
    maybeSingle() { state.singleRow = true; return builder; },
    single() { state.singleRow = true; return builder; },
    then(onOk, onErr) { return Promise.resolve().then(run).then(onOk, onErr); }
  };
  return builder;
}

stubModule('database.js', { supabase: { from: queryBuilder } });

// --------------------------------------------------------------------------
// 3. Faux PayPal. On garde les fonctions PURES du vrai module (xofToUsd,
//    parseEvent) et on ne neutralise que celles qui appellent le réseau.
// --------------------------------------------------------------------------
const realPaypal = require(path.join(BACKEND, 'services/payments/paypal.js'));
const capturedOrders = [];

stubModule('services/payments/paypal.js', {
  ...realPaypal,
  isConfigured: () => true,
  verifyWebhookSignature: async () => ({ ok: true }), // signature réputée valide
  captureOrder: async (orderId) => {
    capturedOrders.push(orderId);
    return { ok: true, status: 'COMPLETED' };
  },
  initiateCheckout: async () => ({
    ok: true,
    provider: 'paypal',
    providerReference: 'ORDER-NEW',
    checkoutUrl: 'https://paypal.test/checkout',
    status: 'pending'
  })
});

// --------------------------------------------------------------------------
// 4. Auth désactivée (on teste les routes, pas le JWT) et Mobile Money simulé.
// --------------------------------------------------------------------------
stubModule('middleware/auth.js', {
  auth: (req, _res, next) => { req.user = { userId: 1, clinicId: 1, role: 'admin' }; next(); },
  checkRole: () => (_req, _res, next) => next()
});

stubModule('services/payments/index.js', {
  initiateCheckoutWithFailover: async () => ({
    ok: true,
    provider: 'bictorys',
    providerReference: 'BICTORYS-1',
    checkoutUrl: 'https://bictorys.test/checkout',
    status: 'pending'
  })
});

// --------------------------------------------------------------------------
// 5. Application de test. `verify` reproduit server.js : il capture le corps
//    brut, indispensable à la vérification de signature des webhooks.
// --------------------------------------------------------------------------
const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use('/api/webhooks', require(path.join(BACKEND, 'routes/webhooks.js')));
app.use('/api/financials', require(path.join(BACKEND, 'routes/financials.js')));

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

// --------------------------------------------------------------------------
// 6. Utilitaires de test
// --------------------------------------------------------------------------
const postJson = (routePath, body) =>
  fetch(baseUrl + routePath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'manual'
  });

const getRaw = (routePath) => fetch(baseUrl + routePath, { redirect: 'manual' });

// Un abonnement Hôpital d'un mois : 14 500 FCFA, soit 24,17 USD au taux 600.
const AMOUNT_XOF = 14500;
const AMOUNT_USD = 24.17;

function seedPendingSubscription(overrides = {}) {
  resetDb();
  capturedOrders.length = 0;
  db.clinics.push({ id: 1, name: 'Clinique Test', plan: 'hopital', subscription_status: 'expired', subscription_expires_at: null });
  db.users.push({ id: 1, clinic_id: 1, name: 'Admin Test', email: 'admin@test.ci' });
  db.subscription_payments.push({
    id: 1,
    clinic_id: 1,
    user_id: 1,
    plan: 'hopital',
    months: 1,
    amount: AMOUNT_XOF,
    provider: 'paypal',
    provider_reference: 'ORDER-CONNU',
    amount_usd: AMOUNT_USD,
    status: 'pending',
    ...overrides
  });
}

// Webhook « capture réussie » tel que PayPal l'envoie : le montant est en USD
// et notre référence maison voyage dans custom_id.
const captureCompletedEvent = (usdValue, currency = 'USD') => ({
  event_type: 'PAYMENT.CAPTURE.COMPLETED',
  resource: {
    id: 'CAPTURE-1',
    custom_id: 'sub-1',
    amount: { value: usdValue, currency_code: currency }
  }
});

const subscriptionStatus = () => db.subscription_payments[0].status;

// ==========================================================================
// Périmètre du retour navigateur (GET /api/webhooks/paypal/return)
// Cette route est PUBLIQUE : elle ne doit capturer que des commandes que ce
// serveur a lui-même créées.
// ==========================================================================
test('retour PayPal : une commande inconnue ne déclenche aucune capture', async () => {
  seedPendingSubscription();

  const res = await getRaw('/api/webhooks/paypal/return?token=ORDER-INCONNU');

  assert.strictEqual(res.status, 302, 'l\'utilisateur doit être redirigé malgré le refus');
  assert.deepStrictEqual(capturedOrders, [], 'aucun appel de capture ne doit partir vers PayPal');
});

test('retour PayPal : une commande connue déclenche la capture', async () => {
  seedPendingSubscription();

  const res = await getRaw('/api/webhooks/paypal/return?token=ORDER-CONNU');

  assert.strictEqual(res.status, 302);
  assert.deepStrictEqual(capturedOrders, ['ORDER-CONNU']);
});

// ==========================================================================
// Vérification du montant (POST /api/webhooks/paypal)
// ==========================================================================
test('montant exact : l\'abonnement est crédité', async () => {
  seedPendingSubscription();

  await postJson('/api/webhooks/paypal', captureCompletedEvent('24.17'));

  assert.strictEqual(subscriptionStatus(), 'paid');
});

test('écart d\'un centime : toléré, l\'abonnement est crédité', async () => {
  seedPendingSubscription();

  await postJson('/api/webhooks/paypal', captureCompletedEvent('24.18'));

  assert.strictEqual(subscriptionStatus(), 'paid');
});

test('sous-paiement de 1,9 % : refusé quand amount_usd est connu', async () => {
  seedPendingSubscription();

  await postJson('/api/webhooks/paypal', captureCompletedEvent('23.70'));

  assert.strictEqual(subscriptionStatus(), 'pending', 'la ligne doit rester pending pour revue manuelle');
});

test('sans amount_usd (migration non passée) : tolérance 2 % conservée', async () => {
  // La colonne amount_usd n'existe pas encore sur la base live. Le code
  // reconvertit alors au taux courant, qui a pu bouger depuis le checkout :
  // une colonne absente ne doit pas bloquer un paiement légitime.
  seedPendingSubscription({ amount_usd: null });

  await postJson('/api/webhooks/paypal', captureCompletedEvent('23.70'));

  assert.strictEqual(subscriptionStatus(), 'paid');
});

test('devise autre que USD : refusée', async () => {
  seedPendingSubscription();

  await postJson('/api/webhooks/paypal', captureCompletedEvent('24.17', 'EUR'));

  assert.strictEqual(subscriptionStatus(), 'pending');
});

// ==========================================================================
// Checkout d'abonnement (POST /api/financials/subscription/checkout)
// ==========================================================================
test('checkout PayPal : un téléphone invalide ne bloque pas le paiement', async () => {
  // Le formulaire envoie le même champ téléphone quel que soit le bouton
  // cliqué, mais PayPal n'en fait aucun usage.
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique Test', plan: 'hopital' });
  db.users.push({ id: 1, clinic_id: 1, name: 'Admin Test', email: 'admin@test.ci' });

  const res = await postJson('/api/financials/subscription/checkout', {
    months: 1,
    provider: 'paypal',
    phoneNumber: 'pas-un-numero'
  });

  assert.strictEqual(res.status, 201, await res.text());
});

test('checkout Mobile Money : un téléphone invalide est refusé', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique Test', plan: 'hopital' });
  db.users.push({ id: 1, clinic_id: 1, name: 'Admin Test', email: 'admin@test.ci' });

  const res = await postJson('/api/financials/subscription/checkout', {
    months: 1,
    provider: 'mobile_money',
    phoneNumber: 'pas-un-numero'
  });
  const body = await res.text();

  assert.strictEqual(res.status, 400);
  assert.match(body, /num(é|e)ro|t(é|e)l(é|e)phone/i, 'le motif du refus doit bien être le téléphone');
});
