// Secret médical : chaque rôle ne lit que le contenu médical dont son travail a
// besoin (utils/medicalAccess.js), et c'est le serveur qui filtre. La fiche
// patient renvoyait consultations, ordonnances, examens et antécédents à tous
// les rôles ; seul le menu cachait certains onglets. Le VRAI checkRole tourne
// ici, seule l'authentification est simulée.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

const realAuthModule = require(path.join(BACKEND, 'middleware', 'auth.js'));
stubModule('middleware/auth.js', {
  ...realAuthModule,
  auth: (req, _res, next) => {
    req.user = { userId: 1, clinicId: 1, role: req.headers['x-test-role'] };
    next();
  }
});

const patients = require(path.join(BACKEND, 'routes', 'patients.js'));
const consultations = require(path.join(BACKEND, 'routes', 'consultations.js'));
const laboratory = require(path.join(BACKEND, 'routes', 'laboratory.js'));
const pharmacy = require(path.join(BACKEND, 'routes', 'pharmacy.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([
    ['/api/patients', patients],
    ['/api/consultations', consultations],
    ['/api/laboratory', laboratory],
    ['/api/pharmacy', pharmacy]
  ]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const as = (role, url, init = {}) => fetch(`${baseUrl}${url}`, {
  ...init,
  headers: { 'Content-Type': 'application/json', 'x-test-role': role }
});

// Ce que chaque rôle lit. L'admin lit tout : checkRole le laisse toujours passer.
const READS = {
  admin:      { consultations: true,  antecedents: true,  prescriptions: true,  labExams: true },
  doctor:     { consultations: true,  antecedents: true,  prescriptions: true,  labExams: true },
  nurse:      { consultations: true,  antecedents: true,  prescriptions: true,  labExams: true },
  pharmacist: { consultations: false, antecedents: false, prescriptions: true,  labExams: false },
  lab_tech:   { consultations: false, antecedents: false, prescriptions: false, labExams: true },
  secretary:  { consultations: false, antecedents: false, prescriptions: false, labExams: false },
  manager:    { consultations: false, antecedents: false, prescriptions: false, labExams: false }
};
const ROLES = Object.keys(READS);
const TIMELINE_TYPES = { consultations: 'consultation', prescriptions: 'prescription', labExams: 'lab' };

function seed() {
  resetDb();
  db.clinics.push({ id: 1, plan: 'hopital' });
  db.patients.push({
    id: 1, clinic_id: 1, first_name: 'Awa', last_name: 'Kone', birth_date: '1990-01-01', gender: 'F',
    phone: '+2250700000000', allergies: 'Pénicilline', antecedents: 'Diabète', archived: 0
  });
  db.consultations.push({
    id: 1, clinic_id: 1, patient_id: 1, doctor_id: 2, date_time: '2026-10-01T09:00:00Z',
    motif: 'Fièvre', diagnosis: 'Paludisme', notes: 'Repos trois jours', constants: null
  });
  db.prescriptions.push({
    id: 1, clinic_id: 1, patient_id: 1, consultation_id: 1, doctor_id: 2,
    date_time: '2026-10-01T09:30:00Z', status: 'pending'
  });
  db.lab_exams.push({
    id: 1, clinic_id: 1, patient_id: 1, consultation_id: 1, doctor_id: 2, test_name: 'Goutte épaisse',
    status: 'pending', results_json: null, created_at: '2026-10-01T09:15:00Z'
  });
  db.payments.push({
    id: 1, clinic_id: 1, patient_id: 1, amount_total: 10000, payment_method: 'cash', items: [],
    status: 'paid', created_at: '2026-10-01T10:00:00Z'
  });
}

test('la fiche patient ne contient que les sections médicales que le rôle peut lire', async () => {
  for (const role of ROLES) {
    seed();
    const res = await as(role, '/api/patients/1');
    const body = await res.json();
    assert.strictEqual(res.status, 200, role);
    const reads = READS[role];

    assert.strictEqual(body.consultations.length > 0, reads.consultations, `${role} : consultations`);
    assert.strictEqual(body.prescriptions.length > 0, reads.prescriptions, `${role} : ordonnances`);
    assert.strictEqual(body.labExams.length > 0, reads.labExams, `${role} : examens`);
    assert.strictEqual('antecedents' in body.patient, reads.antecedents, `${role} : antécédents`);
    assert.strictEqual(body.patient.allergies, 'Pénicilline', `${role} : allergies`);
    assert.strictEqual(body.payments.length, 1, `${role} : paiements`);

    const types = new Set(body.timeline.map((item) => item.type));
    for (const [section, type] of Object.entries(TIMELINE_TYPES)) {
      assert.strictEqual(types.has(type), reads[section], `${role} : ${type} dans l'historique`);
    }
    const hidden = Object.keys(reads).filter((section) => !reads[section]);
    assert.deepStrictEqual([...body.hiddenSections].sort(), hidden.sort(), `${role} : sections annoncées masquées`);
  }
});

test('la liste des patients ne donne les antécédents qu\'aux soignants', async () => {
  for (const role of ROLES) {
    seed();
    const res = await as(role, '/api/patients');
    const [patient] = await res.json();
    assert.strictEqual(res.status, 200, role);
    assert.strictEqual('antecedents' in patient, READS[role].antecedents, role);
    assert.strictEqual(patient.allergies, 'Pénicilline', role);
  }
});

test('consultation, examens et ordonnances sont refusés aux rôles qui ne les lisent pas', async () => {
  const routes = [
    ['/api/consultations/1', 'consultations'],
    ['/api/laboratory/exams', 'labExams'],
    ['/api/pharmacy/prescriptions', 'prescriptions'],
    ['/api/pharmacy/prescriptions/1', 'prescriptions']
  ];
  for (const role of ROLES) {
    for (const [url, section] of routes) {
      seed();
      const res = await as(role, url);
      assert.strictEqual(res.status, READS[role][section] ? 200 : 403, `${role} ${url}`);
    }
  }
});

test('le pharmacien reçoit les ordonnances sans le diagnostic ni les notes de la consultation', async () => {
  for (const role of ['pharmacist', 'doctor']) {
    seed();
    // Ce que PostgREST joint pour cette route : la consultation dont l'ordonnance découle.
    db.prescriptions[0] = { ...db.prescriptions[0], consultation: { diagnosis: 'Paludisme', notes: 'Repos trois jours' }, items: [] };
    const [prescription] = await (await as(role, '/api/pharmacy/prescriptions')).json();
    const readsConsultation = role === 'doctor';
    assert.strictEqual(prescription.diagnosis, readsConsultation ? 'Paludisme' : '', role);
    assert.strictEqual(prescription.notes, readsConsultation ? 'Repos trois jours' : '', role);
    assert.strictEqual('consultation' in prescription, false, `${role} : consultation jointe recopiée telle quelle`);
  }
});

test('le détail d\'une ordonnance ne donne pas les antécédents au pharmacien', async () => {
  for (const role of ['pharmacist', 'doctor']) {
    seed();
    // Ce que PostgREST joint pour cette route : la fiche patient complète.
    db.prescriptions[0] = { ...db.prescriptions[0], patient: { ...db.patients[0] } };
    const body = await (await as(role, '/api/pharmacy/prescriptions/1')).json();
    assert.strictEqual('antecedents' in body.patient, role === 'doctor', role);
    assert.strictEqual(body.patient.allergies, 'Pénicilline', role);
  }
});

const patientUpdate = (antecedents) => JSON.stringify({
  firstName: 'Awa', lastName: 'Kone', birthDate: '1990-01-01', gender: 'F',
  phone: '+2250700000000', allergies: 'Pénicilline', antecedents
});

test('le pharmacien et le laborantin ne modifient ni n\'archivent un patient', async () => {
  for (const role of ['pharmacist', 'lab_tech']) {
    seed();
    assert.strictEqual((await as(role, '/api/patients/1', { method: 'PUT', body: patientUpdate('Diabète') })).status, 403, `${role} PUT`);
    assert.strictEqual((await as(role, '/api/patients/1', { method: 'DELETE' })).status, 403, `${role} DELETE`);
    assert.strictEqual(db.patients[0].archived, 0, role);
  }
  for (const role of ['admin', 'doctor', 'nurse', 'secretary', 'manager']) {
    seed();
    const res = await as(role, '/api/patients/1', { method: 'DELETE' });
    assert.strictEqual(res.status, 200, `${role} DELETE`);
    assert.strictEqual(db.patients[0].archived, 1, role);
  }
});

test('un rôle qui ne lit pas les antécédents ne peut pas les écraser', async () => {
  seed();
  // La fiche d'une secrétaire arrive sans antécédents : un formulaire les renverrait vides.
  let res = await as('secretary', '/api/patients/1', { method: 'PUT', body: patientUpdate('') });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.patients[0].antecedents, 'Diabète');

  res = await as('doctor', '/api/patients/1', { method: 'PUT', body: patientUpdate('Diabète, HTA') });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.patients[0].antecedents, 'Diabète, HTA');
});
