const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('utils/platformSettings.js', {
  getSettings: async () => ({ values: {}, tableMissing: false }),
  getSecret: async (key) => (key === 'chariow_webhook_secret' ? 'le-bon-secret' : null),
  setSecret: async () => ({ ok: true }),
  hasSecret: async () => true,
  setSetting: async () => ({ ok: true }),
  DEFAULTS: {},
  SECRET_KEYS: [],
  isMissingRelation: () => false
});

const reconciled = [];
stubModule('services/payments/chariowReconcile.js', {
  reconcileChariowSubscription: async (id) => { reconciled.push(id); return { status: 'paid' }; },
  selectReconcilable: (rows) => rows,
  FAILED_RETRY_DAYS: 14
});

const webhooksRouter = require(path.join(BACKEND, 'routes', 'webhooks.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/webhooks', webhooksRouter]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const post = (query, body) => fetch(`${baseUrl}/api/webhooks/chariow${query}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

test('un secret faux est rejete', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('?secret=mauvais', { event: 'settled.sale', data: { id: 'sale_1' } });
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(reconciled, [], 'aucune reconciliation ne doit etre declenchee');
});

test('un secret absent est rejete', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('', { event: 'settled.sale', data: { id: 'sale_1' } });
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(reconciled, []);
});

test('le corps ne sert qu a trouver la vente, jamais a crediter', async () => {
  resetDb();
  reconciled.length = 0;
  db.subscription_payments.push({ id: 42, provider: 'chariow', provider_reference: 'sale_1', status: 'pending' });

  // Corps hostile : statut et montant mensongers. Ils doivent etre ignores.
  const res = await post('?secret=le-bon-secret', {
    event: 'settled.sale',
    data: { id: 'sale_1', status: 'paid', amount: { value: 999999, currency: 'XOF' } }
  });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(reconciled, [42], 'la ligne est retrouvee par son identifiant de vente');
});

test('les metadonnees portent l identifiant quand elles sont presentes', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('?secret=le-bon-secret', {
    event: 'successful.sale',
    data: { id: 'sale_9', custom_metadata: { subscriptionPaymentId: 7 } }
  });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(reconciled, [7]);
});

test('une vente inconnue de cette installation est ignoree sans erreur', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('?secret=le-bon-secret', { event: 'settled.sale', data: { id: 'sale_inconnue' } });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(reconciled, []);
});

test('un evenement inconnu repond 200 sans rien faire', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('?secret=le-bon-secret', { event: 'product.viewed', data: { id: 'x' } });
  assert.strictEqual(res.status, 200, 'un 4xx/5xx provoquerait des rejeux inutiles');
  assert.deepStrictEqual(reconciled, []);
});
