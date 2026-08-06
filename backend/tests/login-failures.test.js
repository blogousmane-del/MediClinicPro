const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
const failures = require(path.join(BACKEND, 'utils/loginFailures.js'));

test('enregistre un echec avec son motif', async () => {
  resetDb();
  await failures.recordLoginFailure({
    email: 'inconnu@test.ci', clinicId: null,
    reason: failures.REASONS.UNKNOWN_OR_INACTIVE, ip: '10.0.0.1'
  });
  assert.strictEqual(db.login_failures.length, 1);
  assert.strictEqual(db.login_failures[0].email, 'inconnu@test.ci');
  assert.strictEqual(db.login_failures[0].reason, 'unknown_or_inactive');
  assert.strictEqual(db.login_failures[0].ip_address, '10.0.0.1');
});

test('n echoue JAMAIS, meme si la base rejette', async () => {
  resetDb();
  const { supabase } = require(path.join(BACKEND, 'database.js'));
  const original = supabase.from;
  supabase.from = () => { throw new Error('base injoignable'); };
  try {
    await failures.recordLoginFailure({ email: 'x@test.ci', reason: 'bad_password', ip: '1.1.1.1' });
  } finally {
    supabase.from = original;
  }
  // Aucune exception remontee : la connexion doit continuer a fonctionner.
  assert.ok(true);
});

test('ne stocke jamais le mot de passe tente', async () => {
  resetDb();
  await failures.recordLoginFailure({
    email: 'a@test.ci', reason: 'bad_password', ip: '1.1.1.1', password: 'motdepasse-secret'
  });
  const stored = JSON.stringify(db.login_failures[0]);
  assert.ok(!stored.includes('motdepasse-secret'), 'le mot de passe ne doit jamais etre stocke');
});

test('normalise l email', async () => {
  resetDb();
  await failures.recordLoginFailure({ email: '  ADMIN@Test.CI  ', reason: 'bad_password', ip: null });
  assert.strictEqual(db.login_failures[0].email, 'admin@test.ci');
});

test('getRecentFailures signale une table absente sans lever', async () => {
  resetDb();
  const { supabase } = require(path.join(BACKEND, 'database.js'));
  const original = supabase.from;
  supabase.from = () => ({
    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }) }) })
  });
  try {
    const result = await failures.getRecentFailures(10);
    assert.strictEqual(result.tableMissing, true);
    assert.deepStrictEqual(result.rows, []);
  } finally {
    supabase.from = original;
  }
});

test('getRecentFailures renvoie les lignes quand la table existe', async () => {
  resetDb();
  db.login_failures.push({ id: 1, email: 'a@test.ci', clinic_id: null, reason: 'bad_password', ip_address: '1.1.1.1', created_at: new Date().toISOString() });
  const result = await failures.getRecentFailures(10);
  assert.strictEqual(result.tableMissing, false);
  assert.strictEqual(result.rows.length, 1);
});
