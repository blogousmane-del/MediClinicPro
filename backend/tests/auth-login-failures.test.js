// Vérifie que les échecs de connexion sont enregistrés SANS que le message
// renvoyé au client change. Le message identique dans tous les cas est ce qui
// empêche la route de devenir un oracle indiquant quels emails existent.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

process.env.JWT_SECRET = 'secret-de-test';

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', { ...authStub(), JWT_SECRET: 'secret-de-test' });

let server;
let baseUrl;

test.before(async () => {
  server = await startApp([['/api/auth', require(path.join(BACKEND, 'routes/auth.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const login = (email, password) => fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

function seedKnownUser() {
  db.clinics.push({ id: 1, name: 'Clinique Test', subscription_status: 'active', plan: 'hopital' });
  db.users.push({
    id: 1, clinic_id: 1, email: 'admin@test.ci', active: 1, role: 'admin', name: 'Admin',
    password_hash: bcrypt.hashSync('le-bon-mot-de-passe', 8), password_set: true
  });
}

test('email inconnu : echec enregistre, message generique', async () => {
  resetDb();
  const res = await login('inconnu@test.ci', 'peu-importe');
  const body = await res.json();

  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.error, 'Identifiants invalides.');
  assert.strictEqual(db.login_failures.length, 1);
  assert.strictEqual(db.login_failures[0].reason, 'unknown_or_inactive');
  assert.strictEqual(db.login_failures[0].email, 'inconnu@test.ci');
});

test('mot de passe faux : motif distinct, MEME message client', async () => {
  resetDb();
  seedKnownUser();

  const res = await login('admin@test.ci', 'le-mauvais');
  const body = await res.json();

  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.error, 'Identifiants invalides.', 'le message ne doit pas trahir le motif');
  assert.strictEqual(db.login_failures.length, 1);
  assert.strictEqual(db.login_failures[0].reason, 'bad_password');
  assert.strictEqual(db.login_failures[0].clinic_id, 1, 'la clinique est connue dans ce cas');
});

test('les deux motifs produisent une reponse client identique', async () => {
  resetDb();
  seedKnownUser();
  const inconnu = await (await login('personne@test.ci', 'x')).text();
  resetDb();
  seedKnownUser();
  const mauvais = await (await login('admin@test.ci', 'x')).text();

  assert.strictEqual(inconnu, mauvais, 'aucune difference observable cote client');
});

test('l email est normalise avant enregistrement', async () => {
  resetDb();
  await login('  INCONNU@Test.CI  ', 'x');
  assert.strictEqual(db.login_failures[0].email, 'inconnu@test.ci');
});

test('une connexion reussie n enregistre aucun echec', async () => {
  resetDb();
  seedKnownUser();
  const res = await login('admin@test.ci', 'le-bon-mot-de-passe');

  assert.strictEqual(res.status, 200, await res.text());
  assert.strictEqual(db.login_failures.length, 0);
});
