const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub());
stubModule('middleware/superAdmin.js', {
  superAdminOnly: (_req, _res, next) => next(),
  SUPER_ADMIN_EMAILS: ['ops@test.ci']
});

let server;
let baseUrl;

test.before(async () => {
  server = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform-reports.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
const getJson = (routePath) => fetch(baseUrl + routePath).then((r) => r.json());

// ==========================================================================
// GET /reports/revenue
// ==========================================================================
test('le recurrent ne se confond pas avec la somme encaissee', async () => {
  resetDb();
  // Une clinique Hopital active (14 500/mois) qui a payé 12 mois d'avance.
  db.clinics.push({
    id: 1, name: 'Clinique A', plan: 'hopital',
    subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 300 * DAY).toISOString(),
    created_at: isoAgo(400 * DAY)
  });
  db.subscription_payments.push({
    id: 1, clinic_id: 1, plan: 'hopital', months: 12, amount: 174000,
    provider: 'bictorys', status: 'paid', created_at: isoAgo(2 * DAY), paid_at: isoAgo(2 * DAY)
  });

  const body = await getJson('/api/platform/reports/revenue');

  assert.strictEqual(body.collectedThisMonth, 174000, 'encaissé ce mois-ci');
  assert.strictEqual(body.mrr, 14500, 'le récurrent est le prix du plan, pas les 12 mois encaissés');
});

test('les cliniques Starter ne comptent pas dans le recurrent', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Gratuite', plan: 'starter', subscription_status: 'active' });
  const body = await getJson('/api/platform/reports/revenue');
  assert.strictEqual(body.mrr, 0);
});

test('une clinique expiree ne compte pas dans le recurrent', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Expiree', plan: 'hopital', subscription_status: 'expired' });
  const body = await getJson('/api/platform/reports/revenue');
  assert.strictEqual(body.mrr, 0);
});

test('remonte les paiements bloques de plus d une heure', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A', plan: 'hopital', subscription_status: 'expired' });
  db.subscription_payments.push({
    id: 1, clinic_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'paypal', status: 'pending', created_at: isoAgo(3 * HOUR)
  });
  db.subscription_payments.push({
    id: 2, clinic_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'paypal', status: 'pending', created_at: isoAgo(10 * 60 * 1000)
  });

  const body = await getJson('/api/platform/reports/revenue');

  assert.strictEqual(body.stuckPayments.length, 1, 'seul le paiement de plus d une heure compte');
  assert.strictEqual(body.stuckPayments[0].id, 1);
  assert.strictEqual(body.stuckPayments[0].clinicName, 'Clinique A');
});

test('separe renouvellements a venir et cliniques expirees', async () => {
  resetDb();
  db.clinics.push({
    id: 1, name: 'Bientot', plan: 'clinique',
    subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 10 * DAY).toISOString()
  });
  db.clinics.push({
    id: 2, name: 'Expiree', plan: 'clinique',
    subscription_status: 'expired', subscription_expires_at: isoAgo(10 * DAY)
  });
  db.clinics.push({
    id: 3, name: 'Lointaine', plan: 'hopital',
    subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 200 * DAY).toISOString()
  });

  const body = await getJson('/api/platform/reports/revenue');

  assert.deepStrictEqual(body.renewalsDue.map((r) => r.clinicId), [1]);
  assert.deepStrictEqual(body.expiredNotRenewed.map((r) => r.clinicId), [2]);
});

test('le revenu mensuel couvre 12 mois et date du reglement', async () => {
  resetDb();
  db.subscription_payments.push({
    id: 1, clinic_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'paypal', status: 'paid', created_at: isoAgo(2 * DAY), paid_at: isoAgo(2 * DAY)
  });
  // Un paiement encore pending ne doit rien ajouter au revenu.
  db.subscription_payments.push({
    id: 2, clinic_id: 1, plan: 'hopital', months: 1, amount: 99999,
    provider: 'paypal', status: 'pending', created_at: isoAgo(2 * DAY)
  });

  const body = await getJson('/api/platform/reports/revenue');

  assert.strictEqual(body.monthlyRevenue.length, 12);
  const total = body.monthlyRevenue.reduce((sum, m) => sum + m.value, 0);
  assert.strictEqual(total, 14500, 'les paiements non réglés sont exclus');
});

// ==========================================================================
// GET /reports/adoption
// ==========================================================================
test('classe les cliniques actives et dormantes sur 30 jours', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Active', plan: 'hopital', created_at: isoAgo(100 * DAY) });
  db.clinics.push({ id: 2, name: 'Dormante', plan: 'clinique', created_at: isoAgo(100 * DAY) });
  db.activity_logs.push({ id: 1, clinic_id: 1, action: 'PATIENT_CREATE', created_at: isoAgo(3 * DAY) });
  db.activity_logs.push({ id: 2, clinic_id: 2, action: 'PATIENT_CREATE', created_at: isoAgo(90 * DAY) });

  const body = await getJson('/api/platform/reports/adoption');

  assert.strictEqual(body.activeClinics, 1);
  assert.strictEqual(body.dormantClinics, 1);
});

test('compte patients, consultations et utilisateurs actifs par clinique', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A', plan: 'hopital', created_at: isoAgo(50 * DAY) });
  db.patients.push({ id: 1, clinic_id: 1, archived: 0 });
  db.patients.push({ id: 2, clinic_id: 1, archived: 0 });
  db.consultations.push({ id: 1, clinic_id: 1, date_time: isoAgo(2 * DAY) });
  db.users.push({ id: 1, clinic_id: 1, role: 'admin', active: 1 });
  db.users.push({ id: 2, clinic_id: 1, role: 'doctor', active: 0 });

  const body = await getJson('/api/platform/reports/adoption');
  const row = body.perClinic.find((r) => r.clinicId === 1);

  assert.strictEqual(row.patients, 2);
  assert.strictEqual(row.consultations, 1);
  assert.strictEqual(row.activeUsers, 1, 'les comptes desactives ne comptent pas');
  assert.strictEqual(row.plan, 'Hôpital');
});

test('agrege les roles reellement pourvus', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'A', plan: 'hopital' });
  db.users.push({ id: 1, clinic_id: 1, role: 'pharmacist', active: 1 });
  db.users.push({ id: 2, clinic_id: 1, role: 'pharmacist', active: 1 });
  db.users.push({ id: 3, clinic_id: 1, role: 'lab_tech', active: 1 });
  db.users.push({ id: 4, clinic_id: 1, role: 'lab_tech', active: 0 });

  const body = await getJson('/api/platform/reports/adoption');
  const pharmacists = body.rolesFilled.find((r) => r.label === 'pharmacist');
  const labTechs = body.rolesFilled.find((r) => r.label === 'lab_tech');

  assert.strictEqual(pharmacists.value, 2);
  assert.strictEqual(labTechs.value, 1, 'seuls les comptes actifs comptent');
});

test('agrege les tickets par categorie et par statut', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'A', plan: 'hopital' });
  db.support_tickets.push({ id: 1, category: 'technique', status: 'open' });
  db.support_tickets.push({ id: 2, category: 'technique', status: 'closed' });
  db.support_tickets.push({ id: 3, category: 'facturation', status: 'open' });

  const body = await getJson('/api/platform/reports/adoption');

  assert.strictEqual(body.ticketsByCategory.find((r) => r.label === 'technique').value, 2);
  assert.strictEqual(body.ticketsByStatus.find((r) => r.label === 'open').value, 2);
});
