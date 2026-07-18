const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../database');
const { auth } = require('../middleware/auth');

// POST /api/consultations
// Save a new consultation + optional prescription + optional lab exams
router.post('/', auth, async (req, res) => {
  try {
    const { patientId, motif, symptoms, constants, diagnosis, notes, prescriptionItems, labExams } = req.body;

    if (!patientId || !motif) {
      return res.status(400).json({ error: "Le patient et le motif sont requis." });
    }

    // 1. Insert Consultation
    const constantsJson = constants ? JSON.stringify(constants) : '{}';
    const consultationResult = await runAsync(
      `INSERT INTO consultations (clinic_id, patient_id, doctor_id, motif, symptoms, constants, diagnosis, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.clinicId, patientId, req.user.userId, motif, symptoms || '', constantsJson, diagnosis || '', notes || '']
    );
    const consultationId = consultationResult.lastID;

    // 2. If prescription items are provided, create a Prescription
    let prescriptionId = null;
    if (prescriptionItems && Array.isArray(prescriptionItems) && prescriptionItems.length > 0) {
      const prescriptionResult = await runAsync(
        `INSERT INTO prescriptions (clinic_id, consultation_id, patient_id, doctor_id, status) 
         VALUES (?, ?, ?, ?, 'pending')`,
        [req.user.clinicId, consultationId, patientId, req.user.userId]
      );
      prescriptionId = prescriptionResult.lastID;

      for (const item of prescriptionItems) {
        const { medicationId, medicationName, dosage, frequency, duration, quantityPrescribed } = item;
        await runAsync(
          `INSERT INTO prescription_items (prescription_id, medication_id, medication_name, dosage, frequency, duration, quantity_prescribed, quantity_dispensed) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
          [
            prescriptionId,
            medicationId || null,
            medicationName || 'Médicament libre',
            dosage || '',
            frequency || '',
            duration || '',
            quantityPrescribed || 1
          ]
        );
      }
    }

    // 3. If lab exams are ordered, create Lab Exams entries
    if (labExams && Array.isArray(labExams) && labExams.length > 0) {
      for (const testName of labExams) {
        if (testName && testName.trim()) {
          await runAsync(
            `INSERT INTO lab_exams (clinic_id, consultation_id, patient_id, doctor_id, test_name, status) 
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [req.user.clinicId, consultationId, patientId, req.user.userId, testName.trim()]
          );
        }
      }
    }

    // 4. Update any scheduled appointment of today for this patient with this doctor to 'completed'
    const today = new Date().toISOString().split('T')[0];
    await runAsync(
      `UPDATE appointments SET status = 'completed' 
       WHERE clinic_id = ? AND patient_id = ? AND practitioner_id = ? AND date_time LIKE ? AND status = 'scheduled'`,
      [req.user.clinicId, patientId, req.user.userId, `${today}%`]
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'CONSULTATION_CREATE', ?)",
      [req.user.clinicId, req.user.userId, `Nouvelle consultation enregistrée pour patient ID ${patientId}`]
    );

    res.status(201).json({
      success: true,
      consultationId,
      prescriptionId,
      message: "Consultation et ordonnance/examens enregistrés."
    });
  } catch (error) {
    console.error("Create Consultation Error:", error);
    res.status(500).json({ error: "Erreur lors de la création de la consultation." });
  }
});

// GET /api/consultations/:id
// Get a single consultation details (including prescription and lab results)
router.get('/:id', auth, async (req, res) => {
  try {
    const consultationId = req.params.id;
    const consultation = await getAsync(
      `SELECT c.*, p.first_name as patient_first_name, p.last_name as patient_last_name, p.birth_date, p.gender, u.name as doctor_name 
       FROM consultations c
       JOIN patients p ON c.patient_id = p.id
       JOIN users u ON c.doctor_id = u.id
       WHERE c.id = ? AND c.clinic_id = ?`,
      [consultationId, req.user.clinicId]
    );

    if (!consultation) {
      return res.status(404).json({ error: "Consultation non trouvée." });
    }

    consultation.constants = JSON.parse(consultation.constants || '{}');

    // Fetch associated prescription
    const prescription = await getAsync(
      "SELECT * FROM prescriptions WHERE consultation_id = ?",
      [consultationId]
    );

    if (prescription) {
      prescription.items = await allAsync(
        "SELECT * FROM prescription_items WHERE prescription_id = ?",
        [prescription.id]
      );
    }

    // Fetch associated lab exams
    const labExams = await allAsync(
      "SELECT * FROM lab_exams WHERE consultation_id = ?",
      [consultationId]
    );

    res.json({
      consultation,
      prescription,
      labExams
    });
  } catch (error) {
    console.error("Get Consultation Detail Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des détails de la consultation." });
  }
});

module.exports = router;
