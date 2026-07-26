// Cross-clinic platform dashboard — the only place in this codebase that
// deliberately reads across every clinic instead of filtering by
// req.user.clinicId. Gated by superAdminOnly, not by role — see that
// middleware for why. Mostly read-only, with one exception: PUT /tickets/:id
// updates a ticket's status/resolution note — the only mutation endpoint in
// this file.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/superAdmin');
const { sendTicketStatusEmail } = require('../utils/mailer');

router.use(auth, superAdminOnly);

// GET /api/platform/overview
router.get('/overview', async (req, res) => {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, address, subscription_status, subscription_expires_at, created_at, plan')
      .order('created_at', { ascending: false });
    if (clinicsError) throw clinicsError;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, clinic_id, role, active');
    if (usersError) throw usersError;

    const { data: patients, error: patientsError } = await supabase
      .from('patients')
      .select('id, clinic_id');
    if (patientsError) throw patientsError;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: monthPayments, error: paymentsError } = await supabase
      .from('subscription_payments')
      .select('amount')
      .eq('status', 'paid')
      .gte('paid_at', startOfMonth);
    if (paymentsError) throw paymentsError;

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
      const expiresAt = c.subscription_expires_at ? new Date(c.subscription_expires_at) : null;
      const isExpired = c.subscription_status === 'expired' || (expiresAt && expiresAt < now);
      return {
        id: c.id,
        name: c.name,
        address: c.address,
        plan: c.plan || 'hopital',
        status: isExpired ? 'expired' : 'active',
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

    res.json({
      stats: {
        clinicsActive: enrichedClinics.filter(c => c.status === 'active').length,
        clinicsExpired: enrichedClinics.filter(c => c.status === 'expired').length,
        totalUsers: (users || []).length,
        monthlyRevenue,
        currency: 'XOF',
        openTickets: (openTicketRows || []).length
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

    res.json({
      clinics: clinics.map(c => ({
        id: c.id,
        name: c.name,
        subscriptionStatus: c.subscription_status,
        subscriptionExpiresAt: c.subscription_expires_at
      })),
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
        resolution_note: resolutionNote || undefined,
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

module.exports = router;
