// Cross-clinic platform dashboard — the only place in this codebase that
// deliberately reads across every clinic instead of filtering by
// req.user.clinicId. Gated by superAdminOnly, not by role — see that
// middleware for why. Mostly read-only, with one exception: PUT /tickets/:id
// updates a ticket's status/resolution note — the only mutation endpoint in
// this file.
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/superAdmin');
const { sendTicketStatusEmail } = require('../utils/mailer');
const { PLAN_IDS, getPlan, isRoleAllowedForPlan } = require('../utils/plans');
const { isClinicExpired } = require('../utils/subscription');
const { validatePassword } = require('../utils/password');
const { validateAndNormalizePhone } = require('../utils/phone');
const { getSettings } = require('../utils/platformSettings');

router.use(auth, superAdminOnly);

// GET /api/platform/overview
router.get('/overview', async (req, res) => {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, address, subscription_status, subscription_expires_at, created_at, plan, unlimited_staff, suspended_by_platform')
      .order('created_at', { ascending: false });
    if (clinicsError) throw clinicsError;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, clinic_id, role, active, created_at');
    if (usersError) throw usersError;

    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, clinic_id');
    if (patientsError) throw patientsError;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const { data: monthPayments, error: paymentsError } = await supabase
      .from('subscription_payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', startOfMonth);
    if (paymentsError) throw paymentsError;

    // Mois précédent, pour la variation affichée sous la carte Revenu. Borné des
    // deux côtés : sans le `.lt`, le mois courant serait compté dedans et la
    // variation vaudrait toujours à peu près zéro.
    const { data: lastMonthPayments, error: lastMonthError } = await supabase
      .from('subscription_payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', startOfLastMonth)
      .lt('paid_at', startOfMonth);
    if (lastMonthError) throw lastMonthError;

    const { data: recentActivity, error: activityError } = await supabase
      .from('activity_logs')
      .select('id, clinic_id, action, details, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    if (activityError) throw activityError;

    const { data: openTicketRows, error: ticketsError } = await supabase
      .from('support_tickets')
      .select('id, clinic_id, subject, status, created_at')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false });
    if (ticketsError) throw ticketsError;

    const clinicNameById = new Map(clinics.map(c => [c.id, c.name]));
    const usersByClinic = new Map();
    const patientsByClinic = new Map();
    for (const u of users || []) {
      usersByClinic.set(u.clinic_id, (usersByClinic.get(u.clinic_id) || 0) + 1);
    }
    for (const p of patients || []) {
      patientsByClinic.set(p.clinic_id, (patientsByClinic.get(p.clinic_id) || 0) + 1);
    }

    const enrichedClinics = (clinics || []).map(c => {
      const isExpired = isClinicExpired(c, now);
      return {
        id: c.id,
        name: c.name,
        address: c.address,
        plan: c.plan || 'hopital',
        status: isExpired ? 'expired' : 'active',
        unlimitedStaff: !!c.unlimited_staff,
        suspended: !!c.suspended_by_platform,
        subscriptionExpiresAt: c.subscription_expires_at,
        createdAt: c.created_at,
        practitioners: usersByClinic.get(c.id) || 0,
        patients: patientsByClinic.get(c.id) || 0
      };
    });

    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = enrichedClinics
      .filter(c => c.status === 'active' && c.subscriptionExpiresAt && new Date(c.subscriptionExpiresAt) <= in7Days)
      .sort((a, b) => new Date(a.subscriptionExpiresAt) - new Date(b.subscriptionExpiresAt));

    const monthlyRevenue = (monthPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const lastMonthRevenue = (lastMonthPayments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    // Variations affichées sous chaque carte. Comptées sur created_at, donc sur
    // la date d'entrée réelle de la ligne — pas une estimation.
    const isThisMonth = (value) => value && value >= startOfMonth;
    const clinicsNewThisMonth = (clinics || []).filter(c => isThisMonth(c.created_at)).length;
    const usersNewThisMonth = (users || []).filter(u => isThisMonth(u.created_at)).length;

    // `null` quand le mois précédent n'a rien encaissé : une variation en
    // pourcentage à partir de zéro n'a pas de sens, et afficher « +100 % » ou
    // « +∞ % » serait un chiffre inventé. L'interface montre alors le montant du
    // mois précédent au lieu d'un pourcentage.
    const revenueDeltaPct = lastMonthRevenue > 0
      ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null;

    res.json({
      stats: {
        clinicsActive: enrichedClinics.filter(c => c.status === 'active').length,
        clinicsExpired: enrichedClinics.filter(c => c.status === 'expired').length,
        totalUsers: (users || []).length,
        monthlyRevenue,
        currency: 'XOF',
        openTickets: (openTicketRows || []).length,
        clinicsNewThisMonth,
        usersNewThisMonth,
        lastMonthRevenue,
        revenueDeltaPct
      },
      clinics: enrichedClinics,
      expiringSoon,
      recentActivity: (recentActivity || []).map(a => ({
        id: a.id,
        clinicName: clinicNameById.get(a.clinic_id) || 'Clinique supprimée',
        action: a.action,
        details: a.details,
        createdAt: a.created_at
      })),
      recentTickets: (openTicketRows || []).slice(0, 3).map(t => ({
        id: t.id,
        clinicName: clinicNameById.get(t.clinic_id) || 'Clinique supprimée',
        subject: t.subject,
        status: t.status
      }))
    });
  } catch (error) {
    console.error("Platform overview error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération du tableau de bord plateforme." });
  }
});

// GET /api/platform/users
// Every user account across every clinic — for the "Utilisateurs" tab.
router.get('/users', async (req, res) => {
  try {
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role, active, clinic_id, created_at')
      .order('created_at', { ascending: false });
    if (usersError) throw usersError;

    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name');
    if (clinicsError) throw clinicsError;

    const clinicNameById = new Map(clinics.map(c => [c.id, c.name]));

    res.json((users || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: !!u.active,
      clinicName: clinicNameById.get(u.clinic_id) || 'Clinique supprimée',
      createdAt: u.created_at
    })));
  } catch (error) {
    console.error("Platform users error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des utilisateurs." });
  }
});

// GET /api/platform/subscriptions
// Every subscription payment across every clinic — for the "Abonnements" tab.
router.get('/subscriptions', async (req, res) => {
  try {
    const { data: payments, error: paymentsError } = await supabase
      .from('subscription_payments')
      .select('id, clinic_id, months, amount, provider, status, created_at, paid_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (paymentsError) throw paymentsError;

    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, subscription_status, subscription_expires_at');
    if (clinicsError) throw clinicsError;

    const clinicNameById = new Map(clinics.map(c => [c.id, c.name]));
    const now = new Date();

    res.json({
      clinics: clinics.map(c => {
        // subscription_status is only ever written as 'active' by the payment
        // webhook (backend/routes/webhooks.js) — nothing in this codebase ever
        // flips it to 'expired' on its own, so it can't be trusted alone.
        // isClinicExpired computes the same way GET /overview's enrichedClinics
        // does, so this tab's Actif/Expiré filter reflects reality instead of a
        // column that silently stays 'active' forever.
        const isExpired = isClinicExpired(c, now);
        return {
          id: c.id,
          name: c.name,
          subscriptionStatus: isExpired ? 'expired' : 'active',
          subscriptionExpiresAt: c.subscription_expires_at
        };
      }),
      payments: (payments || []).map(p => ({
        id: p.id,
        clinicName: clinicNameById.get(p.clinic_id) || 'Clinique supprimée',
        months: p.months,
        amount: p.amount,
        provider: p.provider,
        status: p.status,
        createdAt: p.created_at,
        paidAt: p.paid_at
      }))
    });
  } catch (error) {
    console.error("Platform subscriptions error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des abonnements." });
  }
});

// GET /api/platform/tickets
// Every support ticket across every clinic — powers the dedicated "Support"
// section. Optional ?status= filter.
router.get('/tickets', async (req, res) => {
  try {
    const { status } = req.query;

    let queryBuilder = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: tickets, error: ticketsError } = await queryBuilder;
    if (ticketsError) throw ticketsError;

    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name');
    if (clinicsError) throw clinicsError;

    const clinicNameById = new Map(clinics.map(c => [c.id, c.name]));

    res.json((tickets || []).map(t => ({
      id: t.id,
      clinicId: t.clinic_id,
      clinicName: clinicNameById.get(t.clinic_id) || 'Clinique supprimée',
      subject: t.subject,
      category: t.category,
      message: t.message,
      status: t.status,
      resolutionNote: t.resolution_note,
      createdAt: t.created_at,
      updatedAt: t.updated_at
    })));
  } catch (error) {
    console.error("Platform tickets error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des tickets." });
  }
});

// PUT /api/platform/tickets/:id
// Change a ticket's status and optionally attach a resolution note. Emails
// the clinic's admin fire-and-forget (doesn't block the response), same
// non-blocking pattern as the registration confirmation email in auth.js.
router.put('/tickets/:id', async (req, res) => {
  try {
    const { status, resolutionNote } = req.body;
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Statut de ticket invalide." });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('id, clinic_id, subject')
      .eq('id', req.params.id)
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) {
      return res.status(404).json({ error: "Ticket introuvable." });
    }

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({
        status,
        // `undefined` (not falsy-`''`) is what Supabase's client omits from the
        // update payload — using `|| undefined` here would make submitting an
        // empty note a no-op instead of clearing a previously-set one.
        resolution_note: resolutionNote === undefined ? undefined : resolutionNote,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id);
    if (updateError) throw updateError;

    res.json({ success: true, message: "Ticket mis à jour avec succès." });

    // Fire-and-forget — the whole block is wrapped in one try/catch (not just
    // the email send) so a Supabase lookup failure here can never surface as
    // an unhandled promise rejection after the response has already gone out.
    (async () => {
      try {
        const { data: admin } = await supabase
          .from('users')
          .select('name, email')
          .eq('clinic_id', ticket.clinic_id)
          .eq('role', 'admin')
          .eq('active', 1)
          .limit(1)
          .maybeSingle();
        if (!admin) return;

        const { data: clinic } = await supabase
          .from('clinics')
          .select('name')
          .eq('id', ticket.clinic_id)
          .maybeSingle();

        await sendTicketStatusEmail(admin.email, admin.name, clinic?.name || '', ticket.subject, status, resolutionNote);
      } catch (backgroundError) {
        console.error(`[TICKETS] Échec de la notification par email pour le ticket #${ticket.id}:`, backgroundError);
      }
    })();
  } catch (error) {
    console.error("Update ticket error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du ticket." });
  }
});

// POST /api/platform/clinics
// Création d'une clinique et de son compte administrateur par l'opérateur —
// la contrepartie de POST /auth/register, qui reste le chemin normal (une
// clinique s'inscrit seule). Sert aux cas où l'opérateur enrôle un client
// lui-même : démonstration, reprise de dossier, inscription par téléphone.
//
// Les règles de POST /auth/register sont reprises telles quelles, sans
// exception : mot de passe validé par utils/password.js, téléphone normalisé,
// email en minuscules et sans espaces, plan Starter avec la durée d'essai
// pilotée depuis Config. système. Un compte créé ici doit être indiscernable
// d'un compte inscrit normalement — la porte de l'opérateur ne doit pas être
// celle par laquelle entrent les comptes mal formés.
router.post('/clinics', async (req, res) => {
  try {
    const { clinicName, adminName, email: rawEmail, password, phone } = req.body;
    const email = (rawEmail || '').trim().toLowerCase();

    if (!clinicName || !adminName || !email || !password) {
      return res.status(400).json({ error: "Nom de la clinique, nom de l'administrateur, email et mot de passe sont requis." });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Téléphone facultatif ici, contrairement à l'inscription publique :
    // l'opérateur enrôle parfois depuis un dossier papier incomplet. S'il est
    // fourni, il est validé et normalisé comme partout ailleurs.
    let normalizedPhone = '';
    if (phone && String(phone).trim()) {
      const phoneCheck = validateAndNormalizePhone(phone);
      if (!phoneCheck.valid) {
        return res.status(400).json({ error: phoneCheck.error });
      }
      normalizedPhone = phoneCheck.e164;
    }

    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (checkError) throw checkError;
    if (existingUser) {
      return res.status(400).json({ error: "Cette adresse email est déjà enregistrée." });
    }

    const starterPlan = getPlan('starter');
    const { values: platformValues } = await getSettings();
    const trialDays = platformValues.starter_trial_days || starterPlan.trialDays;
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + trialDays);

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .insert({
        name: clinicName,
        phone: normalizedPhone,
        address: '',
        // Même piège qu'à l'inscription publique : la colonne plan a 'hopital'
        // pour défaut (rattrapage des cliniques historiques), donc ne pas
        // l'écrire ici offrirait le palier le plus cher gratuitement.
        plan: 'starter',
        subscription_status: 'trial',
        subscription_expires_at: trialExpiry.toISOString()
      })
      .select()
      .single();
    if (clinicError) throw clinicError;

    const passwordHash = await bcrypt.hash(password, 10);
    const { data: adminUser, error: userError } = await supabase
      .from('users')
      .insert({
        clinic_id: clinic.id,
        name: adminName,
        email,
        password_hash: passwordHash,
        role: 'admin',
        active: 1
      })
      .select()
      .single();

    // La clinique existe déjà à ce stade : sans rattrapage, un échec ici
    // laisserait une clinique sans aucun compte, invisible et impossible à
    // administrer. PostgREST n'offre pas de transaction, d'où la suppression
    // manuelle.
    if (userError) {
      await supabase.from('clinics').delete().eq('id', clinic.id);
      throw userError;
    }

    await supabase.from('activity_logs').insert({
      clinic_id: clinic.id,
      user_id: req.user.userId,
      action: 'PLATFORM_CLINIC_CREATE',
      details: `Clinique « ${clinicName} » créée par l'administrateur de la plateforme, avec l'administrateur ${adminName}.`
    });

    res.status(201).json({
      success: true,
      message: `Clinique « ${clinicName} » créée avec un essai de ${trialDays} jours.`,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        plan: clinic.plan,
        status: 'active',
        subscriptionExpiresAt: clinic.subscription_expires_at,
        createdAt: clinic.created_at,
        practitioners: 1,
        patients: 0,
        address: '',
        unlimitedStaff: false,
        suspended: false
      },
      admin: { id: adminUser.id, name: adminUser.name, email: adminUser.email }
    });
  } catch (error) {
    console.error("Platform clinic create error:", error);
    res.status(500).json({ error: "Erreur lors de la création de la clinique." });
  }
});

// PUT /api/platform/clinics/:id/staff-override
// Grant or revoke a manual exception to this clinic's plan-based staff COUNT
// limit — independent of clinic.plan itself. Does NOT touch role
// restrictions (isRoleAllowedForPlan is untouched, see utils/plans.js) —
// this is unlimited accounts, not a backdoor around role gating.
router.put('/clinics/:id/staff-override', async (req, res) => {
  try {
    const { unlimited } = req.body;
    if (typeof unlimited !== 'boolean') {
      return res.status(400).json({ error: "Le champ 'unlimited' doit être un booléen." });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (clinicError) throw clinicError;
    if (!clinic) {
      return res.status(404).json({ error: "Clinique introuvable." });
    }

    const { error: updateError } = await supabase
      .from('clinics')
      .update({ unlimited_staff: unlimited })
      .eq('id', req.params.id);
    if (updateError) throw updateError;

    // user_id here is the acting Super Admin, who belongs to a DIFFERENT
    // clinic than clinic_id below — the one deliberate place in this app
    // where activity_logs.user_id's own clinic and the row's clinic_id
    // diverge (safe: activity_logs.user_id is a plain nullable FK to
    // users(id) with no clinic-match constraint).
    await supabase.from('activity_logs').insert({
      clinic_id: clinic.id,
      user_id: req.user.userId,
      action: 'PLATFORM_STAFF_OVERRIDE',
      details: unlimited
        ? "Limite de personnel levée par l'administrateur de la plateforme."
        : "Limite de personnel du plan rétablie par l'administrateur de la plateforme."
    });

    res.json({ success: true, message: "Exception de limite de personnel mise à jour." });
  } catch (error) {
    console.error("Platform staff-override error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour de l'exception de personnel." });
  }
});

// PUT /api/platform/clinics/:id/plan
// Manually set a clinic's tier — bypasses the payment flow entirely (unlike
// POST /financials/subscription/checkout, which only flips clinics.plan once
// a provider confirms payment via webhooks.js). Does not touch
// subscription_status/subscription_expires_at — this only changes which
// tier's limits/features apply, not the clinic's billing cycle. Same
// staff-limit/role validation as PUT /settings/plan (settings.js) so a
// Super Admin can't switch a clinic into a tier its current team violates.
router.put('/clinics/:id/plan', async (req, res) => {
  try {
    const { plan: targetPlanId } = req.body;
    if (!PLAN_IDS.includes(targetPlanId)) {
      return res.status(400).json({ error: "Plan invalide." });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, plan, unlimited_staff')
      .eq('id', req.params.id)
      .maybeSingle();
    if (clinicError) throw clinicError;
    if (!clinic) {
      return res.status(404).json({ error: "Clinique introuvable." });
    }

    if (clinic.plan === targetPlanId) {
      return res.status(400).json({ error: "Cette clinique est déjà sur ce plan." });
    }

    const targetPlan = getPlan(targetPlanId);

    const { data: activeUsers, error: usersError } = await supabase
      .from('users')
      .select('role')
      .eq('clinic_id', req.params.id)
      .eq('active', 1);
    if (usersError) throw usersError;

    if (!clinic.unlimited_staff && targetPlan.staffLimit !== null && (activeUsers || []).length > targetPlan.staffLimit) {
      return res.status(400).json({ error: `Le plan ${targetPlan.name} est limité à ${targetPlan.staffLimit} collaborateurs actifs — cette clinique en compte ${(activeUsers || []).length}. Désactivez des comptes ou gardez l'exception "Illimité" avant de changer de plan.` });
    }
    const invalidRoleUser = (activeUsers || []).find(u => !isRoleAllowedForPlan(targetPlanId, u.role));
    if (invalidRoleUser) {
      return res.status(400).json({ error: `Le plan ${targetPlan.name} n'autorise pas tous les rôles actuellement utilisés par cette clinique.` });
    }

    const { error: updateError } = await supabase
      .from('clinics')
      .update({ plan: targetPlanId })
      .eq('id', req.params.id);
    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: clinic.id,
      user_id: req.user.userId,
      action: 'PLATFORM_PLAN_CHANGE',
      details: `Plan changé de ${getPlan(clinic.plan).name} à ${targetPlan.name} par l'administrateur de la plateforme.`
    });

    res.json({ success: true, message: `Plan mis à jour vers ${targetPlan.name}.` });
  } catch (error) {
    console.error("Platform plan change error:", error);
    res.status(500).json({ error: "Erreur lors du changement de plan." });
  }
});

// PUT /api/platform/clinics/:id/suspend
// Kill switch: suspends or reactivates write access for every user of this
// clinic (enforced in middleware/auth.js). Unlike an expired subscription,
// there is no self-service unlock — only this endpoint can lift it.
router.put('/clinics/:id/suspend', async (req, res) => {
  try {
    const { suspended } = req.body;
    if (typeof suspended !== 'boolean') {
      return res.status(400).json({ error: "Le champ 'suspended' doit être un booléen." });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (clinicError) throw clinicError;
    if (!clinic) {
      return res.status(404).json({ error: "Clinique introuvable." });
    }

    const { error: updateError } = await supabase
      .from('clinics')
      .update({ suspended_by_platform: suspended })
      .eq('id', req.params.id);
    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: clinic.id,
      user_id: req.user.userId,
      action: suspended ? 'PLATFORM_CLINIC_SUSPENDED' : 'PLATFORM_CLINIC_REACTIVATED',
      details: suspended
        ? "Compte suspendu par l'administrateur de la plateforme."
        : "Compte réactivé par l'administrateur de la plateforme."
    });

    res.json({ success: true, message: suspended ? "Clinique suspendue." : "Clinique réactivée." });
  } catch (error) {
    console.error("Platform suspend error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du statut de suspension." });
  }
});

// PUT /api/platform/users/:id
// Cross-clinic activate/deactivate — emergency use (e.g. a compromised
// account) without going through that clinic's own admin. Self-lockout
// guard mirrors the one already in backend/routes/settings.js's own
// PUT /users/:id (a user cannot deactivate their own account there either).
router.put('/users/:id', async (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: "Le champ 'active' doit être un booléen." });
    }
    if (parseInt(req.params.id) === req.user.userId) {
      return res.status(400).json({ error: "Vous ne pouvez pas modifier votre propre compte via cette console." });
    }

    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('id, clinic_id, name')
      .eq('id', req.params.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!targetUser) {
      return res.status(404).json({ error: "Utilisateur introuvable." });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ active: active ? 1 : 0 })
      .eq('id', req.params.id);
    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: targetUser.clinic_id,
      user_id: req.user.userId,
      action: active ? 'PLATFORM_USER_ACTIVATED' : 'PLATFORM_USER_DEACTIVATED',
      details: `Compte de ${targetUser.name} ${active ? 'réactivé' : 'désactivé'} par l'administrateur de la plateforme.`
    });

    res.json({ success: true, message: "Statut de l'utilisateur mis à jour." });
  } catch (error) {
    console.error("Platform user status error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du statut de l'utilisateur." });
  }
});

// POST /api/platform/notifications
// Broadcast a message to one, several, or all clinics — the only
// Super-Admin-to-clinic-user communication channel in this app. Surfaced in
// each targeted clinic's notification bell via GET /api/notifications.
// Fire-and-forget: no edit/delete/recipient-list endpoint in this iteration,
// matching the "single-message-plus-status" simplicity already used for
// support tickets elsewhere in this file.
router.post('/notifications', async (req, res) => {
  try {
    const { title, body, targetAll, clinicIds } = req.body;
    if (!title || !String(title).trim() || !body || !String(body).trim()) {
      return res.status(400).json({ error: "Le titre et le message sont requis." });
    }
    if (!targetAll && (!Array.isArray(clinicIds) || clinicIds.length === 0)) {
      return res.status(400).json({ error: "Sélectionnez au moins une clinique, ou choisissez « Toutes les cliniques »." });
    }

    let targetClinics = [];
    if (!targetAll) {
      const { data: clinics, error: clinicsError } = await supabase
        .from('clinics')
        .select('id')
        .in('id', clinicIds);
      if (clinicsError) throw clinicsError;
      targetClinics = clinics || [];
      if (targetClinics.length === 0) {
        return res.status(400).json({ error: "Aucune des cliniques sélectionnées n'existe." });
      }
    }

    const { data: notification, error: insertError } = await supabase
      .from('notifications')
      .insert({ created_by: req.user.userId, title, body, target_all: !!targetAll })
      .select('id')
      .single();
    if (insertError) throw insertError;

    if (!targetAll) {
      const rows = targetClinics.map(c => ({ notification_id: notification.id, clinic_id: c.id }));
      const { error: linkError } = await supabase.from('notification_clinics').insert(rows);
      if (linkError) throw linkError;
    }

    let affectedClinicIds = targetClinics.map(c => c.id);
    if (targetAll) {
      const { data: allClinics, error: allClinicsError } = await supabase.from('clinics').select('id');
      if (allClinicsError) throw allClinicsError;
      affectedClinicIds = (allClinics || []).map(c => c.id);
    }

    await Promise.all(affectedClinicIds.map(clinicId =>
      supabase.from('activity_logs').insert({
        clinic_id: clinicId,
        user_id: req.user.userId,
        action: 'PLATFORM_NOTIFICATION_SENT',
        details: `Notification "${title}" envoyée par l'administrateur de la plateforme.`
      })
    ));

    res.json({ success: true, message: "Notification envoyée." });
  } catch (error) {
    console.error("Platform send notification error:", error);
    res.status(500).json({ error: "Erreur lors de l'envoi de la notification." });
  }
});

module.exports = router;
