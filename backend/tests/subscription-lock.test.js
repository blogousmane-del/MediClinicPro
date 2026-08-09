// Verrou d'abonnement expiré : après le délai de grâce, les domaines métier se
// ferment en LECTURE aussi, sinon le verrou de l'interface serait cosmétique.
// Monte le VRAI middleware/auth.js — seule la base est remplacée.
process.env.JWT_SECRET = 'secret-de-test-subscription-lock';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { db, resetDb, stubModule, makeSupabaseStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

const { auth } = require(path.join(BACKEND, 'middleware', 'auth.js'));

// Un routeur nu par domaine : on teste le middleware, pas les routes réelles.
const echo = (req, res) => res.json({ ok: true });
const router = express.Router();
router.all('/patients', auth, echo);
router.all('/patients/:id', auth, echo);
router.all('/financials/stats', auth, echo);
router.all('/financials/subscription/checkout', auth, echo);
router.all('/settings/plans', auth, echo);
router.all('/auth/me', auth, echo);
router.all('/notifications', auth, echo);
router.all('/platform/overview', auth, echo);

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api', router]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const token = jwt.sign({ userId: 1, clinicId: 1, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
const call = (url, method = 'GET') => fetch(`${baseUrl}${url}`, {
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: method === 'GET' ? undefined : '{}'
});

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const daysAhead = (n) => new Date(Date.now() + n * DAY).toISOString();

function seed({ expiresAt, suspended = false }) {
  resetDb();
  db.users.push({ id: 1, clinic_id: 1, active: 1 });
  db.clinics.push({
    id: 1,
    subscription_status: 'trial',
    subscription_expires_at: expiresAt,
    suspended_by_platform: suspended
  });
}

test('abonnement valide : tout passe', async () => {
  seed({ expiresAt: daysAhead(5) });

  assert.strictEqual((await call('/api/patients')).status, 200);
  assert.strictEqual((await call('/api/patients', 'POST')).status, 200);
});

test('expire depuis 1 jour : lecture permise, ecriture refusee (delai de grace)', async () => {
  seed({ expiresAt: daysAgo(1) });

  assert.strictEqual((await call('/api/patients')).status, 200, 'la grace laisse consulter les dossiers');

  const write = await call('/api/patients', 'POST');
  assert.strictEqual(write.status, 403);
  assert.strictEqual((await write.json()).code, 'SUBSCRIPTION_EXPIRED');
});

test('dernier jour de grace : la lecture passe encore', async () => {
  // 2 jours écoulés sur 3 : le verrou ne doit pas tomber en avance.
  seed({ expiresAt: daysAgo(2) });

  assert.strictEqual((await call('/api/patients')).status, 200);
});

test('expire depuis 5 jours : la lecture est verrouillee', async () => {
  seed({ expiresAt: daysAgo(5) });

  const res = await call('/api/patients');
  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.code, 'SUBSCRIPTION_LOCKED');
  assert.ok(body.graceEndsAt, 'la reponse indique quand le verrou est tombe');
});

test('verrouille : les sous-ressources metier sont fermees aussi', async () => {
  seed({ expiresAt: daysAgo(5) });

  assert.strictEqual((await call('/api/patients/42')).status, 403);
  assert.strictEqual((await call('/api/financials/stats')).status, 403);
});

// Le tunnel de paiement vit sous /api/financials, domaine verrouillé : si
// l'exemption ne passait pas en premier, la clinique serait enfermée dehors,
// sans aucun moyen de payer pour rouvrir.
test('verrouille : le tunnel de paiement reste ouvert', async () => {
  seed({ expiresAt: daysAgo(30) });

  assert.strictEqual((await call('/api/financials/subscription/checkout', 'POST')).status, 200);
});

test('verrouille : profil, reglages, notifications et console plateforme restent ouverts', async () => {
  seed({ expiresAt: daysAgo(30) });

  assert.strictEqual((await call('/api/auth/me')).status, 200);
  assert.strictEqual((await call('/api/settings/plans')).status, 200);
  assert.strictEqual((await call('/api/notifications')).status, 200);
  assert.strictEqual((await call('/api/platform/overview')).status, 200);
});

// Payer ne lève pas une suspension plateforme : inviter à payer serait envoyer
// la clinique dépenser de l'argent pour rien.
test('verrouille ET suspendu : le message de suspension gagne', async () => {
  seed({ expiresAt: daysAgo(30), suspended: true });

  const res = await call('/api/patients');
  assert.strictEqual(res.status, 403);
  assert.strictEqual((await res.json()).code, 'ACCOUNT_SUSPENDED');
});

// Un statut 'expired' posé à la main, sans date, n'offre aucun point de départ
// à la grâce.
test('statut expired sans date : verrou immediat', async () => {
  resetDb();
  db.users.push({ id: 1, clinic_id: 1, active: 1 });
  db.clinics.push({ id: 1, subscription_status: 'expired', subscription_expires_at: null, suspended_by_platform: false });

  assert.strictEqual((await call('/api/patients')).status, 403);
});
