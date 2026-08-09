// POST /api/platform/clinics — création d'une clinique et de son admin par
// l'opérateur. Endpoint de création de compte : les règles qui protègent
// l'inscription publique doivent tenir ici à l'identique, sinon la console
// devient la porte par laquelle entrent les comptes mal formés.
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

const createClinic = (body) => fetch(`${baseUrl}/api/platform/clinics`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

const VALID = {
  clinicName: 'Clinique des Deux Plateaux',
  adminName: 'Awa Diarra',
  email: 'awa@clinique.ci',
  password: 'motdepasse8'
};

test('cree la clinique et son administrateur', async () => {
  resetDb();
  const res = await createClinic(VALID);
  assert.strictEqual(res.status, 201);

  assert.strictEqual(db.clinics.length, 1);
  assert.strictEqual(db.users.length, 1);
  assert.strictEqual(db.users[0].clinic_id, db.clinics[0].id);
  assert.strictEqual(db.users[0].role, 'admin');
  assert.strictEqual(db.users[0].active, 1);
});

test('le plan est starter, jamais le defaut hopital de la colonne', async () => {
  resetDb();
  await createClinic(VALID);
  // La colonne clinics.plan a 'hopital' pour defaut (rattrapage des cliniques
  // historiques) : ne pas l'ecrire offrirait le palier le plus cher gratuitement.
  assert.strictEqual(db.clinics[0].plan, 'starter');
  assert.strictEqual(db.clinics[0].subscription_status, 'trial');
  assert.ok(db.clinics[0].subscription_expires_at, "une date de fin d'essai doit etre posee");
});

test('le mot de passe n est jamais stocke en clair', async () => {
  resetDb();
  await createClinic(VALID);
  const stored = db.users[0].password_hash;
  assert.ok(stored, 'un hash doit etre stocke');
  assert.notStrictEqual(stored, VALID.password);
  assert.ok(!JSON.stringify(db.users[0]).includes(VALID.password), 'le mot de passe ne doit apparaitre nulle part sur la ligne');
});

test('applique la meme regle de mot de passe que l inscription publique', async () => {
  resetDb();
  const res = await createClinic({ ...VALID, password: 'court' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.clinics.length, 0, 'aucune clinique ne doit etre creee');
  assert.strictEqual(db.users.length, 0);
});

test('normalise l email en minuscules et sans espaces', async () => {
  resetDb();
  await createClinic({ ...VALID, email: '  AWA@Clinique.CI  ' });
  assert.strictEqual(db.users[0].email, 'awa@clinique.ci');
});

test('refuse un email deja enregistre', async () => {
  resetDb();
  db.users.push({ id: 1, clinic_id: 1, email: 'awa@clinique.ci', role: 'admin', active: 1 });
  const res = await createClinic(VALID);
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.clinics.length, 0, 'aucune clinique orpheline ne doit rester');
});

test('refuse un email deja enregistre meme avec une casse differente', async () => {
  resetDb();
  db.users.push({ id: 1, clinic_id: 1, email: 'awa@clinique.ci', role: 'admin', active: 1 });
  const res = await createClinic({ ...VALID, email: 'AWA@CLINIQUE.CI' });
  assert.strictEqual(res.status, 400, 'la casse ne doit pas permettre de contourner l unicite');
  assert.strictEqual(db.clinics.length, 0);
});

test('champs obligatoires manquants : rien n est ecrit', async () => {
  resetDb();
  const res = await createClinic({ clinicName: 'Sans admin' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.clinics.length, 0);
  assert.strictEqual(db.users.length, 0);
});

test('telephone invalide : refus avant toute ecriture', async () => {
  resetDb();
  const res = await createClinic({ ...VALID, phone: 'pas-un-numero' });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.clinics.length, 0);
});

test('telephone absent : accepte, contrairement a l inscription publique', async () => {
  resetDb();
  const res = await createClinic({ ...VALID, phone: '' });
  assert.strictEqual(res.status, 201, "l'operateur enrole parfois depuis un dossier incomplet");
  assert.strictEqual(db.clinics[0].phone, '');
});

test('journalise la creation contre la clinique creee, au nom du super admin', async () => {
  resetDb();
  await createClinic(VALID);
  const log = db.activity_logs.find(l => l.action === 'PLATFORM_CLINIC_CREATE');
  assert.ok(log, 'une ligne de journal doit exister');
  assert.strictEqual(log.clinic_id, db.clinics[0].id, 'la ligne appartient a la clinique creee');
  assert.strictEqual(log.user_id, 99, "l'auteur est le super admin, dont la clinique differe");
});

test('la reponse ne renvoie ni hash ni mot de passe', async () => {
  resetDb();
  const body = await (await createClinic(VALID)).text();
  assert.ok(!body.includes(VALID.password), 'le mot de passe ne doit jamais ressortir');
  assert.ok(!body.includes('password_hash'), 'le hash ne doit jamais ressortir');
});
