const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

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
  server = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform-security.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const nowIso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60000).toISOString();
const getJson = (routePath) => fetch(baseUrl + routePath).then((r) => r.json());

// ==========================================================================
// GET /security/logins
// ==========================================================================
test('agrege les echecs par IP et signale le bourrage', async () => {
  resetDb();
  for (let i = 0; i < 12; i++) {
    db.login_failures.push({
      id: i + 1, email: `cible${i}@test.ci`, clinic_id: null,
      reason: 'unknown_or_inactive', ip_address: '203.0.113.9', created_at: nowIso(5)
    });
  }
  db.login_failures.push({
    id: 99, email: 'oubli@test.ci', clinic_id: 1,
    reason: 'bad_password', ip_address: '198.51.100.2', created_at: nowIso(5)
  });

  const body = await getJson('/api/platform/security/logins');

  const attacker = body.topIps.find((r) => r.ip === '203.0.113.9');
  const normal = body.topIps.find((r) => r.ip === '198.51.100.2');
  assert.strictEqual(attacker.count, 12);
  assert.strictEqual(attacker.suspicious, true, '12 echecs en une heure doit etre signale');
  assert.strictEqual(normal.suspicious, false, 'un seul echec ne doit pas etre signale');
  assert.strictEqual(body.total24h, 13);
});

test('un echec ancien ne declenche pas le signal de bourrage', async () => {
  resetDb();
  for (let i = 0; i < 12; i++) {
    db.login_failures.push({
      id: i + 1, email: 'x@test.ci', clinic_id: null,
      reason: 'bad_password', ip_address: '203.0.113.9', created_at: nowIso(180)
    });
  }
  const body = await getJson('/api/platform/security/logins');
  const row = body.topIps.find((r) => r.ip === '203.0.113.9');
  assert.strictEqual(row.suspicious, false, 'le seuil porte sur la derniere heure');
  assert.strictEqual(body.total24h, 12, 'mais ils comptent bien sur 24h');
});

test('table absente : repond 200 avec tableMissing', async () => {
  resetDb();
  const { supabase } = require(path.join(BACKEND, 'database.js'));
  const original = supabase.from;
  supabase.from = () => ({
    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }) }) })
  });
  try {
    const res = await fetch(`${baseUrl}/api/platform/security/logins`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.tableMissing, true);
    assert.deepStrictEqual(body.recent, []);
  } finally {
    supabase.from = original;
  }
});

// ==========================================================================
// GET /security/audit
// ==========================================================================
test('le journal d audit marque les actions Super Admin', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A' });
  db.users.push({ id: 7, clinic_id: 1, name: 'Ops', email: 'ops@test.ci' });
  db.activity_logs.push({
    id: 1, clinic_id: 1, user_id: 7, action: 'PLATFORM_SUSPEND',
    details: 'Clinique suspendue', ip_address: '1.1.1.1', created_at: nowIso(1)
  });
  db.activity_logs.push({
    id: 2, clinic_id: 1, user_id: 7, action: 'PATIENT_CREATE',
    details: 'Patient cree', ip_address: '1.1.1.1', created_at: nowIso(2)
  });

  const body = await getJson('/api/platform/security/audit');

  const platformRow = body.rows.find((r) => r.action === 'PLATFORM_SUSPEND');
  const clinicRow = body.rows.find((r) => r.action === 'PATIENT_CREATE');
  assert.strictEqual(platformRow.isPlatformAction, true);
  assert.strictEqual(clinicRow.isPlatformAction, false);
  assert.strictEqual(platformRow.clinicName, 'Clinique A');
  assert.strictEqual(platformRow.userName, 'Ops');
});

test('le journal d audit filtre par action', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A' });
  db.activity_logs.push({ id: 1, clinic_id: 1, user_id: null, action: 'LOGIN', details: '', created_at: nowIso(1) });
  db.activity_logs.push({ id: 2, clinic_id: 1, user_id: null, action: 'PATIENT_CREATE', details: '', created_at: nowIso(1) });

  const body = await getJson('/api/platform/security/audit?action=LOGIN');
  assert.strictEqual(body.rows.length, 1);
  assert.strictEqual(body.rows[0].action, 'LOGIN');
  assert.ok(body.actions.includes('LOGIN'));
});

test('le journal d audit pagine', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A' });
  for (let i = 0; i < 60; i++) {
    db.activity_logs.push({ id: i + 1, clinic_id: 1, user_id: null, action: 'LOGIN', details: '', created_at: nowIso(i) });
  }

  const first = await getJson('/api/platform/security/audit');
  assert.strictEqual(first.rows.length, 50);
  assert.strictEqual(first.hasMore, true);

  const second = await getJson('/api/platform/security/audit?page=1');
  assert.strictEqual(second.rows.length, 10);
  assert.strictEqual(second.hasMore, false);
});

// ==========================================================================
// GET /security/posture
// ==========================================================================
test('la posture repere une clinique sans admin actif', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Avec admin', suspended_by_platform: false });
  db.clinics.push({ id: 2, name: 'Sans admin', suspended_by_platform: false });
  db.clinics.push({ id: 3, name: 'Suspendue', suspended_by_platform: true });
  db.users.push({ id: 1, clinic_id: 1, role: 'admin', active: 1, password_set: true });
  db.users.push({ id: 2, clinic_id: 2, role: 'doctor', active: 1, password_set: true });
  db.users.push({ id: 3, clinic_id: 2, role: 'admin', active: 0, password_set: true });
  db.users.push({ id: 4, clinic_id: 1, role: 'doctor', active: 1, password_set: false });

  const body = await getJson('/api/platform/security/posture');

  assert.deepStrictEqual(body.clinicsWithoutActiveAdmin.map((c) => c.id), [2, 3]);
  assert.deepStrictEqual(body.suspendedClinics.map((c) => c.id), [3]);
  assert.strictEqual(body.deactivatedUsers, 1);
  assert.strictEqual(body.googleOnlyAccounts, 1);
  assert.strictEqual(body.superAdminCount, 1);
});

test('la posture signale le repli memoire de la limitation de debit', async () => {
  resetDb();
  const body = await getJson('/api/platform/security/posture');
  assert.strictEqual(body.rateLimitBackend, 'memory');
});
