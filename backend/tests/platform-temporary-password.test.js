// Tant que la réinitialisation par e-mail n'existe pas, une personne bloquée
// écrit sur WhatsApp ; l'exploitant vérifie son identité puis génère ici un mot
// de passe temporaire. Affiché une fois, jamais journalisé en clair.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 99, clinicId: 7, role: 'admin' }));
stubModule('middleware/superAdmin.js', {
  superAdminOnly: (_req, _res, next) => next(),
  SUPER_ADMIN_EMAILS: ['ops@test.ci']
});

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform.js'))]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const reset = (id) => fetch(`${baseUrl}/api/platform/users/${id}/temporary-password`, {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}'
});

function seed() {
  resetDb();
  db.users.push({ id: 5, clinic_id: 3, name: 'Awa Diarra', email: 'awa@clinique.ci', role: 'admin', active: 1, password_set: false, password_hash: 'ancien' });
  db.users.push({ id: 99, clinic_id: 7, name: 'Ops', email: 'ops@test.ci', role: 'admin', active: 1, password_set: true, password_hash: 'ops' });
}

test('genere un mot de passe temporaire qui ouvre le compte', async () => {
  seed();
  const res = await reset(5);
  const body = await res.json();
  assert.strictEqual(res.status, 200, JSON.stringify(body));
  assert.match(body.temporaryPassword, /^[A-Za-z0-9]{12}$/);
  assert.ok(bcrypt.compareSync(body.temporaryPassword, db.users[0].password_hash));
  assert.strictEqual(bcrypt.getRounds(db.users[0].password_hash), 12);
  assert.strictEqual(db.users[0].password_set, true);
});

test('journalise contre la clinique du compte, sans le mot de passe', async () => {
  seed();
  const body = await (await reset(5)).json();
  const log = db.activity_logs.find((l) => l.action === 'PLATFORM_USER_PASSWORD_RESET');
  assert.ok(log, 'une ligne de journal est attendue');
  assert.strictEqual(log.clinic_id, 3);
  assert.strictEqual(log.user_id, 99);
  assert.ok(!JSON.stringify(db.activity_logs).includes(body.temporaryPassword));
});

test('refuse pour son propre compte', async () => {
  seed();
  const res = await reset(99);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.users[1].password_hash, 'ops');
});

test('compte inconnu : 404', async () => {
  seed();
  assert.strictEqual((await reset(12345)).status, 404);
});

test('identifiant non numerique : 400', async () => {
  seed();
  assert.strictEqual((await reset('abc')).status, 400);
});
