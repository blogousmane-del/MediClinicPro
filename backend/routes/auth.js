const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { runAsync, getAsync } = require('../database');
const { JWT_SECRET, auth } = require('../middleware/auth');

// POST /api/auth/register
// Clinic registration + Admin user creation
router.post('/register', async (req, res) => {
  try {
    const { clinicName, adminName, email, password, phone } = req.body;

    if (!clinicName || !adminName || !email || !password || !phone) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    // Check if email already exists
    const existingUser = await getAsync("SELECT id FROM users WHERE email = ?", [email]);
    if (existingUser) {
      return res.status(400).json({ error: "Cette adresse email est déjà enregistrée." });
    }

    // Create Clinic
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 14); // 14 days free trial

    const clinicResult = await runAsync(
      `INSERT INTO clinics (name, address, phone, subscription_status, subscription_expires_at) 
       VALUES (?, '', ?, 'active', ?)`,
      [clinicName, phone, trialExpiry.toISOString()]
    );
    const clinicId = clinicResult.lastID;

    // Create Admin User
    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await runAsync(
      `INSERT INTO users (clinic_id, name, email, password_hash, role) 
       VALUES (?, ?, ?, ?, 'admin')`,
      [clinicId, adminName, email, passwordHash]
    );
    const userId = userResult.lastID;

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'REGISTER', 'Inscription de la clinique et de l\'administrateur')",
      [clinicId, userId]
    );

    // Generate Token
    const token = jwt.sign(
      { userId, clinicId, role: 'admin', name: adminName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        name: adminName,
        email,
        role: 'admin'
      },
      clinic: {
        id: clinicId,
        name: clinicName,
        subscription_status: 'active',
        subscription_expires_at: trialExpiry.toISOString()
      }
    });
  } catch (error) {
    console.error("Registration Error:", error);
    res.status(500).json({ error: "Une erreur est survenue lors de l'inscription." });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email et mot de passe requis." });
    }

    const user = await getAsync("SELECT * FROM users WHERE email = ? AND active = 1", [email]);
    if (!user) {
      return res.status(400).json({ error: "Identifiants invalides." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Identifiants invalides." });
    }

    const clinic = await getAsync("SELECT * FROM clinics WHERE id = ?", [user.clinic_id]);

    const token = jwt.sign(
      { userId: user.id, clinicId: user.clinic_id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log Activity
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'LOGIN', ?)",
      [user.clinic_id, user.id, `Connexion de l'utilisateur ${user.name}`]
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      clinic
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Une erreur est survenue lors de la connexion." });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const user = await getAsync("SELECT id, name, email, role, active FROM users WHERE id = ?", [req.user.userId]);
    const clinic = await getAsync("SELECT * FROM clinics WHERE id = ?", [req.user.clinicId]);

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé." });
    }

    res.json({
      user,
      clinic
    });
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du profil." });
  }
});

// POST /api/auth/onboarding
router.post('/onboarding', auth, async (req, res) => {
  try {
    const { clinicAddress, clinicPhone, staff, activeModules } = req.body;

    // 1. Update clinic info
    await runAsync(
      "UPDATE clinics SET address = ?, phone = ? WHERE id = ?",
      [clinicAddress || '', clinicPhone || '', req.user.clinicId]
    );

    // 2. Add staff users (if any)
    if (staff && Array.isArray(staff)) {
      for (const member of staff) {
        const { name, email, password, role } = member;
        if (name && email && password && role) {
          const emailCheck = await getAsync("SELECT id FROM users WHERE email = ?", [email]);
          if (!emailCheck) {
            const passwordHash = await bcrypt.hash(password, 10);
            await runAsync(
              "INSERT INTO users (clinic_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
              [req.user.clinicId, name, email, passwordHash, role]
            );
          }
        }
      }
    }

    // 3. Log onboarding success
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'ONBOARDING', 'Configuration initiale complétée')",
      [req.user.clinicId, req.user.userId]
    );

    res.json({ success: true, message: "Configuration initiale enregistrée avec succès." });
  } catch (error) {
    console.error("Onboarding Error:", error);
    res.status(500).json({ error: "Erreur lors de la configuration initiale." });
  }
});

module.exports = router;
