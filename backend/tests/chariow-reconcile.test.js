const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

let saleResponse = null;
stubModule('services/payments/chariow.js', {
  getSale: async () => saleResponse
});

const {
  reconcileChariowSubscription,
  selectReconcilable
} = require(path.join(BACKEND, 'services', 'payments', 'chariowReconcile.js'));

function seedPending(overrides = {}) {
  db.clinics.push({ id: 1, name: 'Clinique A', subscription_status: 'active', subscription_expires_at: null });
  db.subscription_payments.push({
    id: 1, clinic_id: 1, user_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'chariow', provider_reference: 'sale_1', status: 'pending',
    created_at: '2026-08-01T10:00:00.000Z', paid_at: null,
    ...overrides
  });
}

test('une vente reglee credite l abonnement a la date du fournisseur', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'paid');
  const row = db.subscription_payments[0];
  assert.strictEqual(row.status, 'paid');
  assert.strictEqual(row.paid_at, '2026-08-04T09:30:00.000Z', "paid_at doit etre la date du fournisseur, jamais l'heure courante");
  assert.strictEqual(db.clinics[0].subscription_status, 'active');
});

test('une vente non reglee ne touche a rien', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'pending', amount: { value: 14500, currency: 'XOF' }, settledAt: null };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'pending');
  assert.strictEqual(db.subscription_payments[0].status, 'pending');
});

test('un montant divergent ne credite pas', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 5000, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'unknown');
  assert.strictEqual(db.subscription_payments[0].status, 'pending', 'la ligne reste en attente pour revue manuelle');
});

test('une devise non XOF ne credite pas', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'USD' }, settledAt: '2026-08-04T09:30:00.000Z' };

  assert.strictEqual((await reconcileChariowSubscription(1)).status, 'unknown');
  assert.strictEqual(db.subscription_payments[0].status, 'pending');
});

test('sans date fournisseur, on retombe sur created_at et jamais sur maintenant', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: null };

  await reconcileChariowSubscription(1);

  assert.strictEqual(db.subscription_payments[0].paid_at, '2026-08-01T10:00:00.000Z');
});

test('une ligne deja payee n est pas recreditee', async () => {
  resetDb();
  seedPending({ status: 'paid', paid_at: '2026-08-02T00:00:00.000Z' });
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'paid');
  assert.strictEqual(db.subscription_payments[0].paid_at, '2026-08-02T00:00:00.000Z', 'la date de reglement ne doit pas bouger');
  assert.strictEqual(db.activity_logs.length, 0, 'aucun second credit');
});

test('une vente echouee chez Chariow passe la ligne en echec', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'failed', amount: { value: 0, currency: 'XOF' }, settledAt: null };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'failed');
  assert.strictEqual(db.subscription_payments[0].status, 'failed');
});

test('une ligne d un autre fournisseur n est jamais touchee', async () => {
  resetDb();
  seedPending({ provider: 'bictorys' });
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'unknown');
  assert.strictEqual(db.subscription_payments[0].status, 'pending');
});

test('le cron ne reprend que les lignes Chariow en attente ou recemment echouees', async () => {
  const recent = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();

  const rows = [
    { id: 1, provider: 'chariow', status: 'pending', created_at: recent },
    { id: 2, provider: 'chariow', status: 'failed', created_at: recent },
    { id: 3, provider: 'chariow', status: 'failed', created_at: old },
    { id: 4, provider: 'chariow', status: 'paid', created_at: recent },
    { id: 5, provider: 'bictorys', status: 'pending', created_at: recent }
  ];

  const ids = selectReconcilable(rows).map((r) => r.id);

  assert.deepStrictEqual(ids, [1, 2], 'ni les payes, ni les echecs anciens, ni les autres fournisseurs');
});
