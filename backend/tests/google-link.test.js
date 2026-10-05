// Pré-détournement de compte (audit du 2026-10-05). L'inscription par mot de
// passe ne vérifie pas l'adresse : un tiers pouvait créer le compte d'un
// médecin, puis garder l'accès quand le vrai médecin s'y connectait par Google.
// Au premier rattachement Google, l'ancien mot de passe est donc désactivé.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

process.env.JWT_SECRET = 'secret-de-test';
process.env.GOOGLE_CLIENT_ID = 'client-google-de-test';

// google-auth-library ne sort pas de la machine : verifyIdToken renvoie la
// charge utile choisie par chaque test.
let googlePayload = null;
const googleLib = require.resolve('google-auth-library', { paths: [BACKEND] });
require.cache[googleLib] = {
  id: googleLib, filename: googleLib, loaded: true, children: [], paths: [],
  exports: { OAuth2Client: class { async verifyIdToken() { return { getPayload: () => googlePayload }; } } }
};

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', { ...authStub(), JWT_SECRET: 'secret-de-test' });

const authRoutes = require(path.join(BACKEND, 'routes', 'auth.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/auth', authRoutes]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const INTRUDER_PASSWORD = 'mot-de-passe-de-l-intrus';

function seed({ passwordSet = true, priorActions = [] } = {}) {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique Test', plan: 'starter' });
  db.users.push({
    id: 1, clinic_id: 1, name: 'Dr Kone', email: 'dr.kone@test.ci', role: 'admin', active: 1,
    password_set: passwordSet, password_hash: bcrypt.hashSync(INTRUDER_PASSWORD, 4),
    availability_status: 'available', work_schedule: null
  });
  priorActions.forEach((action, i) => db.activity_logs.push({ id: i + 1, clinic_id: 1, user_id: 1, action }));
  googlePayload = { email: 'dr.kone@test.ci', email_verified: true, name: 'Dr Kone' };
}

const googleLogin = () => fetch(`${baseUrl}/api/auth/google`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: 'jeton' })
});

test('premier rattachement Google : le mot de passe d origine est desactive', async () => {
  seed();
  const res = await googleLogin();
  const body = await res.json();
  assert.strictEqual(res.status, 200, JSON.stringify(body));
  assert.strictEqual(body.passwordReset, true);
  assert.strictEqual(body.user.passwordSet, false);
  assert.strictEqual(db.users[0].password_set, false);
  assert.strictEqual(bcrypt.compareSync(INTRUDER_PASSWORD, db.users[0].password_hash), false,
    'l ancien mot de passe ne doit plus ouvrir le compte');
  assert.ok(db.activity_logs.some((l) => l.action === 'GOOGLE_LINK_PASSWORD_RESET'));
});

test('connexion Google suivante : le mot de passe choisi ensuite reste valable', async () => {
  seed({ priorActions: ['LOGIN_GOOGLE'] });
  const before = db.users[0].password_hash;
  const body = await (await googleLogin()).json();
  assert.strictEqual(body.passwordReset, false);
  assert.strictEqual(db.users[0].password_hash, before);
});

test('compte ne via Google puis dote d un mot de passe : rien n est desactive', async () => {
  seed({ priorActions: ['REGISTER_GOOGLE'] });
  const before = db.users[0].password_hash;
  const body = await (await googleLogin()).json();
  assert.strictEqual(body.passwordReset, false);
  assert.strictEqual(db.users[0].password_hash, before);
});

test('compte Google sans mot de passe : rien a desactiver', async () => {
  seed({ passwordSet: false });
  const before = db.users[0].password_hash;
  const body = await (await googleLogin()).json();
  assert.strictEqual(body.passwordReset, false);
  assert.strictEqual(db.users[0].password_hash, before);
});
