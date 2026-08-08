// Fichier a part : il remplace routes/webhooks.js par un creditSubscription qui
// echoue, ce que les autres tests de reconciliation ne veulent surtout pas.
// node --test isole chaque fichier dans son propre processus, donc le stub ne
// deborde pas.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

let saleResponse = null;
stubModule('services/payments/chariow.js', { getSale: async () => saleResponse });

let creditShouldFail = true;
const credited = [];
stubModule('routes/webhooks.js', {
  creditSubscription: async (row) => {
    if (creditShouldFail) throw new Error('base indisponible');
    credited.push(row.id);
  }
});

const { reconcileChariowSubscription } = require(path.join(BACKEND, 'services', 'payments', 'chariowReconcile.js'));

function seedPending() {
  db.clinics.push({ id: 1, name: 'Clinique A', subscription_status: 'active', subscription_expires_at: null });
  db.subscription_payments.push({
    id: 1, clinic_id: 1, user_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'chariow', provider_reference: 'sale_1', status: 'pending',
    created_at: '2026-08-01T10:00:00.000Z', paid_at: null
  });
}

test('un credit qui echoue remet la ligne en attente au lieu de la laisser payee', async () => {
  resetDb();
  seedPending();
  creditShouldFail = true;
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  // Sans ce retour en arriere, les trois chemins de credit sortiraient
  // desormais sur status === 'paid' : argent encaisse, echeance jamais
  // prolongee, et plus rien pour rattraper.
  assert.strictEqual(result.status, 'pending');
  assert.strictEqual(db.subscription_payments[0].status, 'pending');
  assert.strictEqual(db.subscription_payments[0].paid_at, null);
});

test('la tentative suivante credite normalement', async () => {
  resetDb();
  seedPending();
  credited.length = 0;
  creditShouldFail = false;
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'paid');
  assert.strictEqual(db.subscription_payments[0].status, 'paid');
  assert.deepStrictEqual(credited, [1]);
});
