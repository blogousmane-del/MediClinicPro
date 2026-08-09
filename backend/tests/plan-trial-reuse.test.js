// L'essai Starter est unique. Sans cette garde, une clinique expirée cliquait
// « Starter » et se redonnait 7 jours, indéfiniment : le verrou d'abonnement se
// contournait en un clic.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'admin' }));

const settings = require(path.join(BACKEND, 'routes', 'settings.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/settings', settings]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const activateStarter = () => fetch(`${baseUrl}/api/settings/plan`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ planId: 'starter' })
});

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * DAY).toISOString();

function seedClinic({ plan, expiresAt, status = 'trial' }) {
  resetDb();
  db.clinics.push({
    id: 1,
    plan,
    subscription_status: status,
    subscription_expires_at: expiresAt,
    unlimited_staff: false
  });
  db.users.push({ id: 1, clinic_id: 1, role: 'admin', active: 1 });
}

test('essai Starter expire : la reactivation gratuite est refusee', async () => {
  seedClinic({ plan: 'starter', expiresAt: daysAgo(10) });

  const res = await activateStarter();

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /essai gratuite est termin/i);
  assert.strictEqual(db.clinics[0].subscription_expires_at, db.clinics[0].subscription_expires_at, 'la date ne bouge pas');
  assert.ok(new Date(db.clinics[0].subscription_expires_at) < new Date(), 'la clinique reste expiree');
});

test('essai Starter en cours : le plan reste activable', async () => {
  seedClinic({ plan: 'starter', expiresAt: daysAhead(3) });

  const res = await activateStarter();

  assert.strictEqual(res.status, 200);
});

// La garde préexistante, conservée : une clinique ayant déjà payé ne redescend
// pas sur le gratuit.
test('historique de paiement : la reactivation gratuite reste refusee', async () => {
  seedClinic({ plan: 'clinique', expiresAt: daysAgo(1), status: 'expired' });
  db.subscription_payments.push({ id: 1, clinic_id: 1, status: 'paid' });

  const res = await activateStarter();

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /abonnement payant/i);
});
