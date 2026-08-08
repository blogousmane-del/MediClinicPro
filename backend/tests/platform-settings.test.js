const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
const settings = require(path.join(BACKEND, 'utils/platformSettings.js'));

test('table vide : renvoie les valeurs par defaut', async () => {
  resetDb();
  const { values, tableMissing } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 7);
  assert.strictEqual(values.maintenance_message, '');
  assert.strictEqual(tableMissing, false);
});

test('valeur en base : ecrase le defaut et est typee', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '14' });
  db.platform_settings.push({ key: 'maintenance_message', value: 'Maintenance prevue' });
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 14);
  assert.strictEqual(values.maintenance_message, 'Maintenance prevue');
});

test('valeur illisible : repli sur le defaut', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: 'quatorze' });
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 7);
});

test('valeur hors bornes : repli sur le defaut', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '400' });
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 7);
});

test('isMissingRelation reconnait les codes PostgREST', () => {
  assert.strictEqual(settings.isMissingRelation({ code: 'PGRST205' }), true);
  assert.strictEqual(settings.isMissingRelation({ code: '42703' }), true);
  assert.strictEqual(settings.isMissingRelation({ code: '23505' }), false);
  assert.strictEqual(settings.isMissingRelation(null), false);
});

test('setSetting insere puis met a jour la meme cle', async () => {
  resetDb();
  const first = await settings.setSetting('starter_trial_days', '10', 1);
  assert.strictEqual(first.ok, true);
  assert.strictEqual(db.platform_settings.length, 1);

  const second = await settings.setSetting('starter_trial_days', '21', 1);
  assert.strictEqual(second.ok, true);
  assert.strictEqual(db.platform_settings.length, 1, 'la cle ne doit pas etre dupliquee');
  assert.strictEqual(db.platform_settings[0].value, '21');
});

test('setSetting refuse une cle inconnue', async () => {
  resetDb();
  const result = await settings.setSetting('plan_price', '99', 1);
  assert.strictEqual(result.ok, false);
});

test('un secret est stocke chiffre et jamais rendu par getSettings', async () => {
  process.env.CONFIG_ENCRYPTION_KEY = 'b'.repeat(64);
  resetDb();

  const written = await settings.setSecret('chariow_api_key', 'sk_live_secret_value', 1);
  assert.strictEqual(written.ok, true);

  const row = db.platform_settings.find((r) => r.key === 'chariow_api_key');
  assert.ok(row, 'la ligne doit exister');
  assert.ok(!row.value.includes('sk_live_secret_value'), 'la valeur ne doit pas etre stockee en clair');

  assert.strictEqual(await settings.getSecret('chariow_api_key'), 'sk_live_secret_value');
  assert.strictEqual(await settings.hasSecret('chariow_api_key'), true);

  const read = await settings.getSettings();
  assert.strictEqual(JSON.stringify(read.values).includes('sk_live_secret_value'), false);
  assert.strictEqual(read.values.chariow_api_key, undefined, 'aucun secret dans les reglages lisibles');
});

test('setSecret refuse une cle qui n est pas un secret connu', async () => {
  resetDb();
  const result = await settings.setSecret('mot_de_passe_admin', 'x', 1);
  assert.strictEqual(result.ok, false);
});

test('sans cle de chiffrement, un secret n est jamais ecrit en clair', async () => {
  const saved = process.env.CONFIG_ENCRYPTION_KEY;
  delete process.env.CONFIG_ENCRYPTION_KEY;
  resetDb();

  const result = await settings.setSecret('chariow_api_key', 'sk_live_secret_value', 1);

  assert.strictEqual(result.ok, false);
  assert.match(result.error, /CONFIG_ENCRYPTION_KEY/);
  assert.strictEqual(db.platform_settings.length, 0, 'rien ne doit etre ecrit');

  process.env.CONFIG_ENCRYPTION_KEY = saved;
});

test('les reglages Chariow non secrets ont des defauts utilisables', async () => {
  resetDb();
  const { values } = await settings.getSettings();
  assert.strictEqual(values.chariow_products, '');
  assert.strictEqual(values.chariow_api_url, 'https://api.chariow.com/v1');
});
