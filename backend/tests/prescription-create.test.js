// Création et modification d'une ordonnance, côté serveur.
//
// Avant ces routes, « Nouvelle ordonnance » ne quittait jamais le navigateur :
// la page construisait un objet, l'ajoutait à son state React et annonçait
// « Ordonnance générée avec succès ». Au rechargement, l'ordonnance avait
// disparu — un dossier médical perdu sans le moindre signal.
//
// Les invariants couverts ici sont ceux qu'un appel direct à l'API peut
// atteindre, l'interface envoyant déjà des valeurs bien formées :
//  1. `prescriptions.consultation_id` est NOT NULL UNIQUE : une ordonnance
//     appartient à une consultation et une seule. Sans consultation fournie,
//     la route crée celle qui la porte ; avec une consultation déjà pourvue,
//     elle refuse au lieu de laisser remonter un 23505 opaque.
//  2. Patient, prescripteur et médicaments doivent appartenir à la clinique
//     appelante (IDOR).
//  3. Les quantités sont des entiers strictement positifs, validées AVANT la
//     première écriture : PostgREST n'a pas de transaction, un refus en cours
//     de boucle laisserait une ordonnance à moitié écrite.
//  4. Une ordonnance déjà délivrée n'est plus modifiable, sinon les quantités
//     réécrites feraient mentir le stock déjà décrémenté.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 2, clinicId: 1, role: 'doctor' }));

const pharmacy = require(path.join(BACKEND, 'routes', 'pharmacy.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/pharmacy', pharmacy]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const send = (method, url, body) => fetch(`${baseUrl}${url}`, {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const postJson = (url, body) => send('POST', url, body);
const putJson = (url, body) => send('PUT', url, body);

const ITEM = { medicationName: 'Amoxicilline 500mg', dosage: '1 comprimé', frequency: 'x3/jour', duration: '5 jours', quantityPrescribed: 15 };

function seed() {
  resetDb();
  db.patients.push({ id: 1, clinic_id: 1, first_name: 'Awa', last_name: 'Koné', birth_date: '1990-01-01' });
  // Un patient d'une autre clinique, pour la vérification d'isolation.
  db.patients.push({ id: 2, clinic_id: 99, first_name: 'Autre', last_name: 'Clinique' });
  db.users.push({ id: 2, clinic_id: 1, name: 'Dr Coulibaly', role: 'doctor', active: 1 });
  db.users.push({ id: 3, clinic_id: 1, name: 'Moussa', role: 'pharmacist', active: 1 });
  db.users.push({ id: 4, clinic_id: 1, name: 'Ancien médecin', role: 'doctor', active: 0 });
  db.users.push({ id: 5, clinic_id: 99, name: 'Médecin voisin', role: 'doctor', active: 1 });
  db.medications.push({ id: 1, clinic_id: 1, name: 'Amoxicilline', stock_quantity: 50 });
  db.medications.push({ id: 2, clinic_id: 99, name: 'Médicament voisin', stock_quantity: 50 });
}

// ------------------------------------------------------------- création

test('une ordonnance sans consultation cree la consultation qui la porte', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, motif: 'Angine', diagnosis: 'Angine bactérienne',
    notes: 'À prendre au cours des repas.', items: [ITEM]
  });
  const body = await res.json();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.prescriptions.length, 1, "l'ordonnance doit exister en base");
  assert.strictEqual(db.consultations.length, 1, 'la consultation porteuse doit être créée');
  assert.strictEqual(db.prescriptions[0].consultation_id, db.consultations[0].id);
  assert.strictEqual(db.prescriptions[0].status, 'pending');
  assert.strictEqual(db.consultations[0].diagnosis, 'Angine bactérienne');
  assert.strictEqual(db.consultations[0].notes, 'À prendre au cours des repas.');
  assert.strictEqual(body.prescriptionId, db.prescriptions[0].id);
});

test('les lignes sont enregistrees avec zero delivre', async () => {
  seed();

  await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, items: [ITEM, { ...ITEM, medicationName: 'Paracétamol', quantityPrescribed: 10 }]
  });

  assert.strictEqual(db.prescription_items.length, 2);
  assert.deepStrictEqual(db.prescription_items.map(i => i.quantity_prescribed), [15, 10]);
  assert.deepStrictEqual(db.prescription_items.map(i => i.quantity_dispensed), [0, 0]);
  assert.strictEqual(db.prescription_items[0].dosage, '1 comprimé');
  assert.strictEqual(db.prescription_items[0].duration, '5 jours');
});

test('la creation est tracee dans le journal d activite', async () => {
  seed();

  await postJson('/api/pharmacy/prescriptions', { patientId: 1, doctorId: 2, items: [ITEM] });

  const log = db.activity_logs.find(l => l.action === 'PRESCRIPTION_CREATE');
  assert.ok(log, 'une ligne PRESCRIPTION_CREATE doit être écrite');
  assert.strictEqual(log.clinic_id, 1);
});

// --------------------------------------------------------------- refus

test('un patient d une autre clinique est refuse', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', { patientId: 2, doctorId: 2, items: [ITEM] });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(db.prescriptions.length, 0);
  assert.strictEqual(db.consultations.length, 0, 'aucune consultation orpheline ne doit rester');
});

test('un prescripteur d une autre clinique est refuse', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', { patientId: 1, doctorId: 5, items: [ITEM] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescriptions.length, 0);
});

test('un prescripteur desactive est refuse', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', { patientId: 1, doctorId: 4, items: [ITEM] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescriptions.length, 0);
});

test('un pharmacien ne peut pas signer une ordonnance', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', { patientId: 1, doctorId: 3, items: [ITEM] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescriptions.length, 0);
});

test('un medicament du catalogue d une autre clinique est refuse', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, items: [{ ...ITEM, medicationId: 2 }]
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescriptions.length, 0);
});

test('une ordonnance sans medicament est refusee', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', { patientId: 1, doctorId: 2, items: [] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.consultations.length, 0, 'rien ne doit être écrit avant la validation');
});

test('une quantite en texte est refusee', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, items: [{ ...ITEM, quantityPrescribed: '15' }]
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescriptions.length, 0);
});

test('une quantite nulle ou negative est refusee', async () => {
  seed();

  const zero = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, items: [{ ...ITEM, quantityPrescribed: 0 }]
  });
  const negative = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, items: [{ ...ITEM, quantityPrescribed: -3 }]
  });

  assert.strictEqual(zero.status, 400);
  assert.strictEqual(negative.status, 400);
  assert.strictEqual(db.prescriptions.length, 0);
});

test('une ligne invalide n ecrit aucune des lignes valides', async () => {
  seed();

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2,
    items: [ITEM, { ...ITEM, medicationName: 'Paracétamol', quantityPrescribed: 2.5 }]
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescription_items.length, 0, 'la première ligne ne doit pas survivre au refus de la seconde');
  assert.strictEqual(db.consultations.length, 0);
});

// -------------------------------------------------- consultation fournie

test('une consultation existante porte l ordonnance sans en creer une seconde', async () => {
  seed();
  db.consultations.push({ id: 7, clinic_id: 1, patient_id: 1, doctor_id: 2, motif: 'Fièvre' });

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, consultationId: 7, items: [ITEM]
  });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.consultations.length, 1, 'aucune consultation supplémentaire');
  assert.strictEqual(db.prescriptions[0].consultation_id, 7);
});

test('une consultation portant deja une ordonnance est refusee', async () => {
  seed();
  db.consultations.push({ id: 7, clinic_id: 1, patient_id: 1, doctor_id: 2, motif: 'Fièvre' });
  db.prescriptions.push({ id: 1, clinic_id: 1, consultation_id: 7, patient_id: 1, doctor_id: 2, status: 'pending' });

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, consultationId: 7, items: [ITEM]
  });

  assert.strictEqual(res.status, 409);
  assert.strictEqual(db.prescriptions.length, 1);
});

test('une consultation d un autre patient est refusee', async () => {
  seed();
  db.patients.push({ id: 3, clinic_id: 1, first_name: 'Kofi', last_name: 'Yao' });
  db.consultations.push({ id: 7, clinic_id: 1, patient_id: 3, doctor_id: 2, motif: 'Fièvre' });

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, consultationId: 7, items: [ITEM]
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescriptions.length, 0);
});

test('une consultation d une autre clinique est refusee', async () => {
  seed();
  db.consultations.push({ id: 7, clinic_id: 99, patient_id: 1, doctor_id: 5, motif: 'Fièvre' });

  const res = await postJson('/api/pharmacy/prescriptions', {
    patientId: 1, doctorId: 2, consultationId: 7, items: [ITEM]
  });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(db.prescriptions.length, 0);
});

// ---------------------------------------------------------- modification

function seedExisting({ dispensed = 0, status = 'pending' } = {}) {
  seed();
  db.consultations.push({ id: 7, clinic_id: 1, patient_id: 1, doctor_id: 2, motif: 'Angine', diagnosis: 'Angine', notes: '' });
  db.prescriptions.push({ id: '1', clinic_id: 1, consultation_id: 7, patient_id: 1, doctor_id: 2, status });
  db.prescription_items.push({
    id: 1, prescription_id: '1', medication_id: null, medication_name: 'Amoxicilline 500mg',
    dosage: '1 comprimé', frequency: 'x3/jour', duration: '5 jours',
    quantity_prescribed: 15, quantity_dispensed: dispensed
  });
}

test('la modification remplace les lignes et met a jour le diagnostic', async () => {
  seedExisting();

  const res = await putJson('/api/pharmacy/prescriptions/1', {
    doctorId: 2, diagnosis: 'Angine virale', notes: 'Repos.',
    items: [{ ...ITEM, medicationName: 'Paracétamol 1g', quantityPrescribed: 8 }]
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.prescription_items.length, 1, "l'ancienne ligne doit disparaître");
  assert.strictEqual(db.prescription_items[0].medication_name, 'Paracétamol 1g');
  assert.strictEqual(db.prescription_items[0].quantity_prescribed, 8);
  assert.strictEqual(db.consultations[0].diagnosis, 'Angine virale');
  assert.strictEqual(db.consultations[0].notes, 'Repos.');
});

test('une ordonnance deja delivree n est plus modifiable', async () => {
  seedExisting({ dispensed: 5 });

  const res = await putJson('/api/pharmacy/prescriptions/1', {
    doctorId: 2, items: [{ ...ITEM, quantityPrescribed: 1 }]
  });

  assert.strictEqual(res.status, 409);
  assert.strictEqual(db.prescription_items[0].quantity_prescribed, 15, 'la ligne servie ne doit pas bouger');
  assert.strictEqual(db.prescription_items[0].quantity_dispensed, 5);
});

test('une ordonnance au statut remise n est plus modifiable', async () => {
  seedExisting({ status: 'dispensed' });

  const res = await putJson('/api/pharmacy/prescriptions/1', {
    doctorId: 2, items: [{ ...ITEM, quantityPrescribed: 1 }]
  });

  assert.strictEqual(res.status, 409);
  assert.strictEqual(db.prescription_items.length, 1);
});

test('une ordonnance d une autre clinique est introuvable', async () => {
  seedExisting();
  db.prescriptions[0].clinic_id = 99;

  const res = await putJson('/api/pharmacy/prescriptions/1', {
    doctorId: 2, items: [{ ...ITEM, quantityPrescribed: 1 }]
  });

  assert.strictEqual(res.status, 404);
  assert.strictEqual(db.prescription_items[0].quantity_prescribed, 15);
});

test('une modification invalide ne supprime pas les lignes existantes', async () => {
  seedExisting();

  const res = await putJson('/api/pharmacy/prescriptions/1', {
    doctorId: 2, items: [{ ...ITEM, quantityPrescribed: -1 }]
  });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescription_items.length, 1, "l'ordonnance d'origine doit rester intacte");
  assert.strictEqual(db.prescription_items[0].medication_name, 'Amoxicilline 500mg');
});
