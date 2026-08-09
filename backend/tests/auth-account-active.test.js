// Le jeton JWT vit 24 h et rien ne le révoque : désactiver un compte n'a de
// sens que si le middleware relit users.active à chaque requête. Ces tests
// montent le VRAI middleware/auth.js, seule la base est remplacée.
process.env.JWT_SECRET = 'secret-de-test-auth-account-active';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, resetDb, stubModule, makeSupabaseStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

const { auth } = require(path.join(BACKEND, 'middleware', 'auth.js'));

const router = express.Router();
router.get('/ping', auth, (req, res) => res.json({ ok: true, userId: req.user.userId }));
router.post('/ping', auth, (req, res) => res.json({ ok: true }));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/test', router]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const token = jwt.sign({ userId: 1, clinicId: 1, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '24h' });
const get = (url = '/api/test/ping') => fetch(`${baseUrl}${url}`, { headers: { Authorization: `Bearer ${token}` } });

function seedClinic() {
  const inOneYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  db.clinics.push({ id: 1, subscription_status: 'active', subscription_expires_at: inOneYear, suspended_by_platform: false });
}

test('un compte actif passe', async () => {
  resetDb();
  seedClinic();
  db.users.push({ id: 1, clinic_id: 1, active: 1 });

  const res = await get();
  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).userId, 1);
});

test('un compte desactive est refuse immediatement, jeton encore valide ou non', async () => {
  resetDb();
  seedClinic();
  db.users.push({ id: 1, clinic_id: 1, active: 0 });

  const res = await get();
  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.code, 'ACCOUNT_DEACTIVATED');
});

test('la lecture aussi est refusee a un compte desactive', async () => {
  resetDb();
  seedClinic();
  db.users.push({ id: 1, clinic_id: 1, active: 0 });

  const res = await fetch(`${baseUrl}/api/test/ping`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.strictEqual(res.status, 401);
});

test('un compte supprime est refuse', async () => {
  resetDb();
  seedClinic();

  const res = await get();
  assert.strictEqual(res.status, 401);
});

// Le compte est cherché dans SA clinique : un jeton forgé pointant vers une
// autre clinique ne doit pas trouver son utilisateur.
test('le compte est verifie dans la clinique du jeton', async () => {
  resetDb();
  seedClinic();
  db.users.push({ id: 1, clinic_id: 2, active: 1 });

  const res = await get();
  assert.strictEqual(res.status, 401);
});
