const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../database');
const { auth } = require('../middleware/auth');

// GET /api/appointments
// List appointments with optional filters
router.get('/', auth, async (req, res) => {
  try {
    const { date, practitionerId, status } = req.query;
    let query = `
      SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name, p.phone as patient_phone, u.name as practitioner_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON a.practitioner_id = u.id
      WHERE a.clinic_id = ?
    `;
    const params = [req.user.clinicId];

    if (date) {
      // Expecting YYYY-MM-DD
      query += " AND a.date_time LIKE ?";
      params.push(`${date}%`);
    }

    if (practitionerId) {
      query += " AND a.practitioner_id = ?";
      params.push(practitionerId);
    }

    if (status) {
      query += " AND a.status = ?";
      params.push(status);
    }

    query += " ORDER BY a.date_time ASC";
    const appointments = await allAsync(query, params);
    res.json(appointments);
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
    const patient = await getAsync(
      "SELECT first_name, last_name, phone FROM patients WHERE id = ? AND clinic_id = ?",
      [patientId, req.user.clinicId]
    );
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé dans cette clinique." });
    }

    // Verify practitioner belongs to the user's clinic (prevent IDOR)
    const practitioner = await getAsync(
      "SELECT id FROM users WHERE id = ? AND clinic_id = ? AND active = 1",
      [practitionerId, req.user.clinicId]
    );
    if (!practitioner) {
      return res.status(404).json({ error: "Praticien non trouvé dans cette clinique." });
    }

    // Check conflict (practitioner scheduled at exact same time)
    const conflict = await getAsync(
      `SELECT id FROM appointments 
       WHERE clinic_id = ? AND practitioner_id = ? AND date_time = ? AND status = 'scheduled'`,
      [req.user.clinicId, practitionerId, dateTime]
    );

    if (conflict) {
      return res.status(400).json({ 
        error: "Ce praticien a déjà un rendez-vous planifié à cette heure précise.",
        conflict: true
      });
    }

    const result = await runAsync(
      `INSERT INTO appointments (clinic_id, patient_id, practitioner_id, date_time, duration, motif, status) 
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`,
      [req.user.clinicId, patientId, practitionerId, dateTime, duration || 30, motif]
    );

    const clinic = await getAsync("SELECT name FROM clinics WHERE id = ?", [req.user.clinicId]);

    // Simulate SMS sending (log to server console & action log)
    const formattedDate = new Date(dateTime).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
    const smsMessage = `Rappel : Bonjour ${patient.first_name} ${patient.last_name}, votre RDV à la clinique "${clinic.name}" est programmé le ${formattedDate}.`;
    console.log(`[SMS SIMULATOR] To: ${patient.phone} | Content: "${smsMessage}"`);

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'APPOINTMENT_CREATE', ?)",
      [req.user.clinicId, req.user.userId, `RDV pris pour ${patient.first_name} ${patient.last_name} le ${dateTime}`]
    );

    const newAppt = await getAsync(
      `SELECT a.*, p.first_name as patient_first_name, p.last_name as patient_last_name, u.name as practitioner_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN users u ON a.practitioner_id = u.id
       WHERE a.id = ?`,
      [result.lastID]
    );

    res.status(201).json({
      appointment: newAppt,
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

    const appt = await getAsync("SELECT * FROM appointments WHERE id = ? AND clinic_id = ?", [apptId, req.user.clinicId]);
    if (!appt) {
      return res.status(404).json({ error: "Rendez-vous non trouvé." });
    }

    if (status === 'scheduled' && dateTime && dateTime !== appt.date_time) {
      // Check conflict for new time
      const conflict = await getAsync(
        `SELECT id FROM appointments 
         WHERE clinic_id = ? AND practitioner_id = ? AND date_time = ? AND status = 'scheduled' AND id != ?`,
        [req.user.clinicId, appt.practitioner_id, dateTime, apptId]
      );

      if (conflict) {
        return res.status(400).json({ error: "Ce praticien a déjà un rendez-vous planifié à ce créneau." });
      }
    }

    await runAsync(
      `UPDATE appointments SET 
        date_time = COALESCE(?, date_time), 
        duration = COALESCE(?, duration), 
        motif = COALESCE(?, motif), 
        status = COALESCE(?, status) 
       WHERE id = ?`,
      [dateTime, duration, motif, status, apptId]
    );

    // If cancelled, trigger simulated cancellation SMS
    if (status === 'cancelled') {
      const patient = await getAsync("SELECT first_name, last_name, phone FROM patients WHERE id = ? AND clinic_id = ?", [appt.patient_id, req.user.clinicId]);
      const clinic = await getAsync("SELECT name FROM clinics WHERE id = ?", [req.user.clinicId]);
      const smsMessage = `Annulation : Bonjour ${patient.first_name} ${patient.last_name}, votre RDV du ${new Date(appt.date_time).toLocaleString('fr-FR')} à la clinique "${clinic.name}" a été annulé.`;
      console.log(`[SMS SIMULATOR] To: ${patient.phone} | Content: "${smsMessage}"`);
    }

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'APPOINTMENT_UPDATE', ?)",
      [req.user.clinicId, req.user.userId, `RDV ID ${apptId} mis à jour (Statut: ${status || appt.status})`]
    );

    res.json({ success: true, message: "Rendez-vous mis à jour avec succès." });
  } catch (error) {
    console.error("Update Appointment Error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du rendez-vous." });
  }
});

module.exports = router;
