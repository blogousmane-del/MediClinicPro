const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { supabase } = require('../database');
const { JWT_SECRET, auth, checkRole } = require('../middleware/auth');
const { validateAndNormalizePhone } = require('../utils/phone');
const { computeEffectiveAvailability } = require('../utils/schedule');
const { getPlan, isRoleAllowedForPlan, isStaffLimitReached } = require('../utils/plans');
const { getSettings } = require('../utils/platformSettings');
const { recordLoginFailure, REASONS } = require('../utils/loginFailures');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// POST /api/auth/register
// Clinic registration + Admin user creation
router.post('/register', async (req, res) => {
  try {
    const { clinicName, adminName, email: rawEmail, password, phone } = req.body;
    const email = (rawEmail || '').trim().toLowerCase();

    if (!clinicName || !adminName || !email || !password || !phone) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    const phoneCheck = validateAndNormalizePhone(phone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ error: phoneCheck.error });
    }
    const normalizedPhone = phoneCheck.e164;

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
    // La durée d'essai est pilotable depuis Platform Admin > Config. système ;
    // repli sur plans.js si la table platform_settings n'existe pas encore.
    const starterPlan = getPlan('starter');
    const { values: platformValues } = await getSettings();
    const trialDays = platformValues.starter_trial_days || starterPlan.trialDays;
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + trialDays);

    const { data: clinicData, error: clinicError } = await supabase
      .from('clinics')
      .insert({
        name: clinicName,
        phone: normalizedPhone,
        address: '',
        plan: 'starter', // clinics.plan defaults to 'hopital' at the column level (existing-clinic
        // migration grandfather, see supabase_schema.sql) — every new signup must set this
        // explicitly or it silently gets the full paid tier for free.
        subscription_status: 'trial',
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
        role: 'admin',
        passwordSet: true,
        availabilityStatus: 'available'
      },
      clinic: {
        id: clinicId,
        name: clinicName,
        plan: 'starter',
        subscription_status: 'trial',
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
    const { email: rawEmail, password } = req.body;
    const email = (rawEmail || '').trim().toLowerCase();

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
      // Motif enregistré côté serveur UNIQUEMENT — le message client reste
      // identique dans tous les cas, sinon la route devient un oracle
      // indiquant quels emails existent.
      await recordLoginFailure({ email, reason: REASONS.UNKNOWN_OR_INACTIVE, ip: req.ip });
      return res.status(400).json({ error: "Identifiants invalides." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await recordLoginFailure({
        email, clinicId: user.clinic_id, reason: REASONS.BAD_PASSWORD, ip: req.ip
      });
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
        role: user.role,
        passwordSet: user.password_set,
        availabilityStatus: computeEffectiveAvailability(user)
      },
      clinic
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Une erreur est survenue lors de la connexion." });
  }
});

// POST /api/auth/google
// Sign in (or auto-register) with a Google ID token
router.post('/google', async (req, res) => {
  try {
    if (!googleClient) {
      return res.status(503).json({ error: "La connexion Google n'est pas configurée sur ce serveur." });
    }

    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: "Jeton Google manquant." });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
    } catch (verifyError) {
      console.error("Google Token Verification Error:", verifyError);
      return res.status(401).json({ error: "Jeton Google invalide ou expiré." });
    }

    if (!payload || !payload.email_verified) {
      return res.status(401).json({ error: "Adresse email Google non vérifiée." });
    }

    const email = (payload.email || '').trim().toLowerCase();
    const displayName = payload.name || email.split('@')[0];

    // Look up an existing user by email (global unique constraint on users.email)
    const { data: existingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (findError) throw findError;

    let user;
    let clinic;
    let isNewAccount = false;

    if (existingUser) {
      if (!existingUser.active) {
        return res.status(403).json({ error: "Ce compte a été désactivé. Contactez votre administrateur." });
      }
      user = existingUser;

      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', user.clinic_id)
        .single();
      if (clinicError) throw clinicError;
      clinic = clinicData;

      await supabase.from('activity_logs').insert({
        clinic_id: user.clinic_id,
        user_id: user.id,
        action: 'LOGIN_GOOGLE',
        details: `Connexion via Google de l'utilisateur ${user.name}`
      });
    } else {
      // No existing account for this email — auto-create a new clinic + admin user,
      // same shape as POST /register. Real clinic details are collected afterwards
      // by the existing onboarding flow (triggered whenever clinic.address is empty).
      isNewAccount = true;

      // Même réglage pilotable qu'à l'inscription classique, même repli.
      const starterPlan = getPlan('starter');
      const { values: platformValues } = await getSettings();
      const trialDays = platformValues.starter_trial_days || starterPlan.trialDays;
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + trialDays);

      const { data: clinicData, error: clinicError } = await supabase
        .from('clinics')
        .insert({
          name: `Clinique de ${displayName}`,
          phone: '',
          address: '',
          plan: 'starter', // see the same comment in POST /register — clinics.plan's column
          // default is 'hopital' (existing-clinic migration grandfather), must be set explicitly here too
          subscription_status: 'trial',
          subscription_expires_at: trialExpiry.toISOString()
        })
        .select()
        .single();
      if (clinicError) throw clinicError;
      clinic = clinicData;

      // users.password_hash is NOT NULL — this account only ever authenticates via
      // Google, so store an unusable random hash rather than relaxing the constraint.
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 10);

      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          clinic_id: clinic.id,
          name: displayName,
          email,
          password_hash: passwordHash,
          password_set: false,
          role: 'admin',
          active: 1
        })
        .select()
        .single();
      if (userError) throw userError;
      user = userData;

      await supabase.from('activity_logs').insert({
        clinic_id: clinic.id,
        user_id: user.id,
        action: 'REGISTER_GOOGLE',
        details: 'Inscription de la clinique et de l\'administrateur via Google'
      });
    }

    const token = jwt.sign(
      { userId: user.id, clinicId: user.clinic_id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(isNewAccount ? 201 : 200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        passwordSet: user.password_set,
        availabilityStatus: computeEffectiveAvailability(user)
      },
      clinic
    });
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.status(500).json({ error: "Une erreur est survenue lors de la connexion avec Google." });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  try {
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, active, password_set, availability_status, work_schedule')
      .eq('id', req.user.userId)
      .single();

    if (userError) throw userError;

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', req.user.clinicId)
      .single();

    if (clinicError) throw clinicError;

    // Bandeau de maintenance piloté depuis Platform Admin > Config. système.
    // Sort ici plutôt que sur une route dédiée : /auth/me est déjà appelée au
    // montage par AuthContext, donc aucun appel réseau ni sondage en plus.
    // Texte brut — jamais rendu en HTML côté client.
    let maintenanceMessage = '';
    try {
      const { values: platformValues } = await getSettings();
      maintenanceMessage = platformValues.maintenance_message || '';
    } catch (settingsError) {
      // Un réglage illisible ne doit jamais empêcher un utilisateur de charger
      // son profil : sans bandeau, l'app fonctionne normalement.
      console.error('[AUTH] Lecture des réglages plateforme impossible:', settingsError);
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        passwordSet: user.password_set,
        availabilityStatus: computeEffectiveAvailability(user)
      },
      clinic,
      maintenanceMessage
    });
  } catch (error) {
    console.error("Get Me Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du profil." });
  }
});

// PUT /api/auth/password
// Change password (requires currentPassword) or set a first password for a
// Google-only account (currentPassword not required since none exists yet).
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères." });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, password_hash, password_set')
      .eq('id', req.user.userId)
      .single();

    if (userError) throw userError;

    if (user.password_set) {
      if (!currentPassword) {
        return res.status(400).json({ error: "Mot de passe actuel requis." });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: "Mot de passe actuel incorrect." });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({ password_hash: newHash, password_set: true })
      .eq('id', req.user.userId);

    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PASSWORD_SET',
      details: user.password_set
        ? 'Mot de passe modifié'
        : 'Mot de passe défini pour activer la connexion par email/mot de passe'
    });

    res.json({
      success: true,
      message: user.password_set
        ? "Mot de passe modifié avec succès."
        : "Mot de passe défini avec succès. Vous pouvez désormais aussi vous connecter avec votre email et ce mot de passe."
    });
  } catch (error) {
    console.error("Set Password Error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du mot de passe." });
  }
});

// POST /api/auth/onboarding
router.post('/onboarding', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { clinicAddress, clinicPhone, staff } = req.body;

    let normalizedClinicPhone = '';
    if (clinicPhone) {
      const phoneCheck = validateAndNormalizePhone(clinicPhone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ error: phoneCheck.error });
      }
      normalizedClinicPhone = phoneCheck.e164;
    }

    // 1. Update clinic info
    const { error: clinicUpdateError } = await supabase
      .from('clinics')
      .update({
        address: clinicAddress || '',
        phone: normalizedClinicPhone
      })
      .eq('id', req.user.clinicId);

    if (clinicUpdateError) throw clinicUpdateError;

    // 2. Add staff users (if any) — gated by the clinic's plan (staff limit + allowed roles)
    if (staff && Array.isArray(staff)) {
      const { data: clinicForPlan, error: clinicPlanError } = await supabase
        .from('clinics')
        .select('plan, unlimited_staff')
        .eq('id', req.user.clinicId)
        .single();
      if (clinicPlanError) throw clinicPlanError;

      const { count: existingActiveStaff, error: staffCountError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', req.user.clinicId)
        .eq('active', 1);
      if (staffCountError) throw staffCountError;

      let activeStaffCount = existingActiveStaff || 0;

      for (const member of staff) {
        const { name, email: rawEmail, password, role } = member;
        const email = (rawEmail || '').trim().toLowerCase();
        if (name && email && password && role) {
          if (!isRoleAllowedForPlan(clinicForPlan.plan, role)) {
            const plan = getPlan(clinicForPlan.plan);
            return res.status(403).json({ error: `Le plan ${plan.name} n'autorise pas le rôle "${role}". Passez à un plan supérieur dans Abonnez-vous pour débloquer ce rôle.` });
          }
          if (isStaffLimitReached(clinicForPlan.plan, activeStaffCount, clinicForPlan.unlimited_staff)) {
            const plan = getPlan(clinicForPlan.plan);
            return res.status(403).json({ error: `Le plan ${plan.name} est limité à ${plan.staffLimit} collaborateurs actifs. Passez à un plan supérieur dans Abonnez-vous pour ajouter plus de collaborateurs.` });
          }

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
            activeStaffCount += 1;
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
