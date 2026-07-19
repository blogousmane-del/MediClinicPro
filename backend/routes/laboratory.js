const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

// GET /api/laboratory/exams
// List laboratory exams in the queue
router.get('/exams', auth, async (req, res) => {
  try {
    const { status } = req.query; // pending or completed
    let query = `
      SELECT le.*, p.first_name as patient_first_name, p.last_name as patient_last_name, p.folder_number, p.birth_date, p.gender, u.name as doctor_name
      FROM lab_exams le
      JOIN patients p ON le.patient_id = p.id
      JOIN users u ON le.doctor_id = u.id
      WHERE le.clinic_id = ?
    `;
    const params = [req.user.clinicId];

    if (status) {
      query += " AND le.status = ?";
      params.push(status);
    }

    query += " ORDER BY le.created_at DESC";
    const exams = await allAsync(query, params);
    res.json(exams);
  } catch (error) {
    console.error("Get Lab Exams Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des examens de laboratoire." });
  }
});

// POST /api/laboratory/results/:id
// Record results for a lab exam
router.post('/results/:id', auth, checkRole(['admin', 'lab_tech']), async (req, res) => {
  try {
    const examId = req.params.id;
    const { resultsText, resultsJson } = req.body;

    if (!resultsText) {
      return res.status(400).json({ error: "Les résultats textuels de l'examen sont obligatoires." });
    }

    const exam = await getAsync(
      "SELECT * FROM lab_exams WHERE id = ? AND clinic_id = ?",
      [examId, req.user.clinicId]
    );

    if (!exam) {
      return res.status(404).json({ error: "Examen de laboratoire non trouvé." });
    }

    const completedAt = new Date().toISOString();
    const jsonStr = resultsJson ? JSON.stringify(resultsJson) : '{}';

    await runAsync(
      `UPDATE lab_exams SET 
        status = 'completed',
        results_text = ?,
        results_json = ?,
        technician_id = ?,
        completed_at = ?
       WHERE id = ? AND clinic_id = ?`,
      [resultsText, jsonStr, req.user.userId, completedAt, examId, req.user.clinicId]
    );

    // Log Activity
    const patient = await getAsync("SELECT first_name, last_name FROM patients WHERE id = ? AND clinic_id = ?", [exam.patient_id, req.user.clinicId]);
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'LAB_RESULTS_ENTER', ?)",
      [req.user.clinicId, req.user.userId, `Saisie des résultats d'examen (${exam.test_name}) pour ${patient.first_name} ${patient.last_name}`]
    );

    res.json({ success: true, message: "Résultats d'analyse enregistrés." });
  } catch (error) {
    console.error("Enter Lab Results Error:", error);
    res.status(500).json({ error: "Erreur lors de la saisie des résultats." });
  }
});

module.exports = router;
