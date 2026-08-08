const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

process.env.APP_URL = 'https://app.test';

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'admin' }));

let checkoutResponse = null;
let lastCheckoutArgs = null;
stubModule('services/payments/chariow.js', {
  isConfigured: async () => true,
  productIdFor: (products, plan, months) => (products || {})[`${plan}_${months}`] || null,
  loadConfig: async () => ({
    apiKey: 'k',
    apiUrl: 'https://api.chariow.test/v1',
    products: { hopital_1: 'prod_h1', clinique_1: 'prod_c1' }
  }),
  createCheckout: async (args) => { lastCheckoutArgs = args; return checkoutResponse; },
  resolveChariowPhone: () => ({ number: '700000000', country_code: 'CI' }),
  clearConfigCache: () => {}
});

const reconciled = [];
stubModule('services/payments/chariowReconcile.js', {
  reconcileChariowSubscription: async (id) => { reconciled.push(id); return { status: 'paid' }; },
  selectReconcilable: (rows) => rows,
  FAILED_RETRY_DAYS: 14
});

const financials = require(path.join(BACKEND, 'routes', 'financials.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/financials', financials]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const postJson = (url, body) => fetch(`${baseUrl}${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const checkout = (body) => postJson('/api/financials/subscription/checkout', body);

function seedClinic(plan = 'hopital') {
  db.clinics.push({ id: 1, name: 'Clinique A', plan });
}

test('un checkout nominal enregistre la vente et renvoie l URL', async () => {
  resetDb();
  seedClinic();
  checkoutResponse = {
    ok: true, saleId: 'sale_1', checkoutUrl: 'https://pay.chariow.test/s/1',
    amount: { value: 14500, currency: 'XOF' }
  };

  const res = await checkout({ months: 1, planId: 'hopital', phone: '+2250700000000', phoneCountry: 'CI', phoneLocal: '0700000000' });
  const body = await res.json();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(body.provider, 'chariow');
  assert.strictEqual(body.checkoutUrl, 'https://pay.chariow.test/s/1');

  const row = db.subscription_payments[0];
  assert.strictEqual(row.provider, 'chariow');
  assert.strictEqual(row.provider_reference, 'sale_1');
  assert.strictEqual(row.status, 'pending', "le plan n'est jamais bascule au checkout");
  assert.strictEqual(row.amount, 14500);
});

test('les metadonnees et l URL de retour portent l identifiant de la ligne', async () => {
  resetDb();
  seedClinic();
  checkoutResponse = {
    ok: true, saleId: 'sale_1', checkoutUrl: 'https://pay.chariow.test/s/1',
    amount: { value: 14500, currency: 'XOF' }
  };

  await checkout({ months: 1, planId: 'hopital' });

  const id = db.subscription_payments[0].id;
  assert.strictEqual(lastCheckoutArgs.metadata.subscriptionPaymentId, id);
  assert.strictEqual(lastCheckoutArgs.redirectUrl, `https://app.test/?checkout=chariow&sub=${id}`);
});

test('un produit non configure nomme la combinaison manquante', async () => {
  resetDb();
  seedClinic();
  const res = await checkout({ months: 6, planId: 'hopital' });
  const body = await res.json();

  assert.strictEqual(res.status, 502);
  assert.match(body.error, /hopital_6/);
  assert.strictEqual(db.subscription_payments.length, 0, 'aucune ligne creee sans produit');
});

test('un prix Chariow divergent fait echouer le checkout', async () => {
  resetDb();
  seedClinic();
  // Produit mal rattache : 5 000 F pour ce qui doit couter 14 500 F.
  checkoutResponse = {
    ok: true, saleId: 'sale_2', checkoutUrl: 'https://pay.chariow.test/s/2',
    amount: { value: 5000, currency: 'XOF' }
  };

  const res = await checkout({ months: 1, planId: 'hopital' });
  const body = await res.json();

  assert.strictEqual(res.status, 502);
  assert.match(body.error, /montant|ne correspond pas/i);
  assert.strictEqual(db.subscription_payments[0].status, 'failed');
});

test('une devise non XOF fait echouer le checkout', async () => {
  resetDb();
  seedClinic();
  checkoutResponse = {
    ok: true, saleId: 'sale_3', checkoutUrl: 'https://pay.chariow.test/s/3',
    amount: { value: 14500, currency: 'USD' }
  };

  const res = await checkout({ months: 1, planId: 'hopital' });
  assert.strictEqual(res.status, 502);
  assert.match((await res.json()).error, /XOF/);
  assert.strictEqual(db.subscription_payments[0].status, 'failed');
});

test('le plan Starter ne passe jamais par un paiement', async () => {
  resetDb();
  seedClinic();
  const res = await checkout({ months: 1, planId: 'starter' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.subscription_payments.length, 0);
});

test('une duree hors 1/3/6/12 est refusee', async () => {
  resetDb();
  seedClinic();
  const res = await checkout({ months: 2, planId: 'hopital' });
  assert.strictEqual(res.status, 400);
});

test('verify relaie vers la reconciliation pour sa propre clinique', async () => {
  resetDb();
  reconciled.length = 0;
  db.subscription_payments.push({ id: 5, clinic_id: 1, provider: 'chariow', status: 'pending' });

  const res = await postJson('/api/financials/subscription/verify', { subscriptionPaymentId: 5 });
  const body = await res.json();

  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.status, 'paid');
  assert.deepStrictEqual(reconciled, [5]);
});

test('verify refuse une ligne d une autre clinique', async () => {
  resetDb();
  reconciled.length = 0;
  db.subscription_payments.push({ id: 5, clinic_id: 99, provider: 'chariow', status: 'pending' });

  const res = await postJson('/api/financials/subscription/verify', { subscriptionPaymentId: 5 });

  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(reconciled, [], 'aucun appel sortant pour une ligne hors perimetre');
});
