const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../database');
const { auth } = require('../middleware/auth');

// GET /api/patients
// Search and list patients
router.get('/', auth, async (req, res) => {
  try {
    const { q, showArchived } = req.query;
    const archivedVal = showArchived === 'true' ? 1 : 0;
    let query = "SELECT * FROM patients WHERE clinic_id = ? AND archived = ?";
    let params = [req.user.clinicId, archivedVal];

    if (q) {
      query += " AND (first_name LIKE ? OR last_name LIKE ? OR folder_number LIKE ? OR phone LIKE ?)";
      const searchPattern = `%${q}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    query += " ORDER BY last_name ASC, first_name ASC";
    const patients = await allAsync(query, params);
    res.json(patients);
  } catch (error) {
    console.error("Get Patients Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des patients." });
  }
});

// POST /api/patients
// Create new patient
router.post('/', auth, async (req, res) => {
  try {
    const { firstName, lastName, birthDate, gender, phone, email, address, allergies, antecedents } = req.body;

    if (!firstName || !lastName || !birthDate || !gender || !phone) {
      return res.status(400).json({ error: "Les champs obligatoires doivent être renseignés." });
    }

    // Check for exact duplicate (same name + birthdate + phone)
    const duplicate = await getAsync(
      "SELECT id FROM patients WHERE clinic_id = ? AND first_name = ? AND last_name = ? AND birth_date = ? AND phone = ?",
      [req.user.clinicId, firstName, lastName, birthDate, phone]
    );

    if (duplicate) {
      return res.status(400).json({ error: "Un patient avec le même nom, date de naissance et téléphone existe déjà." });
    }

    // Generate folder number (MED-YYYY-XXXX)
    const currentYear = new Date().getFullYear();
    const prefix = `MED-${currentYear}-`;
    const countRow = await getAsync(
      "SELECT COUNT(*) as count FROM patients WHERE clinic_id = ? AND folder_number LIKE ?",
      [req.user.clinicId, `${prefix}%`]
    );
    const sequenceNum = String(countRow.count + 1).padStart(4, '0');
    const folderNumber = `${prefix}${sequenceNum}`;

    const result = await runAsync(
      `INSERT INTO patients (clinic_id, folder_number, first_name, last_name, birth_date, gender, phone, email, address, allergies, antecedents) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.clinicId, folderNumber, firstName, lastName, birthDate, gender,
        phone, email || '', address || '', allergies || '', antecedents || ''
      ]
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'PATIENT_CREATE', ?)",
      [req.user.clinicId, req.user.userId, `Création du patient ${firstName} ${lastName} (${folderNumber})`]
    );

    const newPatient = await getAsync("SELECT * FROM patients WHERE id = ?", [result.lastID]);
    res.status(201).json(newPatient);
  } catch (error) {
    console.error("Create Patient Error:", error);
    res.status(500).json({ error: "Erreur lors de la création du patient." });
  }
});

// GET /api/patients/:id
// Get patient timeline and detail
router.get('/:id', auth, async (req, res) => {
  try {
    const patientId = req.params.id;
    const patient = await getAsync(
      "SELECT * FROM patients WHERE id = ? AND clinic_id = ?",
      [patientId, req.user.clinicId]
    );

    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé." });
    }

    // Fetch consultations
    const consultations = await allAsync(
      `SELECT c.*, u.name as doctor_name 
       FROM consultations c 
       LEFT JOIN users u ON c.doctor_id = u.id 
       WHERE c.patient_id = ? AND c.clinic_id = ? 
       ORDER BY c.date_time DESC`,
      [patientId, req.user.clinicId]
    );

    // Fetch prescriptions
    const prescriptions = await allAsync(
      `SELECT pr.*, u.name as doctor_name 
       FROM prescriptions pr 
       LEFT JOIN users u ON pr.doctor_id = u.id 
       WHERE pr.patient_id = ? AND pr.clinic_id = ? 
       ORDER BY pr.date_time DESC`,
      [patientId, req.user.clinicId]
    );

    // Hydrate prescription items
    for (const pr of prescriptions) {
      const items = await allAsync(
        "SELECT * FROM prescription_items WHERE prescription_id = ?",
        [pr.id]
      );
      pr.items = items;
    }

    // Fetch lab exams
    const labExams = await allAsync(
      `SELECT le.*, u.name as doctor_name, t.name as technician_name 
       FROM lab_exams le 
       LEFT JOIN users u ON le.doctor_id = u.id 
       LEFT JOIN users t ON le.technician_id = t.id 
       WHERE le.patient_id = ? AND le.clinic_id = ? 
       ORDER BY le.created_at DESC`,
      [patientId, req.user.clinicId]
    );

    // Fetch payments
    const payments = await allAsync(
      "SELECT * FROM payments WHERE patient_id = ? AND clinic_id = ? ORDER BY created_at DESC",
      [patientId, req.user.clinicId]
    );

    // Compile clinical history timeline
    const timeline = [];
    consultations.forEach(c => {
      timeline.push({
        id: `c-${c.id}`,
        type: 'consultation',
        date: c.date_time,
        title: `Consultation : ${c.motif}`,
        subtitle: `Par ${c.doctor_name}`,
        details: c
      });
    });

    prescriptions.forEach(p => {
      timeline.push({
        id: `p-${p.id}`,
        type: 'prescription',
        date: p.date_time,
        title: `Ordonnance`,
        subtitle: `Par ${p.doctor_name} (${p.status === 'dispensed' ? 'Délivrée' : 'En attente'})`,
        details: p
      });
    });

    labExams.forEach(le => {
      timeline.push({
        id: `le-${le.id}`,
        type: 'lab',
        date: le.created_at,
        title: `Examen de Laboratoire : ${le.test_name}`,
        subtitle: `Statut : ${le.status === 'completed' ? 'Résultats saisis' : 'En attente'}`,
        details: le
      });
    });

    payments.forEach(pay => {
      timeline.push({
        id: `pay-${pay.id}`,
        type: 'payment',
        date: pay.created_at,
        title: `Facture & Paiement`,
        subtitle: `Montant : ${pay.amount_total} FCFA (${pay.payment_method.toUpperCase()})`,
        details: pay
      });
    });

    // Sort timeline: newest first
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      patient,
      timeline,
      consultations,
      prescriptions,
      labExams,
      payments
    });
  } catch (error) {
    console.error("Get Patient Details Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des détails du patient." });
  }
});

// PUT /api/patients/:id
// Update patient
router.put('/:id', auth, async (req, res) => {
  try {
    const { firstName, lastName, birthDate, gender, phone, email, address, allergies, antecedents } = req.body;
    const patientId = req.params.id;

    const patient = await getAsync("SELECT id FROM patients WHERE id = ? AND clinic_id = ?", [patientId, req.user.clinicId]);
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé." });
    }

    await runAsync(
      `UPDATE patients SET 
        first_name = ?, last_name = ?, birth_date = ?, gender = ?, 
        phone = ?, email = ?, address = ?, allergies = ?, antecedents = ? 
       WHERE id = ? AND clinic_id = ?`,
      [firstName, lastName, birthDate, gender, phone, email || '', address || '', allergies || '', antecedents || '', patientId, req.user.clinicId]
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'PATIENT_UPDATE', ?)",
      [req.user.clinicId, req.user.userId, `Mise à jour du patient ID ${patientId}`]
    );

    res.json({ success: true, message: "Informations du patient mises à jour." });
  } catch (error) {
    console.error("Update Patient Error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du patient." });
  }
});

// DELETE /api/patients/:id (Archive patient)
router.delete('/:id', auth, async (req, res) => {
  try {
    const patientId = req.params.id;
    const patient = await getAsync("SELECT id, first_name, last_name FROM patients WHERE id = ? AND clinic_id = ?", [patientId, req.user.clinicId]);

    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé." });
    }

    // Toggle archiving
    await runAsync(
      "UPDATE patients SET archived = 1 WHERE id = ? AND clinic_id = ?",
      [patientId, req.user.clinicId]
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'PATIENT_ARCHIVE', ?)",
      [req.user.clinicId, req.user.userId, `Archivage du patient ${patient.first_name} ${patient.last_name}`]
    );

    res.json({ success: true, message: "Patient archivé avec succès." });
  } catch (error) {
    console.error("Archive Patient Error:", error);
    res.status(500).json({ error: "Erreur lors de l'archivage du patient." });
  }
});

module.exports = router;
