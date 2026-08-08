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
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

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

// --------------------------------------------------------------------------
// 2. Faux Supabase — base de données en mémoire (voir tests/helpers/harness.js).
// --------------------------------------------------------------------------
stubModule('database.js', { supabase: makeSupabaseStub() });

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
stubModule('middleware/auth.js', authStub());

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
// 5. Application de test (voir tests/helpers/harness.js).
// --------------------------------------------------------------------------
let server;
let baseUrl;

test.before(async () => {
  server = await startApp([
    ['/api/webhooks', require(path.join(BACKEND, 'routes/webhooks.js'))],
    ['/api/financials', require(path.join(BACKEND, 'routes/financials.js'))]
  ]);
  baseUrl = server.baseUrl;
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
// Les deux tests qui vivaient ici couvraient la branche `provider` du checkout
// d'abonnement (PayPal contre Mobile Money). Cette branche a été retirée :
// l'abonnement passe désormais exclusivement par Chariow
// (docs/superpowers/specs/2026-08-08-chariow-integration-design.md). Le reste
// de ce fichier — vérification de montant du webhook, contrôle de propriété de
// la commande sur /webhooks/paypal/return — reste valide et doit le rester :
// un paiement PayPal lancé avant la bascule doit encore pouvoir se créditer.
test("le checkout d'abonnement ne repart jamais vers PayPal, même si on le demande", async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique Test', plan: 'hopital' });
  db.users.push({ id: 1, clinic_id: 1, name: 'Admin Test', email: 'admin@test.ci' });

  const res = await postJson('/api/financials/subscription/checkout', {
    months: 1,
    provider: 'paypal'
  });
  const body = await res.text();

  assert.notStrictEqual(res.status, 201, 'aucun checkout PayPal ne doit plus être créé');
  assert.strictEqual(body.includes('paypal.com'), false, "aucune URL d'approbation PayPal ne doit sortir");
  assert.strictEqual(
    db.subscription_payments.length,
    0,
    "aucune ligne de paiement ne doit être créée tant que Chariow n'est pas configuré"
  );
});
