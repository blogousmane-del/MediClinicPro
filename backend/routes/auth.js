const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../database');
const { JWT_SECRET, auth, checkRole } = require('../middleware/auth');

// POST /api/auth/register
// Clinic registration + Admin user creation
router.post('/register', async (req, res) => {
  try {
    const { clinicName, adminName, email, password, phone } = req.body;

    if (!clinicName || !adminName || !email || !password || !phone) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (checkError) throw checkError;
    if (existingUser) {
      return res.status(400).json({ error: "Cette adresse email est déjà enregistrée." });
    }

    // Create Clinic
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 14); // 14 days free trial

    const { data: clinicData, error: clinicError } = await supabase
      .from('clinics')
      .insert({
        name: clinicName,
        phone: phone,
        address: '',
        subscription_status: 'active',
        subscription_expires_at: trialExpiry.toISOString()
      })
      .select()
      .single();

    if (clinicError) throw clinicError;
    const clinicId = clinicData.id;

    // Create Admin User
    const passwordHash = await bcrypt.hash(password, 10);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        clinic_id: clinicId,
        name: adminName,
        email: email,
        password_hash: passwordHash,
        role: 'admin',
        active: 1
      })
      .select()
      .single();

    if (userError) throw userError;
    const userId = userData.id;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: clinicId,
      user_id: userId,
      action: 'REGISTER',
      details: 'Inscription de la clinique et de l\'administrateur'
    });

    // Send confirmation email asynchronously (non-blocking)
    const { sendConfirmationEmail } = require('../utils/mailer');
    sendConfirmationEmail(email, adminName, clinicName).catch(err => {
      console.error("[Email] Erreur d'envoi non bloquante lors de l'inscription :", err);
    });

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

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('active', 1)
      .maybeSingle();

    if (userError) throw userError;
    if (!user) {
      return res.status(400).json({ error: "Identifiants invalides." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Identifiants invalides." });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', user.clinic_id)
      .single();

    if (clinicError) throw clinicError;

    const token = jwt.sign(
      { userId: user.id, clinicId: user.clinic_id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: user.clinic_id,
      user_id: user.id,
      action: 'LOGIN',
      details: `Connexion de l'utilisateur ${user.name}`
    });

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
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, active')
      .eq('id', req.user.userId)
      .single();

    if (userError) throw userError;

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', req.user.clinicId)
      .single();

    if (clinicError) throw clinicError;

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
router.post('/onboarding', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { clinicAddress, clinicPhone, staff } = req.body;

    // 1. Update clinic info
    const { error: clinicUpdateError } = await supabase
      .from('clinics')
      .update({
        address: clinicAddress || '',
        phone: clinicPhone || ''
      })
      .eq('id', req.user.clinicId);

    if (clinicUpdateError) throw clinicUpdateError;

    // 2. Add staff users (if any)
    if (staff && Array.isArray(staff)) {
      for (const member of staff) {
        const { name, email, password, role } = member;
        if (name && email && password && role) {
          const { data: emailCheck, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .maybeSingle();

          if (checkError) throw checkError;

          if (!emailCheck) {
            const passwordHash = await bcrypt.hash(password, 10);
            const { error: insertUserError } = await supabase
              .from('users')
              .insert({
                clinic_id: req.user.clinicId,
                name,
                email,
                password_hash: passwordHash,
                role,
                active: 1
              });
            if (insertUserError) throw insertUserError;
          }
        }
      }
    }

    // 3. Log onboarding success
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'ONBOARDING',
      details: 'Configuration initiale complétée'
    });

    res.json({ success: true, message: "Configuration initiale enregistrée avec succès." });
  } catch (error) {
    console.error("Onboarding Error:", error);
    res.status(500).json({ error: "Erreur lors de la configuration initiale." });
  }
});

module.exports = router;
