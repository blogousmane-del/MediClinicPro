// Vérifie que les réglages de plateforme pilotent bien l'authentification :
// durée de l'essai Starter à l'inscription, message de maintenance sur
// GET /auth/me. La vraie route auth.js est montée ; seuls Supabase et le
// middleware d'authentification sont remplacés.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

process.env.JWT_SECRET = 'secret-de-test';

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', { ...authStub(), JWT_SECRET: 'secret-de-test' });

const settings = require(path.join(BACKEND, 'utils/platformSettings.js'));

let server;
let baseUrl;

test.before(async () => {
  server = await startApp([['/api/auth', require(path.join(BACKEND, 'routes/auth.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

function seedUser() {
  resetDb();
  db.users.push({
    id: 1, clinic_id: 1, name: 'Admin Test', email: 'admin@test.ci',
    role: 'admin', active: 1, password_set: true, availability_status: 'available', work_schedule: null
  });
  db.clinics.push({ id: 1, name: 'Clinique Test', plan: 'starter' });
}

test('la duree d essai suit le reglage plateforme', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '14' });
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 14);
});

test('sans reglage, la duree d essai reste celle de plans.js', async () => {
  resetDb();
  const { getPlan } = require(path.join(BACKEND, 'utils/plans.js'));
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, getPlan('starter').trialDays);
});

test('GET /auth/me expose un message de maintenance vide par defaut', async () => {
  seedUser();
  const res = await fetch(`${baseUrl}/api/auth/me`);
  const raw = await res.text();
  assert.strictEqual(res.status, 200, raw);
  assert.strictEqual(JSON.parse(raw).maintenanceMessage, '');
});

test('GET /auth/me expose le message de maintenance enregistre', async () => {
  seedUser();
  db.platform_settings.push({ key: 'maintenance_message', value: 'Maintenance dimanche 8h-10h' });
  const body = await (await fetch(`${baseUrl}/api/auth/me`)).json();
  assert.strictEqual(body.maintenanceMessage, 'Maintenance dimanche 8h-10h');
});
