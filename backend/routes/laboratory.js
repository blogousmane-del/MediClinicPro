const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

// GET /api/laboratory/exams
// List laboratory exams in the queue
router.get('/exams', auth, async (req, res) => {
  try {
    const { status } = req.query; // pending or completed

    let queryBuilder = supabase
      .from('lab_exams')
      .select('*, patient:patients(first_name, last_name, folder_number, birth_date, gender), doctor:users!lab_exams_doctor_id_fkey(name)')
      .eq('clinic_id', req.user.clinicId);

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: exams, error } = await queryBuilder.order('created_at', { ascending: false });
    if (error) throw error;

    const formatted = (exams || []).map(exam => ({
      ...exam,
      patient_first_name: exam.patient ? exam.patient.first_name : 'Inconnu',
      patient_last_name: exam.patient ? exam.patient.last_name : 'Inconnu',
      folder_number: exam.patient ? exam.patient.folder_number : '',
      birth_date: exam.patient ? exam.patient.birth_date : '',
      gender: exam.patient ? exam.patient.gender : '',
      doctor_name: exam.doctor ? exam.doctor.name : 'Inconnu',
      results_json: typeof exam.results_json === 'string' ? JSON.parse(exam.results_json) : exam.results_json
    }));

    res.json(formatted);
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

    const { data: exam, error: checkError } = await supabase
      .from('lab_exams')
      .select('*')
      .eq('id', examId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!exam) {
      return res.status(404).json({ error: "Examen de laboratoire non trouvé." });
    }

    const completedAt = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('lab_exams')
      .update({
        status: 'completed',
        results_text: resultsText,
        results_json: resultsJson || {},
        technician_id: req.user.userId,
        completed_at: completedAt
      })
      .eq('id', examId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    // Log Activity
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('first_name, last_name')
      .eq('id', exam.patient_id)
      .eq('clinic_id', req.user.clinicId)
      .single();

    if (!patientError && patient) {
      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'LAB_RESULTS_ENTER',
        details: `Saisie des résultats d'examen (${exam.test_name}) pour ${patient.first_name} ${patient.last_name}`
      });
    }

    res.json({ success: true, message: "Résultats d'analyse enregistrés." });
  } catch (error) {
    console.error("Enter Lab Results Error:", error);
    res.status(500).json({ error: "Erreur lors de la saisie des résultats." });
  }
});

module.exports = router;
