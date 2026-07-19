const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');

// POST /api/consultations
// Save a new consultation + optional prescription + optional lab exams
router.post('/', auth, async (req, res) => {
  try {
    const { patientId, motif, symptoms, constants, diagnosis, notes, prescriptionItems, labExams } = req.body;

    if (!patientId || !motif) {
      return res.status(400).json({ error: "Le patient et le motif sont requis." });
    }

    // Verify patient belongs to the clinic (prevent IDOR)
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé dans cette clinique." });
    }

    // 1. Insert Consultation (JSON constants field is handled natively by Supabase PostgreSQL JSONB)
    const { data: consultData, error: consultError } = await supabase
      .from('consultations')
      .insert({
        clinic_id: req.user.clinicId,
        patient_id: patientId,
        doctor_id: req.user.userId,
        motif,
        symptoms: symptoms || '',
        constants: constants || {},
        diagnosis: diagnosis || '',
        notes: notes || ''
      })
      .select()
      .single();

    if (consultError) throw consultError;
    const consultationId = consultData.id;

    // 2. If prescription items are provided, create a Prescription
    let prescriptionId = null;
    if (prescriptionItems && Array.isArray(prescriptionItems) && prescriptionItems.length > 0) {
      const { data: prescData, error: prescError } = await supabase
        .from('prescriptions')
        .insert({
          clinic_id: req.user.clinicId,
          consultation_id: consultationId,
          patient_id: patientId,
          doctor_id: req.user.userId,
          status: 'pending'
        })
        .select()
        .single();

      if (prescError) throw prescError;
      prescriptionId = prescData.id;

      for (const item of prescriptionItems) {
        const { medicationId, medicationName, dosage, frequency, duration, quantityPrescribed } = item;

        // Verify medication belongs to the clinic if a catalog medication ID is supplied (prevent IDOR)
        if (medicationId) {
          const { data: med, error: medError } = await supabase
            .from('medications')
            .select('id')
            .eq('id', medicationId)
            .eq('clinic_id', req.user.clinicId)
            .maybeSingle();

          if (medError) throw medError;
          if (!med) {
            return res.status(400).json({ error: `Le médicament ID ${medicationId} n'existe pas dans le catalogue de votre clinique.` });
          }
        }

        const { error: itemError } = await supabase
          .from('prescription_items')
          .insert({
            prescription_id: prescriptionId,
            medication_id: medicationId || null,
            medication_name: medicationName || 'Médicament libre',
            dosage: dosage || '',
            frequency: frequency || '',
            duration: duration || '',
            quantity_prescribed: quantityPrescribed || 1,
            quantity_dispensed: 0
          });

        if (itemError) throw itemError;
      }
    }

    // 3. If lab exams are ordered, create Lab Exams entries
    if (labExams && Array.isArray(labExams) && labExams.length > 0) {
      for (const testName of labExams) {
        if (testName && testName.trim()) {
          const { error: labError } = await supabase
            .from('lab_exams')
            .insert({
              clinic_id: req.user.clinicId,
              consultation_id: consultationId,
              patient_id: patientId,
              doctor_id: req.user.userId,
              test_name: testName.trim(),
              status: 'pending',
              results_text: '',
              results_json: {}
            });
          if (labError) throw labError;
        }
      }
    }

    // 4. Update any scheduled appointment of today for this patient with this doctor to 'completed'
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('appointments')
      .update({ status: 'completed' })
      .eq('clinic_id', req.user.clinicId)
      .eq('patient_id', patientId)
      .eq('practitioner_id', req.user.userId)
      .like('date_time', `${today}%`)
      .eq('status', 'scheduled');

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'CONSULTATION_CREATE',
      details: `Nouvelle consultation enregistrée pour patient ID ${patientId}`
    });

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
    
    const { data: consultation, error: consultError } = await supabase
      .from('consultations')
      .select('*, patient:patients(first_name, last_name, birth_date, gender), doctor:users(name)')
      .eq('id', consultationId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (consultError) throw consultError;
    if (!consultation) {
      return res.status(404).json({ error: "Consultation non trouvée." });
    }

    // Format output matching original schema expectation
    const formattedConsultation = {
      ...consultation,
      patient_first_name: consultation.patient ? consultation.patient.first_name : 'Inconnu',
      patient_last_name: consultation.patient ? consultation.patient.last_name : 'Inconnu',
      birth_date: consultation.patient ? consultation.patient.birth_date : '',
      gender: consultation.patient ? consultation.patient.gender : '',
      doctor_name: consultation.doctor ? consultation.doctor.name : 'Inconnu',
      constants: typeof consultation.constants === 'string' ? JSON.parse(consultation.constants) : consultation.constants
    };

    // Fetch associated prescription
    const { data: prescription, error: prescError } = await supabase
      .from('prescriptions')
      .select('*')
      .eq('consultation_id', consultationId)
      .maybeSingle();

    if (prescError) throw prescError;

    if (prescription) {
      const { data: items, error: itemsError } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', prescription.id);
        
      if (itemsError) throw itemsError;
      prescription.items = items || [];
    }

    // Fetch associated lab exams
    const { data: labExams, error: labError } = await supabase
      .from('lab_exams')
      .select('*')
      .eq('consultation_id', consultationId);

    if (labError) throw labError;

    res.json({
      consultation: formattedConsultation,
      prescription,
      labExams: labExams || []
    });
  } catch (error) {
    console.error("Get Consultation Detail Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des détails de la consultation." });
  }
});

module.exports = router;
