// One-off local migration script (SQLite -> Supabase). Not used at runtime/deploy.
// Run again locally with: npm install sqlite3 --no-save && node migrate-data.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("YOUR_SUPABASE")) {
  console.error("ERREUR : Veuillez d'abord renseigner vos variables d'environnement SUPABASE_URL et SUPABASE_KEY dans le fichier backend/.env.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const sqliteDbPath = path.join(__dirname, 'mediclinic.db');
console.log(`Connexion à la base de données SQLite locale : ${sqliteDbPath}`);
const sqliteDb = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error("Impossible d'ouvrir la base de données SQLite locale :", err.message);
    process.exit(1);
  }
});

// Helper promise to fetch all rows from SQLite
function allSqlite(query, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Order of tables to migrate due to foreign key constraints
const TABLES = [
  { name: 'clinics', jsonFields: ['settings'] },
  { name: 'users', jsonFields: [] },
  { name: 'patients', jsonFields: [] },
  { name: 'appointments', jsonFields: [] },
  { name: 'consultations', jsonFields: ['constants'] },
  { name: 'medications', jsonFields: [] },
  { name: 'stock_entries', jsonFields: [] },
  { name: 'prescriptions', jsonFields: [] },
  { name: 'prescription_items', jsonFields: [] },
  { name: 'lab_exams', jsonFields: ['results_json'] },
  { name: 'payments', jsonFields: ['items'] },
  { name: 'activity_logs', jsonFields: [] }
];

async function runMigration() {
  try {
    console.log("Début de la migration des données SQLite vers Supabase...");

    // Test Supabase connection
    const { error: testErr } = await supabase.from('clinics').select('id').limit(1);
    if (testErr) {
      throw new Error(`Impossible de se connecter à Supabase : ${testErr.message}`);
    }
    console.log("Connexion à Supabase validée !");

    for (const table of TABLES) {
      console.log(`\n----------------------------------------`);
      console.log(`Migration de la table : ${table.name}...`);

      // 1. Fetch data from SQLite
      const rows = await allSqlite(`SELECT * FROM ${table.name}`);
      if (rows.length === 0) {
        console.log(`Aucune donnée trouvée dans SQLite pour la table ${table.name}.`);
        continue;
      }
      console.log(`${rows.length} lignes récupérées de SQLite.`);

      // 2. Preprocess rows (e.g. parse JSON strings so PostgreSQL stores them as native JSONB)
      const preparedRows = rows.map(row => {
        const copy = { ...row };
        
        // Remove empty values that might violate database constraints if they are expected as INT/REAL
        // SQLite permits arbitrary values, PostgreSQL is strictly typed.
        if (table.name === 'medications' || table.name === 'stock_entries') {
          if (copy.expiry_date === '') delete copy.expiry_date;
          if (copy.batch_number === '') delete copy.batch_number;
          if (copy.supplier === '') delete copy.supplier;
        }

        table.jsonFields.forEach(field => {
          if (copy[field]) {
            try {
              copy[field] = JSON.parse(copy[field]);
            } catch (e) {
              console.warn(`Avertissement : Échec du parsing JSON pour le champ "${field}" de la table ${table.name} sur la ligne ID ${row.id}. Insertion brute.`);
            }
          } else {
            copy[field] = table.name === 'payments' ? [] : {};
          }
        });
        return copy;
      });

      // 3. Batch insert into Supabase (by chunks of 50 to avoid payload size limitations)
      const chunkSize = 50;
      for (let i = 0; i < preparedRows.length; i += chunkSize) {
        const chunk = preparedRows.slice(i, i + chunkSize);
        
        // Upsert to handle potential partial re-runs
        const { error: insertError } = await supabase
          .from(table.name)
          .upsert(chunk);

        if (insertError) {
          throw new Error(`Échec de l'insertion dans Supabase pour ${table.name} : ${insertError.message}`);
        }
      }

      console.log(`Succès : ${rows.length} lignes migrées dans la table ${table.name}.`);
    }

    console.log(`\n========================================`);
    console.log("Migration des données terminée avec succès ! 🎉");
    console.log("========================================");
    console.log("\n⚠️ IMPORTANT : ÉTAPE FINALE DE SYNCHRONISATION");
    console.log("Veuillez exécuter les commandes SQL suivantes dans l'éditeur SQL de votre console Supabase");
    console.log("pour réaligner les générateurs d'identifiants automatiques :");
    console.log(`
SELECT setval(pg_get_serial_sequence('clinics', 'id'), COALESCE(MAX(id), 1)) FROM clinics;
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1)) FROM users;
SELECT setval(pg_get_serial_sequence('patients', 'id'), COALESCE(MAX(id), 1)) FROM patients;
SELECT setval(pg_get_serial_sequence('appointments', 'id'), COALESCE(MAX(id), 1)) FROM appointments;
SELECT setval(pg_get_serial_sequence('consultations', 'id'), COALESCE(MAX(id), 1)) FROM consultations;
SELECT setval(pg_get_serial_sequence('medications', 'id'), COALESCE(MAX(id), 1)) FROM medications;
SELECT setval(pg_get_serial_sequence('stock_entries', 'id'), COALESCE(MAX(id), 1)) FROM stock_entries;
SELECT setval(pg_get_serial_sequence('prescriptions', 'id'), COALESCE(MAX(id), 1)) FROM prescriptions;
SELECT setval(pg_get_serial_sequence('prescription_items', 'id'), COALESCE(MAX(id), 1)) FROM prescription_items;
SELECT setval(pg_get_serial_sequence('lab_exams', 'id'), COALESCE(MAX(id), 1)) FROM lab_exams;
SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE(MAX(id), 1)) FROM payments;
SELECT setval(pg_get_serial_sequence('activity_logs', 'id'), COALESCE(MAX(id), 1)) FROM activity_logs;
    `);

  } catch (error) {
    console.error("\n❌ Une erreur est survenue pendant la migration :");
    console.error(error.message);
  } finally {
    sqliteDb.close();
  }
}

runMigration();
