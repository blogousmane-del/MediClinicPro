// Le middleware n'accepte qu'un algorithme de signature, celui de jwt.sign à la
// connexion (HS256). Sans liste explicite, jsonwebtoken accepte aussi HS384 et
// HS512 avec le même secret : la vérification ne doit pas dépendre des valeurs
// par défaut de la bibliothèque. Ces tests montent le VRAI middleware/auth.js.
process.env.JWT_SECRET = 'secret-de-test-jwt-algorithm';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, resetDb, stubModule, makeSupabaseStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

const { auth } = require(path.join(BACKEND, 'middleware', 'auth.js'));

const router = express.Router();
router.get('/ping', auth, (req, res) => res.json({ ok: true }));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/test', router]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const payload = { userId: 1, clinicId: 1, role: 'doctor' };
const get = (token) => fetch(`${baseUrl}/api/test/ping`, { headers: { Authorization: `Bearer ${token}` } });

function seed() {
  resetDb();
  const inOneYear = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
  db.clinics.push({ id: 1, subscription_status: 'active', subscription_expires_at: inOneYear, suspended_by_platform: false });
  db.users.push({ id: 1, clinic_id: 1, active: 1 });
}

test('un jeton HS256, celui que signe la connexion, passe', async () => {
  seed();
  const res = await get(jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' }));
  assert.strictEqual(res.status, 200);
});

test('le bon secret ne suffit pas avec un autre algorithme', async () => {
  seed();
  for (const algorithm of ['HS384', 'HS512']) {
    const res = await get(jwt.sign(payload, process.env.JWT_SECRET, { algorithm, expiresIn: '24h' }));
    assert.strictEqual(res.status, 401, algorithm);
  }
});

test('un jeton non signé est refusé', async () => {
  seed();
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...payload, iat: Math.floor(Date.now() / 1000) })}.`;
  const res = await get(unsigned);
  assert.strictEqual(res.status, 401);
});
