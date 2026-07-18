const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'mediclinic.db');
const db = new sqlite3.Database(dbPath);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDb() {
  // Enable foreign keys
  await runAsync("PRAGMA foreign_keys = ON;");

  // Clinics Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS clinics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      logo TEXT,
      subscription_status TEXT DEFAULT 'active', -- active, expired, trial
      subscription_expires_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Users Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- admin, doctor, secretary, pharmacist, lab_tech, manager
      active INTEGER DEFAULT 1, -- 1=true, 0=false
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    )
  `);

  // Patients Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      folder_number TEXT UNIQUE NOT NULL, -- e.g. MED-2026-0001
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      birth_date TEXT NOT NULL,
      gender TEXT NOT NULL, -- M, F
      phone TEXT NOT NULL,
      email TEXT,
      address TEXT,
      allergies TEXT DEFAULT '',
      antecedents TEXT DEFAULT '',
      archived INTEGER DEFAULT 0, -- 1=archived, 0=active
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    )
  `);

  // Appointments Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      practitioner_id INTEGER NOT NULL, -- user_id of doctor
      date_time TEXT NOT NULL, -- ISO 8601
      duration INTEGER DEFAULT 30, -- minutes
      motif TEXT NOT NULL,
      status TEXT DEFAULT 'scheduled', -- scheduled, completed, cancelled
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (practitioner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Consultations Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      date_time TEXT DEFAULT CURRENT_TIMESTAMP,
      motif TEXT NOT NULL,
      symptoms TEXT,
      constants TEXT, -- JSON representation of { tension: '', temp: '', weight: '', hr: '' }
      diagnosis TEXT,
      notes TEXT,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Medications Catalog / Stock Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS medications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      form TEXT NOT NULL, -- tablet, syrup, capsule, etc.
      dosage TEXT NOT NULL, -- e.g., 500mg, 100ml
      stock_quantity INTEGER DEFAULT 0,
      min_stock_threshold INTEGER DEFAULT 10,
      price_purchase REAL DEFAULT 0.0,
      price_sale REAL DEFAULT 0.0,
      expiry_date TEXT, -- YYYY-MM-DD
      batch_number TEXT,
      supplier TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    )
  `);

  // Stock Entries (history of purchase/replenishment)
  await runAsync(`
    CREATE TABLE IF NOT EXISTS stock_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      medication_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_purchase REAL NOT NULL,
      expiry_date TEXT,
      batch_number TEXT,
      supplier TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Prescriptions Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      consultation_id INTEGER UNIQUE NOT NULL,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      date_time TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending', -- pending, dispensed, partial
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Prescription Items (individual lines of medication prescription)
  await runAsync(`
    CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL,
      medication_id INTEGER, -- nullable if medication is free-text and not in catalog
      medication_name TEXT NOT NULL, -- fallback or written directly
      dosage TEXT,
      frequency TEXT, -- e.g., "1 tab 3x daily"
      duration TEXT, -- e.g., "7 days"
      quantity_prescribed INTEGER DEFAULT 1,
      quantity_dispensed INTEGER DEFAULT 0,
      FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
      FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE SET NULL
    )
  `);

  // Laboratory Exams Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS lab_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      consultation_id INTEGER,
      patient_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      test_name TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, completed, cancelled
      results_text TEXT DEFAULT '',
      results_json TEXT, -- JSON structure of values
      technician_id INTEGER, -- who recorded the results
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE SET NULL,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (technician_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Payments Table
  await runAsync(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL, -- clerk who received the payment
      amount_total REAL NOT NULL,
      payment_method TEXT NOT NULL, -- cash, wave, orange_money, mtn_momo
      reference_number TEXT,
      status TEXT DEFAULT 'paid', -- paid, unpaid
      items TEXT NOT NULL, -- JSON string description of billed items [ { type: 'consultation', name: 'Générale', cost: 10000 } ]
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Activity Logs Table (Journal des activités)
  await runAsync(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER NOT NULL,
      user_id INTEGER,
      action TEXT NOT NULL, -- e.g., "LOGIN", "PATIENT_CREATE", etc.
      details TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Seed default data if clinics are empty
  const count = await getAsync("SELECT COUNT(*) as count FROM clinics");
  if (count.count === 0) {
    console.log("Seeding default clinic and users...");

    // Insert Clinic
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    await runAsync(
      `INSERT INTO clinics (name, address, phone, subscription_status, subscription_expires_at) 
       VALUES (?, ?, ?, ?, ?)`,
      ["Clinique Médicale de l'Avenir", "Cocody Boulevard de France, Abidjan, CI", "+225 0707080910", "active", nextYear.toISOString()]
    );
    const clinicId = 1;

    // Password hashes
    const adminPassHash = await bcrypt.hash("adminpassword", 10);
    const docPassHash = await bcrypt.hash("doctorpassword", 10);
    const secPassHash = await bcrypt.hash("secretarypassword", 10);
    const pharmPassHash = await bcrypt.hash("pharmacistpassword", 10);
    const labPassHash = await bcrypt.hash("labpassword", 10);
    const managerPassHash = await bcrypt.hash("managerpassword", 10);

    // Insert Seed Users
    await runAsync(
      `INSERT INTO users (clinic_id, name, email, password_hash, role) VALUES 
       (?, 'Administrateur', 'admin@mediclinic.com', ?, 'admin'),
       (?, 'Dr. Aminata Koné', 'aminata@mediclinic.com', ?, 'doctor'),
       (?, 'Dr. Ibrahim Traoré', 'ibrahim@mediclinic.com', ?, 'doctor'),
       (?, 'Koffi Bernard', 'bernard@mediclinic.com', ?, 'secretary'),
       (?, 'Moussa Pharmacien', 'moussa@mediclinic.com', ?, 'pharmacist'),
       (?, 'Fatou Laborantine', 'fatou@mediclinic.com', ?, 'lab_tech'),
       (?, 'Kouassi Gestionnaire', 'kouassi@mediclinic.com', ?, 'manager')`,
      [
        clinicId, adminPassHash,
        clinicId, docPassHash,
        clinicId, docPassHash, // Traoré same pwd for testing
        clinicId, secPassHash,
        clinicId, pharmPassHash,
        clinicId, labPassHash,
        clinicId, managerPassHash
      ]
    );

    // Seed Medications Catalog
    await runAsync(
      `INSERT INTO medications (clinic_id, name, form, dosage, stock_quantity, min_stock_threshold, price_purchase, price_sale, expiry_date, batch_number, supplier) VALUES 
       (?, 'Paracétamol', 'comprimé', '500mg', 150, 20, 500, 1000, '2027-12-31', 'B-PR-2026', 'PHARMA-CI'),
       (?, 'Amoxicilline', 'gélule', '500mg', 8, 10, 1200, 2500, '2026-09-15', 'B-AM-2026', 'MEDIC-AFRIQUE'), -- alert: stock bas (8 < 10)
       (?, 'Sirop Toux Enfant', 'sirop', '125ml', 45, 10, 800, 1800, '2026-08-10', 'B-TX-2026', 'PHARMA-CI'), -- alert: péremption proche (2026-08-10 is <30d from now since we are in July 18 2026!)
       (?, 'Ibuprofène', 'comprimé', '400mg', 80, 15, 600, 1200, '2028-06-30', 'B-IB-2026', 'MEDIC-AFRIQUE'),
       (?, 'Spasfon', 'comprimé', '80mg', 120, 10, 1000, 2000, '2027-04-30', 'B-SP-2026', 'PHARMA-CI')`,
      [clinicId, clinicId, clinicId, clinicId, clinicId]
    );

    // Seed Patients
    await runAsync(
      `INSERT INTO patients (clinic_id, folder_number, first_name, last_name, birth_date, gender, phone, email, address, allergies, antecedents) VALUES 
       (?, 'MED-2026-0001', 'Koffi', 'Yao', '1988-04-12', 'M', '+225 0505123456', 'yao@gmail.com', 'Yopougon Selmer, Abidjan', 'Pénicilline', 'Hypertension'),
       (?, 'MED-2026-0002', 'Mariam', 'Diallo', '1995-11-23', 'F', '+225 0707987654', 'mariam@gmail.com', 'Cocody Angré, Abidjan', '', 'Diabète Type 2'),
       (?, 'MED-2026-0003', 'Jean-Baptiste', 'Kouamé', '1962-07-05', 'M', '+225 0101456789', 'jb@gmail.com', 'Marcory Zone 4, Abidjan', 'Aspirine', 'Insuffisance rénale')`,
      [clinicId, clinicId, clinicId]
    );

    // Seed Appointments
    const today = new Date().toISOString().split('T')[0];
    await runAsync(
      `INSERT INTO appointments (clinic_id, patient_id, practitioner_id, date_time, duration, motif, status) VALUES 
       (?, 1, 2, ?, 30, 'Consultation générale - Fièvre', 'scheduled'),
       (?, 2, 2, ?, 30, 'Suivi diabète', 'scheduled'),
       (?, 3, 3, ?, 30, 'Bilan annuel', 'scheduled')`,
      [
        clinicId, today + 'T09:00:00',
        clinicId, today + 'T10:30:00',
        clinicId, today + 'T14:00:00'
      ]
    );

    console.log("Database seeded successfully.");
  }
}

module.exports = {
  db,
  initDb,
  runAsync,
  getAsync,
  allAsync
};
