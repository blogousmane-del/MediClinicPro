// Les écrans masqués par rôle dans React doivent l'être aussi côté serveur.
// L'audit du 2026-10-05 a trouvé deux routes où la seule barrière était
// l'interface : le journal des encaissements, lisible par un pharmacien, et la
// création de consultation, qui permettait à un pharmacien de se rédiger une
// ordonnance puis de la délivrer lui-même. Le stub d'auth habituel remplace
// checkRole par un passe-partout : c'est pourquoi aucun test ne l'avait vu.
// Ici, c'est le VRAI checkRole qui tourne.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

const realAuthModule = require(path.join(BACKEND, 'middleware', 'auth.js'));
stubModule('middleware/auth.js', {
  ...realAuthModule,
  // Seule l'authentification est simulée ; le rôle se choisit par requête.
  auth: (req, _res, next) => {
    req.user = { userId: 1, clinicId: 1, role: req.headers['x-test-role'] };
    next();
  }
});

const financials = require(path.join(BACKEND, 'routes', 'financials.js'));
const consultations = require(path.join(BACKEND, 'routes', 'consultations.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/financials', financials], ['/api/consultations', consultations]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const as = (role, url, init = {}) => fetch(`${baseUrl}${url}`, {
  ...init,
  headers: { 'Content-Type': 'application/json', 'x-test-role': role }
});

function seed() {
  resetDb();
  db.clinics.push({ id: 1, plan: 'hopital' });
  db.patients.push({ id: 1, clinic_id: 1, first_name: 'Awa', last_name: 'Kone' });
  db.payments.push({
    id: 1, clinic_id: 1, patient_id: 1, user_id: 1, amount_total: 15000,
    payment_method: 'cash', status: 'paid', items: [], created_at: '2026-10-05T09:00:00.000Z'
  });
}

for (const role of ['pharmacist', 'lab_tech', 'nurse', 'doctor']) {
  test(`journal des encaissements : refuse au role ${role}`, async () => {
    seed();
    const res = await as(role, '/api/financials/payments');
    assert.strictEqual(res.status, 403);
  });
}

for (const role of ['secretary', 'manager', 'admin']) {
  test(`journal des encaissements : ouvert au role ${role}`, async () => {
    seed();
    const res = await as(role, '/api/financials/payments');
    assert.strictEqual(res.status, 200);
    assert.strictEqual((await res.json()).length, 1);
  });
}

test('statut d un paiement : refuse au pharmacien', async () => {
  seed();
  const res = await as('pharmacist', '/api/financials/payments/1/status');
  assert.strictEqual(res.status, 403);
});

const newConsultation = (role) => as(role, '/api/consultations', {
  method: 'POST',
  body: JSON.stringify({
    patientId: 1,
    motif: 'Fièvre',
    prescriptionItems: [{ medicationName: 'Paracétamol', dosage: '500 mg', frequency: '3 fois par jour', duration: '3 jours', quantityPrescribed: 1 }]
  })
});

for (const role of ['pharmacist', 'secretary', 'lab_tech', 'nurse', 'manager']) {
  test(`consultation : refusee au role ${role}`, async () => {
    seed();
    const res = await newConsultation(role);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(db.consultations.length, 0, 'aucune consultation ne doit etre ecrite');
    assert.strictEqual(db.prescriptions.length, 0, 'aucune ordonnance ne doit etre ecrite');
  });
}

for (const role of ['doctor', 'admin']) {
  test(`consultation : acceptee pour le role ${role}`, async () => {
    seed();
    const res = await newConsultation(role);
    assert.ok(res.status < 300, `statut ${res.status}`);
    assert.strictEqual(db.consultations.length, 1);
  });
}
