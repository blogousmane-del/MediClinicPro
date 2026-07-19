const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

// GET /api/settings/users
// Get all staff users
router.get('/users', auth, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, active, created_at')
      .eq('clinic_id', req.user.clinicId)
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    res.json(users || []);
  } catch (error) {
    console.error("Get settings users error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs." });
  }
});

// POST /api/settings/users
// Create a new staff user
router.post('/users', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingUser) {
      return res.status(400).json({ error: "Un utilisateur avec cet email existe déjà." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        clinic_id: req.user.clinicId,
        name,
        email,
        password_hash: passwordHash,
        role,
        active: 1
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'USER_CREATE',
      details: `Création de l'utilisateur ${name} (${role})`
    });

    res.status(201).json({
      id: newUser.id,
      name,
      email,
      role,
      active: 1
    });
  } catch (error) {
    console.error("Create User settings error:", error);
    res.status(500).json({ error: "Erreur lors de la création de l'utilisateur." });
  }
});

// PUT /api/settings/users/:id
// Update user active status or role
router.put('/users/:id', auth, checkRole(['admin']), async (req, res) => {
  try {
    const userId = req.params.id;
    const { active, role, name } = req.body;

    const { data: user, error: checkError } = await supabase
      .from('users')
      .select('id, name')
      .eq('id', userId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    if (parseInt(userId) === req.user.userId && active === 0) {
      return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        active: active !== undefined ? (active ? 1 : 0) : undefined,
        role: role || undefined,
        name: name || undefined
      })
      .eq('id', userId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'USER_UPDATE',
      details: `Mise à jour de l'utilisateur ${user.name}`
    });

    res.json({ success: true, message: "Utilisateur mis à jour avec succès." });
  } catch (error) {
    console.error("Update settings user error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'utilisateur." });
  }
});

// GET /api/settings/clinic
// Get clinic details & custom configuration
router.get('/clinic', auth, async (req, res) => {
  try {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', req.user.clinicId)
      .maybeSingle();

    if (error) throw error;
    if (!clinic) {
      return res.status(404).json({ error: "Clinique non trouvée." });
    }

    // Default configuration if settings column is null or doesn't exist
    let settings = {
      tariffs: {
        consultation_general: 10000,
        consultation_specialist: 20000,
        nfs: 5000,
        malaria_test: 3000,
        glycemia: 2000
      },
      notifications: {
        sms_reminders: true,
        stock_alerts: true
      }
    };

    if (clinic.settings) {
      settings = typeof clinic.settings === 'string' ? JSON.parse(clinic.settings) : clinic.settings;
    }

    res.json({
      ...clinic,
      settings
    });
  } catch (error) {
    console.error("Get clinic details error:", error);
    res.status(500).json({ error: "Erreur lors du chargement des paramètres de la clinique." });
  }
});

// PUT /api/settings/clinic
// Update clinic details & config
router.put('/clinic', auth, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { name, address, phone, logo, settings } = req.body;

    const { error: updateError } = await supabase
      .from('clinics')
      .update({
        name: name || undefined,
        address: address || undefined,
        phone: phone || undefined,
        logo: logo || undefined,
        settings: settings || undefined // PostgreSQL JSONB handles it natively
      })
      .eq('id', req.user.clinicId);

    if (updateError) throw updateError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'CLINIC_CONFIG_UPDATE',
      details: 'Mise à jour des paramètres généraux'
    });

    res.json({ success: true, message: "Paramètres mis à jour avec succès." });
  } catch (error) {
    console.error("Update clinic settings error:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement des paramètres." });
  }
});

module.exports = router;
