// GET /api/platform/overview — les variations mensuelles affichées sous les
// cartes de la Vue d'ensemble.
//
// La règle tenue ici : une variation doit porter sur EXACTEMENT la population
// que compte sa carte. Sinon elle contredit le nombre qu'elle commente, et
// c'est la catégorie d'erreur que ce dépôt a déjà eu à corriger ailleurs — un
// chiffre faux affiché avec assurance est pire que pas de chiffre.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 99, clinicId: 7, role: 'admin' }));
stubModule('middleware/superAdmin.js', {
  superAdminOnly: (_req, _res, next) => next(),
  SUPER_ADMIN_EMAILS: ['ops@test.ci']
});

let server;
let baseUrl;

test.before(async () => {
  server = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const getOverview = async () => (await fetch(`${baseUrl}/api/platform/overview`)).json();

const now = new Date();
const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15).toISOString();
const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString();
const future = new Date(now.getTime() + 30 * 24 * 3600 * 1000).toISOString();
const past = new Date(now.getTime() - 30 * 24 * 3600 * 1000).toISOString();

const addClinic = (id, createdAt, expiresAt) => db.clinics.push({
  id, name: `Clinique ${id}`, address: '', plan: 'starter',
  subscription_status: 'active', subscription_expires_at: expiresAt,
  created_at: createdAt, unlimited_staff: false, suspended_by_platform: false
});

test('la variation des cliniques ne compte que les cliniques ACTIVES', async () => {
  resetDb();
  addClinic(1, thisMonth, future); // créée ce mois, toujours active
  addClinic(2, thisMonth, past);   // créée ce mois, déjà expirée
  addClinic(3, lastMonth, future); // active mais pas de ce mois

  const { stats } = await getOverview();
  assert.strictEqual(stats.clinicsActive, 2, 'cliniques 1 et 3');
  // La carte affiche `clinicsActive`. Compter la clinique 2 dans sa variation
  // ferait lire « 2 · +2 ce mois » alors qu'une seule des deux est active.
  assert.strictEqual(stats.clinicsNewThisMonth, 1, 'seule la clinique 1 est à la fois active et de ce mois');
});

test('la variation des utilisateurs compte TOUS les comptes, comme sa carte', async () => {
  resetDb();
  addClinic(1, lastMonth, future);
  db.users.push({ id: 1, clinic_id: 1, role: 'admin', active: 1, created_at: thisMonth });
  db.users.push({ id: 2, clinic_id: 1, role: 'doctor', active: 0, created_at: thisMonth });
  db.users.push({ id: 3, clinic_id: 1, role: 'nurse', active: 1, created_at: lastMonth });

  const { stats } = await getOverview();
  assert.strictEqual(stats.totalUsers, 3, 'la carte compte les comptes désactivés aussi');
  // Symétrique du test précédent : ici la carte ne filtre pas, donc la
  // variation ne doit pas filtrer non plus.
  assert.strictEqual(stats.usersNewThisMonth, 2, 'les deux comptes de ce mois, actif ou non');
});

test('sans encaissement le mois dernier, le pourcentage vaut null', async () => {
  resetDb();
  addClinic(1, lastMonth, future);
  db.subscription_payments.push({ id: 1, clinic_id: 1, amount: 9000, status: 'paid', paid_at: thisMonth });

  const { stats } = await getOverview();
  assert.strictEqual(stats.monthlyRevenue, 9000);
  assert.strictEqual(stats.lastMonthRevenue, 0);
  // Une variation en pourcentage à partir de zéro n'existe pas : « +100 % »
  // comme « +∞ % » seraient inventés. L'interface bascule sur une phrase.
  assert.strictEqual(stats.revenueDeltaPct, null);
});

test('le mois courant n est pas compté dans le mois precedent', async () => {
  resetDb();
  addClinic(1, lastMonth, future);
  db.subscription_payments.push({ id: 1, clinic_id: 1, amount: 10000, status: 'paid', paid_at: thisMonth });
  db.subscription_payments.push({ id: 2, clinic_id: 1, amount: 8000, status: 'paid', paid_at: lastMonth });

  const { stats } = await getOverview();
  assert.strictEqual(stats.monthlyRevenue, 10000);
  assert.strictEqual(stats.lastMonthRevenue, 8000, 'la borne haute doit exclure le mois courant');
  assert.strictEqual(stats.revenueDeltaPct, 25);
});

test('un paiement non regle ne compte dans aucun des deux mois', async () => {
  resetDb();
  addClinic(1, lastMonth, future);
  db.subscription_payments.push({ id: 1, clinic_id: 1, amount: 50000, status: 'pending', paid_at: thisMonth });

  const { stats } = await getOverview();
  assert.strictEqual(stats.monthlyRevenue, 0, "un paiement en attente n'est pas un encaissement");
});
