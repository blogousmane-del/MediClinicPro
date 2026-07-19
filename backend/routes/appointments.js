const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');

// GET /api/appointments
// List appointments with optional filters
router.get('/', auth, async (req, res) => {
  try {
    const { date, practitionerId, status } = req.query;
    
    let queryBuilder = supabase
      .from('appointments')
      .select('*, patient:patients(first_name, last_name, phone), practitioner:users(name)')
      .eq('clinic_id', req.user.clinicId);

    if (date) {
      // Expecting YYYY-MM-DD
      queryBuilder = queryBuilder.like('date_time', `${date}%`);
    }

    if (practitionerId) {
      queryBuilder = queryBuilder.eq('practitioner_id', practitionerId);
    }

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: appointments, error } = await queryBuilder.order('date_time', { ascending: true });
    if (error) throw error;

    const formatted = (appointments || []).map(appt => ({
      ...appt,
      patient_first_name: appt.patient ? appt.patient.first_name : 'Inconnu',
      patient_last_name: appt.patient ? appt.patient.last_name : 'Inconnu',
      patient_phone: appt.patient ? appt.patient.phone : '',
      practitioner_name: appt.practitioner ? appt.practitioner.name : 'Inconnu'
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Get Appointments Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des rendez-vous." });
  }
});

// POST /api/appointments
// Book a new appointment
router.post('/', auth, async (req, res) => {
  try {
    const { patientId, practitionerId, dateTime, duration, motif } = req.body;

    if (!patientId || !practitionerId || !dateTime || !motif) {
      return res.status(400).json({ error: "Tous les champs obligatoires doivent être renseignés." });
    }

    // Verify patient belongs to the user's clinic (prevent IDOR)
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('first_name, last_name, phone')
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé dans cette clinique." });
    }

    // Verify practitioner belongs to the user's clinic (prevent IDOR)
    const { data: practitioner, error: practitionerError } = await supabase
      .from('users')
      .select('id')
      .eq('id', practitionerId)
      .eq('clinic_id', req.user.clinicId)
      .eq('active', 1)
      .maybeSingle();

    if (practitionerError) throw practitionerError;
    if (!practitioner) {
      return res.status(404).json({ error: "Praticien non trouvé dans cette clinique." });
    }

    // Check conflict (practitioner scheduled at exact same time)
    const { data: conflict, error: conflictError } = await supabase
      .from('appointments')
      .select('id')
      .eq('clinic_id', req.user.clinicId)
      .eq('practitioner_id', practitionerId)
      .eq('date_time', dateTime)
      .eq('status', 'scheduled')
      .maybeSingle();

    if (conflictError) throw conflictError;
    if (conflict) {
      return res.status(400).json({ 
        error: "Ce praticien a déjà un rendez-vous planifié à cette heure précise.",
        conflict: true
      });
    }

    const { data: apptResult, error: insertError } = await supabase
      .from('appointments')
      .insert({
        clinic_id: req.user.clinicId,
        patient_id: patientId,
        practitioner_id: practitionerId,
        date_time: dateTime,
        duration: duration || 30,
        motif,
        status: 'scheduled'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('name')
      .eq('id', req.user.clinicId)
      .single();

    if (clinicError) throw clinicError;

    // Simulate SMS sending (log to server console & action log)
    const formattedDate = new Date(dateTime).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const smsMessage = `Rappel : Bonjour ${patient.first_name} ${patient.last_name}, votre RDV à la clinique "${clinic.name}" est programmé le ${formattedDate}.`;
    console.log(`[SMS SIMULATOR] To: ${patient.phone} | Content: "${smsMessage}"`);

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'APPOINTMENT_CREATE',
      details: `RDV pris pour ${patient.first_name} ${patient.last_name} le ${dateTime}`
    });

    const { data: newAppt, error: loadError } = await supabase
      .from('appointments')
      .select('*, patient:patients(first_name, last_name), practitioner:users(name)')
      .eq('id', apptResult.id)
      .single();

    if (loadError) throw loadError;

    const formattedNewAppt = {
      ...newAppt,
      patient_first_name: newAppt.patient ? newAppt.patient.first_name : '',
      patient_last_name: newAppt.patient ? newAppt.patient.last_name : '',
      practitioner_name: newAppt.practitioner ? newAppt.practitioner.name : ''
    };

    res.status(201).json({
      appointment: formattedNewAppt,
      smsSimulated: {
        to: patient.phone,
        message: smsMessage
      }
    });
  } catch (error) {
    console.error("Create Appointment Error:", error);
    res.status(500).json({ error: "Erreur lors de la création du rendez-vous." });
  }
});

// PUT /api/appointments/:id
// Update / Reschedule or Cancel appointment
router.put('/:id', auth, async (req, res) => {
  try {
    const { dateTime, duration, motif, status } = req.body;
    const apptId = req.params.id;

    const { data: appt, error: checkError } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', apptId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!appt) {
      return res.status(404).json({ error: "Rendez-vous non trouvé." });
    }

    if (status === 'scheduled' && dateTime && dateTime !== appt.date_time) {
      // Check conflict for new time
      const { data: conflict, error: conflictError } = await supabase
        .from('appointments')
        .select('id')
        .eq('clinic_id', req.user.clinicId)
        .eq('practitioner_id', appt.practitioner_id)
        .eq('date_time', dateTime)
        .eq('status', 'scheduled')
        .neq('id', apptId)
        .maybeSingle();

      if (conflictError) throw conflictError;
      if (conflict) {
        return res.status(400).json({ error: "Ce praticien a déjà un rendez-vous planifié à ce créneau." });
      }
    }

    const { error: updateError } = await supabase
      .from('appointments')
      .update({
        date_time: dateTime || appt.date_time,
        duration: duration !== undefined ? duration : appt.duration,
        motif: motif || appt.motif,
        status: status || appt.status
      })
      .eq('id', apptId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    // If cancelled, trigger simulated cancellation SMS
    if (status === 'cancelled') {
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('first_name, last_name, phone')
        .eq('id', appt.patient_id)
        .eq('clinic_id', req.user.clinicId)
        .single();
        
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('name')
        .eq('id', req.user.clinicId)
        .single();

      if (!patientError && !clinicError && patient) {
        const smsMessage = `Annulation : Bonjour ${patient.first_name} ${patient.last_name}, votre RDV du ${new Date(appt.date_time).toLocaleString('fr-FR')} à la clinique "${clinic.name}" a été annulé.`;
        console.log(`[SMS SIMULATOR] To: ${patient.phone} | Content: "${smsMessage}"`);
      }
    }

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'APPOINTMENT_UPDATE',
      details: `RDV ID ${apptId} mis à jour (Statut: ${status || appt.status})`
    });

    res.json({ success: true, message: "Rendez-vous mis à jour avec succès." });
  } catch (error) {
    console.error("Update Appointment Error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du rendez-vous." });
  }
});

module.exports = router;
