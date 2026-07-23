const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { validateAndNormalizePhone } = require('../utils/phone');

// GET /api/patients
// Search and list patients
router.get('/', auth, async (req, res) => {
  try {
    const { q, showArchived } = req.query;
    const archivedVal = showArchived === 'true' ? 1 : 0;
    
    let queryBuilder = supabase
      .from('patients')
      .select('*')
      .eq('clinic_id', req.user.clinicId)
      .eq('archived', archivedVal);

    if (q) {
      // Case-insensitive search using ilike in OR block
      queryBuilder = queryBuilder.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,folder_number.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data: patients, error } = await queryBuilder
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true });

    if (error) throw error;
    res.json(patients || []);
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

    const phoneCheck = validateAndNormalizePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.error });
    }
    const normalizedPhone = phoneCheck.e164;

    // Check for exact duplicate (same name + birthdate + phone)
    const { data: duplicate, error: checkError } = await supabase
      .from('patients')
      .select('id')
      .eq('clinic_id', req.user.clinicId)
      .eq('first_name', firstName)
      .eq('last_name', lastName)
      .eq('birth_date', birthDate)
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (checkError) throw checkError;
    if (duplicate) {
      return res.status(400).json({ error: "Un patient avec le même nom, date de naissance et téléphone existe déjà." });
    }

    // Generate folder number (MED-YYYY-XXXX) - globally unique to prevent key conflicts
    const currentYear = new Date().getFullYear();
    const prefix = `MED-${currentYear}-`;

    const { data: existingFolders, error: fetchError } = await supabase
      .from('patients')
      .select('folder_number')
      .like('folder_number', `${prefix}%`);

    if (fetchError) throw fetchError;

    let nextSeq = 1;
    if (existingFolders && existingFolders.length > 0) {
      const sequences = existingFolders.map(p => {
        const parts = p.folder_number.split('-');
        const lastPart = parts[parts.length - 1];
        return parseInt(lastPart, 10) || 0;
      });
      nextSeq = Math.max(...sequences) + 1;
    }

    const sequenceNum = String(nextSeq).padStart(4, '0');
    const folderNumber = `${prefix}${sequenceNum}`;

    const { data: newPatient, error: insertError } = await supabase
      .from('patients')
      .insert({
        clinic_id: req.user.clinicId,
        folder_number: folderNumber,
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        gender,
        phone: normalizedPhone,
        email: email || '',
        address: address || '',
        allergies: allergies || '',
        antecedents: antecedents || '',
        archived: 0
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PATIENT_CREATE',
      details: `Création du patient ${firstName} ${lastName} (${folderNumber})`
    });

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
    
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé." });
    }

    // Fetch consultations with doctor name
    const { data: consultations, error: consultsError } = await supabase
      .from('consultations')
      .select('*, doctor:users(name)')
      .eq('patient_id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .order('date_time', { ascending: false });

    if (consultsError) throw consultsError;

    // Fetch prescriptions with doctor name
    const { data: prescriptions, error: prescError } = await supabase
      .from('prescriptions')
      .select('*, doctor:users(name)')
      .eq('patient_id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .order('date_time', { ascending: false });

    if (prescError) throw prescError;

    // Hydrate prescription items
    for (const pr of prescriptions) {
      pr.doctor_name = pr.doctor ? pr.doctor.name : 'Inconnu';
      
      const { data: items, error: itemsError } = await supabase
        .from('prescription_items')
        .select('*')
        .eq('prescription_id', pr.id);
        
      if (itemsError) throw itemsError;
      pr.items = items || [];
    }

    // Fetch lab exams with doctor and technician names
    const { data: labExams, error: labError } = await supabase
      .from('lab_exams')
      .select('*, doctor:users!lab_exams_doctor_id_fkey(name), technician:users!lab_exams_technician_id_fkey(name)')
      .eq('patient_id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .order('created_at', { ascending: false });

    if (labError) throw labError;

    // Fetch payments
    const { data: payments, error: payError } = await supabase
      .from('payments')
      .select('*')
      .eq('patient_id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .order('created_at', { ascending: false });

    if (payError) throw payError;

    // Compile clinical history timeline
    const timeline = [];
    
    (consultations || []).forEach(c => {
      // Parse JSON constants if stringified, otherwise use native object
      const constants = typeof c.constants === 'string' ? JSON.parse(c.constants) : c.constants;
      
      timeline.push({
        id: `c-${c.id}`,
        type: 'consultation',
        date: c.date_time,
        title: `Consultation : ${c.motif}`,
        subtitle: `Par ${c.doctor ? c.doctor.name : 'Inconnu'}`,
        details: {
          ...c,
          constants,
          doctor_name: c.doctor ? c.doctor.name : 'Inconnu'
        }
      });
    });

    (prescriptions || []).forEach(p => {
      timeline.push({
        id: `p-${p.id}`,
        type: 'prescription',
        date: p.date_time,
        title: `Ordonnance`,
        subtitle: `Par ${p.doctor_name} (${p.status === 'dispensed' ? 'Délivrée' : 'En attente'})`,
        details: p
      });
    });

    (labExams || []).forEach(le => {
      const results_json = typeof le.results_json === 'string' ? JSON.parse(le.results_json) : le.results_json;
      
      timeline.push({
        id: `le-${le.id}`,
        type: 'lab',
        date: le.created_at,
        title: `Examen de Laboratoire : ${le.test_name}`,
        subtitle: `Statut : ${le.status === 'completed' ? 'Résultats saisis' : 'En attente'}`,
        details: {
          ...le,
          results_json,
          doctor_name: le.doctor ? le.doctor.name : 'Inconnu',
          technician_name: le.technician ? le.technician.name : 'Inconnu'
        }
      });
    });

    (payments || []).forEach(pay => {
      const items = typeof pay.items === 'string' ? JSON.parse(pay.items) : pay.items;
      
      timeline.push({
        id: `pay-${pay.id}`,
        type: 'payment',
        date: pay.created_at,
        title: `Facture & Paiement`,
        subtitle: `Montant : ${pay.amount_total} FCFA (${pay.payment_method.toUpperCase()})`,
        details: {
          ...pay,
          items
        }
      });
    });

    // Sort timeline: newest first
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      patient,
      timeline,
      consultations: (consultations || []).map(c => ({
        ...c,
        constants: typeof c.constants === 'string' ? JSON.parse(c.constants) : c.constants,
        doctor_name: c.doctor ? c.doctor.name : 'Inconnu'
      })),
      prescriptions,
      labExams: (labExams || []).map(le => ({
        ...le,
        results_json: typeof le.results_json === 'string' ? JSON.parse(le.results_json) : le.results_json,
        doctor_name: le.doctor ? le.doctor.name : 'Inconnu',
        technician_name: le.technician ? le.technician.name : 'Inconnu'
      })),
      payments: (payments || []).map(pay => ({
        ...pay,
        items: typeof pay.items === 'string' ? JSON.parse(pay.items) : pay.items
      }))
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

    const phoneCheck = validateAndNormalizePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.error });
    }
    const normalizedPhone = phoneCheck.e164;

    // Verify patient belongs to the clinic
    const { data: patient, error: checkError } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé." });
    }

    const { error: updateError } = await supabase
      .from('patients')
      .update({
        first_name: firstName,
        last_name: lastName,
        birth_date: birthDate,
        gender,
        phone: normalizedPhone,
        email: email || '',
        address: address || '',
        allergies: allergies || '',
        antecedents: antecedents || ''
      })
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PATIENT_UPDATE',
      details: `Mise à jour du patient ID ${patientId}`
    });

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
    
    const { data: patient, error: checkError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé." });
    }

    const { error: updateError } = await supabase
      .from('patients')
      .update({ archived: 1 })
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PATIENT_ARCHIVE',
      details: `Archivage du patient ${patient.first_name} ${patient.last_name}`
    });

    res.json({ success: true, message: "Patient archivé avec succès." });
  } catch (error) {
    console.error("Archive Patient Error:", error);
    res.status(500).json({ error: "Erreur lors de l'archivage du patient." });
  }
});

module.exports = router;
