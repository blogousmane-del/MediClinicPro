const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'admin' }));

const financials = require(path.join(BACKEND, 'routes', 'financials.js'));
const deposits = require(path.join(BACKEND, 'routes', 'deposits.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/financials', financials], ['/api/deposits', deposits]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const postJson = (url, body) => fetch(`${baseUrl}${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

function seed() {
  db.clinics.push({ id: 1, plan: 'hopital' });
  db.patients.push({ id: 1, clinic_id: 1, first_name: 'Awa', last_name: 'Kone' });
}

test('un paiement patient en Mobile Money est refuse', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: 7500, paymentMethod: 'wave', items: [{ name: 'Consultation', cost: 7500 }]
  });

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /esp(e|è)ces/i);
  assert.strictEqual(db.payments.length, 0, 'aucune ligne de paiement ne doit etre creee');
});

test('le refus vaut meme pour le plan le plus complet', async () => {
  // La restriction ne depend plus du plan : Chariow ne sait pas prendre un
  // montant libre, quel que soit l'abonnement de la clinique.
  resetDb();
  db.clinics.push({ id: 1, plan: 'hopital' });
  db.patients.push({ id: 1, clinic_id: 1, first_name: 'Awa', last_name: 'Kone' });

  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: 7500, paymentMethod: 'orange_money', items: [{ name: 'Consultation', cost: 7500 }]
  });

  assert.strictEqual(res.status, 400);
});

test('un paiement patient en especes passe toujours', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: 7500, paymentMethod: 'cash', items: [{ name: 'Consultation', cost: 7500 }]
  });

  assert.strictEqual(res.status, 201, await res.text());
  assert.strictEqual(db.payments[0].status, 'paid');
});

test('un depot de garantie en Mobile Money est refuse', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/deposits', {
    patientId: 1, amount: 20000, paymentMethod: 'orange_money'
  });

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /esp(e|è)ces/i);
  assert.strictEqual(db.deposits.length, 0);
});

test('un depot de garantie en especes passe toujours', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/deposits', {
    patientId: 1, amount: 20000, paymentMethod: 'cash', reason: 'Hospitalisation'
  });

  assert.strictEqual(res.status, 201, await res.text());
  assert.strictEqual(db.deposits.length, 1);
});
