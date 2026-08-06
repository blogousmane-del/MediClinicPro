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
