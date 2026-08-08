const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

// Secrets volontairement reconnaissables : un test vérifie qu'aucun d'eux ne
// ressort dans le corps de la réponse.
process.env.PAYPAL_CLIENT_ID = 'un-secret-tres-secret';
process.env.PAYPAL_CLIENT_SECRET = 'un-autre-secret';
process.env.PAYPAL_MODE = 'https://sandbox.paypal.com'; // volontairement invalide
process.env.PAYPAL_WEBHOOK_ID = 'WEBHOOK-TEST';
process.env.API_PUBLIC_URL = 'https://api.test';
process.env.APP_URL = 'https://app.test';
process.env.RESEND_API_KEY = 'cle-resend-secrete';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub());
stubModule('middleware/superAdmin.js', {
  superAdminOnly: (_req, _res, next) => next(),
  SUPER_ADMIN_EMAILS: ['ops@test.ci']
});

let server;
let baseUrl;

test.before(async () => {
  server = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform-config.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const getConfig = () => fetch(`${baseUrl}/api/platform/config`);

test('la reponse ne contient AUCUNE valeur de secret', async () => {
  resetDb();
  const body = await (await getConfig()).text();
  assert.ok(!body.includes('un-secret-tres-secret'), 'PAYPAL_CLIENT_ID ne doit jamais sortir');
  assert.ok(!body.includes('un-autre-secret'), 'PAYPAL_CLIENT_SECRET ne doit jamais sortir');
  assert.ok(!body.includes('cle-resend-secrete'), 'RESEND_API_KEY ne doit jamais sortir');
  assert.ok(!body.includes('WEBHOOK-TEST'), 'PAYPAL_WEBHOOK_ID ne doit jamais sortir');
});

test('signale un PAYPAL_MODE non reconnu', async () => {
  resetDb();
  const body = await (await getConfig()).json();
  assert.strictEqual(body.paypal.modeRecognised, false);
  assert.strictEqual(body.paypal.mode, 'sandbox');
});

test('expose les URLs publiques et les plans en lecture seule', async () => {
  resetDb();
  const body = await (await getConfig()).json();
  assert.strictEqual(body.urls.apiPublicUrl, 'https://api.test');
  assert.strictEqual(body.urls.appUrl, 'https://app.test');
  assert.ok(Array.isArray(body.plans) && body.plans.length >= 3);
  assert.ok(body.plans.every((p) => typeof p.name === 'string' && typeof p.price === 'number'));
});

test('detecte le canal email et le repli de limitation de debit', async () => {
  resetDb();
  const body = await (await getConfig()).json();
  assert.strictEqual(body.email.channel, 'resend');
  assert.strictEqual(body.rateLimit.backend, 'memory');
});

test('table absente : renvoie les defauts sans 500', async () => {
  resetDb();
  const res = await getConfig();
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.settings.values.starter_trial_days, 7);
});

test('lit un reglage enregistre', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '21' });
  const body = await (await getConfig()).json();
  assert.strictEqual(body.settings.values.starter_trial_days, 21);
});

// --------------------------------------------------------------------------
// PUT /api/platform/config
// --------------------------------------------------------------------------
const putConfig = (body) => fetch(`${baseUrl}/api/platform/config`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

test('starter_trial_days hors bornes est refuse', async () => {
  resetDb();
  assert.strictEqual((await putConfig({ starter_trial_days: 0 })).status, 400);
  assert.strictEqual((await putConfig({ starter_trial_days: 91 })).status, 400);
  assert.strictEqual((await putConfig({ starter_trial_days: 'quatorze' })).status, 400);
});

test('starter_trial_days valide est enregistre et journalise', async () => {
  resetDb();
  const res = await putConfig({ starter_trial_days: 14 });
  assert.strictEqual(res.status, 200, await res.text());
  assert.strictEqual(db.platform_settings.find((r) => r.key === 'starter_trial_days').value, '14');
  assert.strictEqual(db.activity_logs.length, 1);
  assert.strictEqual(db.activity_logs[0].action, 'PLATFORM_CONFIG_UPDATE');
});

test('maintenance_message trop long est refuse', async () => {
  resetDb();
  const res = await putConfig({ maintenance_message: 'x'.repeat(281) });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.platform_settings.length, 0);
});

test('maintenance_message vide est accepte (desactive le bandeau)', async () => {
  resetDb();
  const res = await putConfig({ maintenance_message: '' });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.platform_settings.find((r) => r.key === 'maintenance_message').value, '');
});

test('aucun champ modifiable fourni : refuse', async () => {
  resetDb();
  const res = await putConfig({ plan_price: 99 });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.platform_settings.length, 0, 'aucune ecriture ne doit avoir lieu');
});

// ==========================================================================
// Chariow
// ==========================================================================
test('la config annonce Chariow sans livrer le moindre secret', async () => {
  process.env.CONFIG_ENCRYPTION_KEY = 'c'.repeat(64);
  resetDb();
  const settings = require(path.join(BACKEND, 'utils/platformSettings.js'));
  await settings.setSecret('chariow_api_key', 'sk_live_TOP_SECRET', 1);

  const res = await getConfig();
  const raw = await res.text();

  assert.strictEqual(res.status, 200);
  assert.strictEqual(raw.includes('sk_live_TOP_SECRET'), false, 'aucun secret ne doit sortir');
  const body = JSON.parse(raw);
  assert.strictEqual(body.chariow.apiKey, 'set');
  assert.strictEqual(body.chariow.webhookSecret, 'blank');
  assert.strictEqual(body.chariow.expectedProductKeys.length, 8, 'deux plans payants x quatre durees');
});

test('la correspondance produits refuse une cle hors des 8 combinaisons', async () => {
  resetDb();
  const res = await putConfig({ chariow_products: { hopital_7: 'prod_x' } });
  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /hopital_7/);
  assert.strictEqual(db.platform_settings.length, 0, 'aucune ecriture partielle');
});

test('la correspondance produits accepte les combinaisons valides', async () => {
  resetDb();
  const res = await putConfig({ chariow_products: { hopital_12: 'prod_h12', clinique_1: 'prod_c1' } });
  assert.strictEqual(res.status, 200);
  const stored = JSON.parse(db.platform_settings.find((r) => r.key === 'chariow_products').value);
  assert.strictEqual(stored.hopital_12, 'prod_h12');
});

test('generer le secret de webhook renvoie l URL complete une seule fois', async () => {
  process.env.CONFIG_ENCRYPTION_KEY = 'c'.repeat(64);
  resetDb();

  const put = await putConfig({ chariow_webhook_secret: '__generate__' });
  const putBody = await put.json();
  assert.strictEqual(put.status, 200);
  assert.match(putBody.webhookUrl, /^https:\/\/api\.test\/api\/webhooks\/chariow\?secret=.+/);

  const secret = putBody.webhookUrl.split('secret=')[1];
  const getRaw = await (await getConfig()).text();
  assert.strictEqual(getRaw.includes(secret), false, 'le GET ne redonne jamais le secret');
});
