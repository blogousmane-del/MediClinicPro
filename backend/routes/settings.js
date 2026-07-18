const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { runAsync, getAsync, allAsync } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

// GET /api/settings/users
// Get all staff users
router.get('/users', auth, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const users = await allAsync(
      "SELECT id, name, email, role, active, created_at FROM users WHERE clinic_id = ? ORDER BY role ASC, name ASC",
      [req.user.clinicId]
    );
    res.json(users);
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

    const existingUser = await getAsync("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      return res.status(400).json({ error: "Un utilisateur avec cet email existe déjà." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await runAsync(
      `INSERT INTO users (clinic_id, name, email, password_hash, role, active) 
       VALUES (?, ?, ?, ?, ?, 1)`,
      [req.user.clinicId, name, email, passwordHash, role]
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'USER_CREATE', ?)",
      [req.user.clinicId, req.user.userId, `Création de l'utilisateur ${name} (${role})`]
    );

    res.status(201).json({
      id: result.lastID,
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

    const user = await getAsync("SELECT id, name FROM users WHERE id = ? AND clinic_id = ?", [userId, req.user.clinicId]);
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    if (parseInt(userId) === req.user.userId && active === 0) {
      return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
    }

    await runAsync(
      `UPDATE users SET 
        active = COALESCE(?, active), 
        role = COALESCE(?, role), 
        name = COALESCE(?, name) 
       WHERE id = ?`,
      [active !== undefined ? (active ? 1 : 0) : null, role, name, userId]
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'USER_UPDATE', ?)",
      [req.user.clinicId, req.user.userId, `Mise à jour de l'utilisateur ${user.name}`]
    );

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
    const clinic = await getAsync("SELECT * FROM clinics WHERE id = ?", [req.user.clinicId]);
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

    // If clinic has settings column, we can parse it.
    // Let's do a safe alter-check or just try-catch reading from a settings JSON file or settings column
    try {
      if (clinic.settings) {
        settings = JSON.parse(clinic.settings);
      }
    } catch (e) {
      // settings is empty or not formatted
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

    // Check if we need to add the settings column (migration safety)
    try {
      await runAsync("ALTER TABLE clinics ADD COLUMN settings TEXT DEFAULT '{}'");
    } catch (e) {
      // Column probably already exists, ignore error
    }

    const settingsJson = settings ? JSON.stringify(settings) : '{}';

    await runAsync(
      `UPDATE clinics SET 
        name = COALESCE(?, name), 
        address = COALESCE(?, address), 
        phone = COALESCE(?, phone), 
        logo = COALESCE(?, logo), 
        settings = ? 
       WHERE id = ?`,
      [name, address, phone, logo, settingsJson, req.user.clinicId]
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'CLINIC_CONFIG_UPDATE', 'Mise à jour des paramètres généraux')",
      [req.user.clinicId, req.user.userId]
    );

    res.json({ success: true, message: "Paramètres mis à jour avec succès." });
  } catch (error) {
    console.error("Update clinic settings error:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement des paramètres." });
  }
});

module.exports = router;
