const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');
const { validateAndNormalizePhone } = require('../utils/phone');
const { isWithinSchedule, computeEffectiveAvailability } = require('../utils/schedule');
const { PLANS, getPlan, isRoleAllowedForPlan, isStaffLimitReached } = require('../utils/plans');

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TICKET_CATEGORIES = ['facturation', 'bug', 'general', 'autre'];

// Validates the optional work_schedule field shared by POST /users and
// PUT /users/:id. Expected shape: array of up to 7 entries, one per day of
// week (0=Sunday..6=Saturday, JS Date.getDay() convention), each either
// { day, off: true } or { day, off: false, start: 'HH:MM', end: 'HH:MM' }.
// Returns { error } if invalid, otherwise { workSchedule } (undefined if not
// provided, so callers can spread only what was sent).
function parseScheduleInput(body) {
  const { workSchedule } = body;
  if (workSchedule === undefined) return { workSchedule: undefined };
  if (workSchedule === null) return { workSchedule: null };

  if (!Array.isArray(workSchedule)) {
    return { error: "Horaire invalide (attendu : une liste d'entrées par jour)." };
  }

  const seenDays = new Set();
  for (const entry of workSchedule) {
    if (!entry || typeof entry !== 'object' || !Number.isInteger(entry.day) || entry.day < 0 || entry.day > 6) {
      return { error: "Horaire invalide (jour attendu : entier 0-6, 0=dimanche)." };
    }
    if (seenDays.has(entry.day)) {
      return { error: "Horaire invalide (jour en double)." };
    }
    seenDays.add(entry.day);

    if (entry.off) continue;
    if (!TIME_PATTERN.test(entry.start) || !TIME_PATTERN.test(entry.end)) {
      return { error: "Horaire invalide (heures attendues au format HH:MM)." };
    }
    if (entry.start >= entry.end) {
      return { error: "Horaire invalide : l'heure de fin doit être après l'heure de début." };
    }
  }

  return { workSchedule };
}

// GET /api/settings/users
// Get all staff users. Secretaries/doctors/nurses need this to populate
// doctor/nurse pickers (appointment booking, patient orientation) — most of
// these roles cannot manage staff, but they must be able to read the list of
// active practitioners. availability_status is returned as the *effective*
// value (forced "away" outside the practitioner's configured schedule).
router.get('/users', auth, checkRole(['admin', 'manager', 'secretary', 'doctor', 'nurse']), async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role, active, availability_status, work_schedule, specialty, created_at')
      .eq('clinic_id', req.user.clinicId)
      .order('role', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    const withEffectiveAvailability = (users || []).map(u => ({
      ...u,
      availability_status: computeEffectiveAvailability(u)
    }));
    res.json(withEffectiveAvailability);
  } catch (error) {
    console.error("Get settings users error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs." });
  }
});

// PUT /api/settings/availability
// Self-service: a doctor/nurse updates their OWN availability status. Never
// takes a target user id — eliminates any IDOR surface by construction.
// Rejected outside the caller's configured work schedule — status there is
// always the automatic "away", not a manual choice.
router.put('/availability', auth, checkRole(['doctor', 'nurse']), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'busy', 'away'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Statut de disponibilité invalide (attendu : available, busy ou away)." });
    }

    const { data: currentUser, error: fetchError } = await supabase
      .from('users')
      .select('role, work_schedule')
      .eq('id', req.user.userId)
      .eq('clinic_id', req.user.clinicId)
      .single();

    if (fetchError) throw fetchError;
    if (!isWithinSchedule(currentUser)) {
      return res.status(400).json({ error: "Vous êtes en dehors de votre horaire de travail — le statut est automatiquement \"Absent\"." });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ availability_status: status })
      .eq('id', req.user.userId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'AVAILABILITY_UPDATE',
      details: `Statut de disponibilité changé à "${status}"`
    });

    res.json({ success: true, availability_status: status });
  } catch (error) {
    console.error("Update availability error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du statut de disponibilité." });
  }
});

// POST /api/settings/users
// Create a new staff user
router.post('/users', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { name, email: rawEmail, password, role, specialty } = req.body;
    const email = (rawEmail || '').trim().toLowerCase();

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Tous les champs sont requis." });
    }

    const schedule = parseScheduleInput(req.body);
    if (schedule.error) {
      return res.status(400).json({ error: schedule.error });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('plan, unlimited_staff')
      .eq('id', req.user.clinicId)
      .single();
    if (clinicError) throw clinicError;

    if (!isRoleAllowedForPlan(clinic.plan, role)) {
      const plan = getPlan(clinic.plan);
      return res.status(403).json({ error: `Le plan ${plan.name} n'autorise pas le rôle "${role}". Passez à un plan supérieur dans Abonnez-vous pour débloquer ce rôle.` });
    }

    const { count: activeStaffCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', req.user.clinicId)
      .eq('active', 1);
    if (countError) throw countError;

    if (isStaffLimitReached(clinic.plan, activeStaffCount || 0, clinic.unlimited_staff)) {
      const plan = getPlan(clinic.plan);
      return res.status(403).json({ error: `Le plan ${plan.name} est limité à ${plan.staffLimit} collaborateurs actifs. Passez à un plan supérieur dans Abonnez-vous pour ajouter ce collaborateur.` });
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
        active: 1,
        work_schedule: schedule.workSchedule,
        specialty: specialty || null
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
    const { active, role, name, specialty } = req.body;

    const schedule = parseScheduleInput(req.body);
    if (schedule.error) {
      return res.status(400).json({ error: schedule.error });
    }

    const { data: user, error: checkError } = await supabase
      .from('users')
      .select('id, name, role, active')
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

    const targetRole = role || user.role;
    const isReactivating = active === 1 && user.active === 0;
    if (role || isReactivating) {
      const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('plan, unlimited_staff')
        .eq('id', req.user.clinicId)
        .single();
      if (clinicError) throw clinicError;

      if (!isRoleAllowedForPlan(clinic.plan, targetRole)) {
        const plan = getPlan(clinic.plan);
        return res.status(403).json({ error: `Le plan ${plan.name} n'autorise pas le rôle "${targetRole}". Passez à un plan supérieur dans Abonnez-vous pour débloquer ce rôle.` });
      }

      if (isReactivating) {
        const { count: activeStaffCount, error: countError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', req.user.clinicId)
          .eq('active', 1);
        if (countError) throw countError;

        if (isStaffLimitReached(clinic.plan, activeStaffCount || 0, clinic.unlimited_staff)) {
          const plan = getPlan(clinic.plan);
          return res.status(403).json({ error: `Le plan ${plan.name} est limité à ${plan.staffLimit} collaborateurs actifs. Passez à un plan supérieur dans Abonnez-vous pour réactiver ce compte.` });
        }
      }
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({
        active: active !== undefined ? (active ? 1 : 0) : undefined,
        role: role || undefined,
        name: name || undefined,
        work_schedule: schedule.workSchedule,
        specialty: specialty !== undefined ? (specialty || null) : undefined
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

    let normalizedPhone = undefined;
    if (phone) {
      const phoneCheck = validateAndNormalizePhone(phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ error: phoneCheck.error });
      }
      normalizedPhone = phoneCheck.e164;
    }

    const { error: updateError } = await supabase
      .from('clinics')
      .update({
        name: name || undefined,
        address: address || undefined,
        phone: normalizedPhone,
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

// GET /api/settings/public/plans
// Catalogue tarifaire seul, SANS authentification : la page d'accueil est vue
// par des visiteurs déconnectés, qui recopiaient jusqu'ici les prix en dur
// dans LandingPage.tsx — deux endroits à modifier lors d'une hausse de tarif,
// donc une divergence garantie à terme. Ne renvoie que PLANS : aucune donnée
// de clinique, rien qui ne soit déjà affiché sur la page tarifs.
router.get('/public/plans', (req, res) => {
  res.json({ plans: PLANS });
});

// GET /api/settings/plans
// Plan catalog + this clinic's current plan/usage — powers the "Abonnez-vous"
// tab's 3-card picker in Settings.
router.get('/plans', auth, async (req, res) => {
  try {
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('plan, subscription_status, subscription_expires_at')
      .eq('id', req.user.clinicId)
      .single();
    if (clinicError) throw clinicError;

    const { count: activeStaffCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', req.user.clinicId)
      .eq('active', 1);
    if (countError) throw countError;

    res.json({
      plans: PLANS,
      currentPlan: clinic.plan,
      subscriptionStatus: clinic.subscription_status,
      subscriptionExpiresAt: clinic.subscription_expires_at,
      activeStaffCount: activeStaffCount || 0
    });
  } catch (error) {
    console.error("Get plans error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des plans d'abonnement." });
  }
});

// PUT /api/settings/plan
// Free-tier activation only (Starter, 0 FCFA) — instant, no payment. Switching
// to a paid tier (Clinique/Hôpital) goes through POST /financials/subscription/checkout
// instead, since it requires real payment confirmation via webhook first.
router.put('/plan', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { planId } = req.body;
    if (planId !== 'starter') {
      return res.status(400).json({ error: "Ce plan nécessite un paiement — utilisez le renouvellement par Mobile Money ou en espèces." });
    }

    // A clinic that has ever completed a real paid subscription can't use this
    // free-tier switch to dodge an expired paid plan — that turned an expired
    // Clinique/Hôpital clinic into an infinite loop of free 7-day Starter
    // trials (switch to Starter → expire → switch again), never actually
    // requiring payment. Brand-new clinics (no paid history) keep their
    // normal one-time free trial.
    const { count: paidHistoryCount, error: paidHistoryError } = await supabase
      .from('subscription_payments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', req.user.clinicId)
      .eq('status', 'paid');
    if (paidHistoryError) throw paidHistoryError;
    if ((paidHistoryCount || 0) > 0) {
      return res.status(400).json({ error: "Ce compte a déjà eu un abonnement payant — le renouvellement doit se faire par paiement (Mobile Money ou espèces), le plan Starter gratuit n'est plus disponible." });
    }

    const plan = getPlan('starter');

    const { data: activeUsers, error: usersError } = await supabase
      .from('users')
      .select('role')
      .eq('clinic_id', req.user.clinicId)
      .eq('active', 1);
    if (usersError) throw usersError;

    if ((activeUsers || []).length > plan.staffLimit) {
      return res.status(400).json({ error: `Le plan Starter est limité à ${plan.staffLimit} collaborateurs actifs. Désactivez des comptes dans "Gestion des Utilisateurs" avant de passer à ce plan.` });
    }
    const invalidRoleUser = (activeUsers || []).find(u => !isRoleAllowedForPlan('starter', u.role));
    if (invalidRoleUser) {
      return res.status(400).json({ error: "Le plan Starter n'autorise que les rôles Administrateur, Médecin et Secrétaire. Ajustez les rôles de votre équipe avant de passer à ce plan." });
    }

    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + plan.trialDays);

    const { error: updateError } = await supabase
      .from('clinics')
      .update({
        plan: 'starter',
        subscription_status: 'trial',
        subscription_expires_at: trialExpiry.toISOString()
      })
      .eq('id', req.user.clinicId);
    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PLAN_CHANGE',
      details: `Passage au plan Starter (gratuit, ${plan.trialDays} jours d'essai)`
    });

    res.json({ success: true, message: `Plan Starter activé — ${plan.trialDays} jours d'utilisation gratuite.` });
  } catch (error) {
    console.error("Update plan error:", error);
    res.status(500).json({ error: "Erreur lors du changement de plan." });
  }
});

// POST /api/settings/tickets
// Create a support ticket for the SaaS operator. Admin-only, same as every
// other billing/staff-management endpoint in this file.
router.post('/tickets', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { subject, category, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ error: "Le sujet et le message sont requis." });
    }
    const safeCategory = TICKET_CATEGORIES.includes(category) ? category : 'general';

    const { data: ticket, error: insertError } = await supabase
      .from('support_tickets')
      .insert({
        clinic_id: req.user.clinicId,
        created_by: req.user.userId,
        subject,
        category: safeCategory,
        message,
        status: 'open'
      })
      .select()
      .single();
    if (insertError) throw insertError;

    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'TICKET_CREATE',
      details: `Ticket support créé : "${subject}"`
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error("Create ticket error:", error);
    res.status(500).json({ error: "Erreur lors de la création du ticket." });
  }
});

// GET /api/settings/tickets
// List this clinic's own support tickets, newest first.
router.get('/tickets', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('clinic_id', req.user.clinicId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    res.json(tickets || []);
  } catch (error) {
    console.error("List tickets error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des tickets." });
  }
});

module.exports = router;
