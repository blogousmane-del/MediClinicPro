// La vitrine annonce la durée d'essai que lui donne GET /settings/public/plans.
// Elle doit être celle qu'applique l'inscription (auth.js : réglage
// starter_trial_days de Platform Admin, repli sur PLANS), pas le 7 écrit en dur
// dans utils/plans.js.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'admin' }));

const settings = require(path.join(BACKEND, 'routes', 'settings.js'));
const { PLANS } = require(path.join(BACKEND, 'utils', 'plans.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/settings', settings]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const getPlans = async () => {
  const res = await fetch(`${baseUrl}/api/settings/public/plans`);
  assert.strictEqual(res.status, 200);
  return (await res.json()).plans;
};

test('la durée d\'essai suit le réglage de la plateforme', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '14' });
  const plans = await getPlans();
  assert.strictEqual(plans.starter.trialDays, 14);
  assert.strictEqual(plans.clinique.price, PLANS.clinique.price);
  assert.strictEqual(PLANS.starter.trialDays, 7, 'PLANS lui-même ne change pas');
});

test('sans réglage, ou avec un réglage illisible, la durée par défaut', async () => {
  resetDb();
  assert.strictEqual((await getPlans()).starter.trialDays, PLANS.starter.trialDays);
  db.platform_settings.push({ key: 'starter_trial_days', value: 'quatorze' });
  assert.strictEqual((await getPlans()).starter.trialDays, PLANS.starter.trialDays);
});
