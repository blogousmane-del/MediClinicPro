// Intégrité du stock de pharmacie.
//
// Trois défauts couverts ici, tous atteignables par un compte légitime :
//  1. `qty` n'était jamais validé. Une chaîne JSON transformait l'addition en
//     concaténation ("10" + "50" = "1050") et multipliait le stock.
//  2. La dispensation ne comparait `qty` qu'au stock, jamais au reste à
//     délivrer : une ordonnance de 2 boîtes pouvait en sortir 100.
//  3. Le stock était lu puis réécrit (`lu ± qty`). Deux opérations simultanées
//     perdaient une écriture, et la vérification « stock suffisant » était
//     séparée du décrément, donc contournable.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

// Crochet posé par les tests de concurrence : il s'exécute une seule fois,
// juste avant l'écriture sur `medications`, pour simuler une autre requête qui
// modifie le stock entre notre lecture et notre écriture.
let interceptNextMedicationUpdate = null;

// La fausse base rend la ligne elle-même, pas une copie — contrairement à
// PostgREST, qui sérialise la réponse. Muter la ligne en place modifierait donc
// aussi l'instantané déjà lu par la route, et la garde optimiste comparerait
// une valeur à elle-même. On remplace l'objet pour que la lecture précédente
// garde bien sa valeur d'origine, comme en production.
function concurrentStockChange(newStock) {
  return () => { db.medications[0] = { ...db.medications[0], stock_quantity: newStock }; };
}

const inner = makeSupabaseStub();
stubModule('database.js', {
  supabase: {
    from(table) {
      const builder = inner.from(table);
      if (table === 'medications') {
        const update = builder.update;
        builder.update = (payload) => {
          if (interceptNextMedicationUpdate) {
            const hook = interceptNextMedicationUpdate;
            interceptNextMedicationUpdate = null;
            hook();
          }
          return update(payload);
        };
      }
      return builder;
    }
  }
});
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'pharmacist' }));

const pharmacy = require(path.join(BACKEND, 'routes', 'pharmacy.js'));

let server;
let baseUrl;
test.before(async () => {
  server = await startApp([['/api/pharmacy', pharmacy]]);
  baseUrl = server.baseUrl;
});
test.after(() => server.close());

const postJson = (url, body) => fetch(`${baseUrl}${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

const REPLENISH = {
  name: 'Amoxicilline', form: 'Comprimé', dosage: '500mg',
  pricePurchase: 100, priceSale: 150
};

function seedMedication(stock = 10) {
  resetDb();
  interceptNextMedicationUpdate = null;
  db.medications.push({
    id: 1, clinic_id: 1, name: 'Amoxicilline', form: 'Comprimé', dosage: '500mg',
    stock_quantity: stock, min_stock_threshold: 5, price_purchase: 100, price_sale: 150
  });
}

// L'identifiant d'ordonnance arrive par l'URL, donc en texte : la table est
// semée avec la même forme pour que la comparaison stricte du faux PostgREST
// se comporte comme Postgres.
function seedPrescription({ stock = 10, prescribed = 2, dispensed = 0 } = {}) {
  seedMedication(stock);
  db.patients.push({ id: 1, clinic_id: 1, first_name: 'Awa', last_name: 'Kone' });
  db.prescriptions.push({ id: '1', clinic_id: 1, patient_id: 1, status: 'pending' });
  db.prescription_items.push({
    id: 1, prescription_id: '1', medication_id: 1,
    quantity_prescribed: prescribed, quantity_dispensed: dispensed
  });
}

// ---------------------------------------------------------------- réappro

test('reappro : une quantite en texte est refusee', async () => {
  seedMedication(10);

  const res = await postJson('/api/pharmacy/replenish', { ...REPLENISH, qty: '50' });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 10, 'le stock ne doit pas bouger');
});

test('reappro : une quantite negative est refusee', async () => {
  seedMedication(10);

  const res = await postJson('/api/pharmacy/replenish', { ...REPLENISH, qty: -5 });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 10);
});

test('reappro : une quantite decimale est refusee', async () => {
  seedMedication(10);

  const res = await postJson('/api/pharmacy/replenish', { ...REPLENISH, qty: 2.5 });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 10);
});

test('reappro : une quantite entiere positive incremente le stock', async () => {
  seedMedication(10);

  const res = await postJson('/api/pharmacy/replenish', { ...REPLENISH, qty: 20 });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.medications[0].stock_quantity, 30);
});

test('reappro : aucune ecriture perdue si le stock bouge entre lecture et ecriture', async () => {
  seedMedication(10);
  // Une autre requête ajoute 5 juste avant notre écriture.
  interceptNextMedicationUpdate = concurrentStockChange(15);

  const res = await postJson('/api/pharmacy/replenish', { ...REPLENISH, qty: 20 });

  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.medications[0].stock_quantity, 35, 'les 5 unites concurrentes doivent survivre');
});

// ------------------------------------------------------------ dispensation

test('dispensation : une quantite en texte est refusee', async () => {
  seedPrescription({ stock: 10, prescribed: 5 });

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 1, qty: '3' }] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 10);
  assert.strictEqual(db.prescription_items[0].quantity_dispensed, 0);
});

test('dispensation : une quantite negative est refusee', async () => {
  seedPrescription({ stock: 10, prescribed: 5 });

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 1, qty: -2 }] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 10);
});

test('dispensation : on ne peut pas delivrer plus que le reste a delivrer', async () => {
  seedPrescription({ stock: 500, prescribed: 2, dispensed: 0 });

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 1, qty: 100 }] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 500, 'le stock ne doit pas bouger');
  assert.strictEqual(db.prescription_items[0].quantity_dispensed, 0);
});

test('dispensation : le reste a delivrer tient compte de ce qui est deja sorti', async () => {
  // 5 prescrits, 4 deja delivres : 2 de plus doit etre refuse, 1 accepte.
  seedPrescription({ stock: 500, prescribed: 5, dispensed: 4 });

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 1, qty: 2 }] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.prescription_items[0].quantity_dispensed, 4);
});

test('dispensation : stock insuffisant refuse sans rien ecrire', async () => {
  seedPrescription({ stock: 1, prescribed: 5 });

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 1, qty: 3 }] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 1);
  assert.strictEqual(db.prescription_items[0].quantity_dispensed, 0);
});

test('dispensation : une quantite valide decremente le stock et marque l ordonnance', async () => {
  seedPrescription({ stock: 10, prescribed: 3 });

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 1, qty: 3 }] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.medications[0].stock_quantity, 7);
  assert.strictEqual(db.prescription_items[0].quantity_dispensed, 3);
  assert.strictEqual(db.prescriptions[0].status, 'dispensed');
});

test('dispensation : aucune ecriture perdue si le stock bouge entre lecture et ecriture', async () => {
  seedPrescription({ stock: 10, prescribed: 3 });
  // Une autre dispensation retire 4 unites juste avant notre ecriture.
  interceptNextMedicationUpdate = concurrentStockChange(6);

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 1, qty: 3 }] });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(db.medications[0].stock_quantity, 3, 'les 4 unites concurrentes doivent survivre');
});

test('dispensation : un article d une autre ordonnance est ignore', async () => {
  seedPrescription({ stock: 10, prescribed: 3 });
  db.prescription_items.push({
    id: 2, prescription_id: '99', medication_id: 1, quantity_prescribed: 50, quantity_dispensed: 0
  });

  const res = await postJson('/api/pharmacy/dispense/1', { dispensations: [{ itemId: 2, qty: 5 }] });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(db.medications[0].stock_quantity, 10);
  assert.strictEqual(db.prescription_items[1].quantity_dispensed, 0);
});
