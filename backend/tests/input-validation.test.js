// Contrôles d'entrée ajoutés après l'audit du 2026-08-09 : robustesse du mot
// de passe à la CRÉATION des comptes (elle n'existait qu'au changement de mot
// de passe), rôle pris dans la liste canonique, montant encaissé numérique et
// strictement positif.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
// JWT_SECRET vient normalement de middleware/auth.js, que le harnais remplace :
// routes/auth.js s'en sert pour signer le jeton renvoyé à l'inscription.
stubModule('middleware/auth.js', {
  ...authStub({ userId: 1, clinicId: 1, role: 'admin' }),
  JWT_SECRET: 'secret-de-test-input-validation'
});
// L'inscription envoie un email de confirmation : on coupe la sortie réseau.
stubModule('utils/mailer.js', {
  sendConfirmationEmail: async () => {},
  sendRenewalReminderEmail: async () => {},
  sendTicketStatusEmail: async () => {}
});

const authRoutes = require(path.join(BACKEND, 'routes', 'auth.js'));
const settings = require(path.join(BACKEND, 'routes', 'settings.js'));
const financials = require(path.join(BACKEND, 'routes', 'financials.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([
    ['/api/auth', authRoutes],
    ['/api/settings', settings],
    ['/api/financials', financials]
  ]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const postJson = (url, body) => fetch(`${baseUrl}${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

function seed() {
  db.clinics.push({ id: 1, plan: 'hopital', unlimited_staff: false });
  db.patients.push({ id: 1, clinic_id: 1, first_name: 'Awa', last_name: 'Kone' });
}

const registerBody = (password) => ({
  clinicName: 'Clinique Test', adminName: 'Awa', email: 'awa@example.com', password, phone: '+2250700000000'
});

test('inscription : un mot de passe trop court est refuse', async () => {
  resetDb();

  const res = await postJson('/api/auth/register', registerBody('court'));

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /8 caract/i);
  assert.strictEqual(db.users.length, 0, 'aucun compte ne doit etre cree');
  assert.strictEqual(db.clinics.length, 0, 'aucune clinique ne doit etre creee');
});

test('inscription : un mot de passe de 8 caracteres passe la validation', async () => {
  resetDb();

  const res = await postJson('/api/auth/register', registerBody('assez-long'));

  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.users.length, 1);
});

test('creation de collaborateur : mot de passe trop court refuse', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/settings/users', {
    name: 'Moussa', email: 'moussa@example.com', password: 'abc', role: 'pharmacist'
  });

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /8 caract/i);
  assert.strictEqual(db.users.length, 0);
});

test('creation de collaborateur : un role inconnu est refuse', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/settings/users', {
    name: 'Moussa', email: 'moussa@example.com', password: 'motdepasse', role: 'directeur'
  });

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /n'existe pas/i);
  assert.strictEqual(db.users.length, 0);
});

test('creation de collaborateur : un role canonique passe', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/settings/users', {
    name: 'Moussa', email: 'moussa@example.com', password: 'motdepasse', role: 'pharmacist'
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.users.length, 1);
  assert.strictEqual(db.users[0].role, 'pharmacist');
});

test('encaissement : un montant negatif est refuse', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: -50000, paymentMethod: 'cash', items: [{ name: 'Consultation', cost: -50000 }]
  });

  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /sup(e|é)rieur a 0|nombre/i);
  assert.strictEqual(db.payments.length, 0);
});

test('encaissement : un montant non numerique est refuse', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: 'beaucoup', paymentMethod: 'cash', items: [{ name: 'Consultation', cost: 1 }]
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.payments.length, 0);
});

test('encaissement : un montant valide est enregistre en nombre', async () => {
  resetDb();
  seed();

  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: '7500', paymentMethod: 'cash', items: [{ name: 'Consultation', cost: 7500 }]
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.payments.length, 1);
  assert.strictEqual(db.payments[0].amount_total, 7500);
});
