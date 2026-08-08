// Scheduled jobs, triggered by Vercel Cron (see vercel.json's `crons` entry)
// or manually via curl in dev. Not behind the `auth` middleware — gated by a
// shared secret instead, same pattern Vercel's own docs recommend for cron
// endpoints. Degrades gracefully (503) when CRON_SECRET isn't configured,
// consistent with every other optional feature in this app.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { getPlan } = require('../utils/plans');
const { sendRenewalReminderEmail } = require('../utils/mailer');

const CRON_SECRET = process.env.CRON_SECRET || '';
const REMINDER_THRESHOLDS_DAYS = [3, 1]; // two touchpoints before auto-block; exact-day match means a once-daily cron never double-sends

function requireCronSecret(req, res, next) {
  if (!CRON_SECRET) {
    return res.status(503).json({ error: "Tâches planifiées non configurées (CRON_SECRET manquant)." });
  }
  if (req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Non autorisé." });
  }
  next();
}

// GET /api/cron/renewal-reminders
// Emails clinic admins whose subscription (or free trial) expires in exactly
// 3 or 1 day(s) — covers both the Starter free-tier countdown and paid-tier
// monthly renewals, since both live on the same clinics.subscription_expires_at.
router.get('/renewal-reminders', requireCronSecret, async (req, res) => {
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // widest threshold + 1 day margin

    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, plan, subscription_status, subscription_expires_at')
      .not('subscription_expires_at', 'is', null)
      .gte('subscription_expires_at', now.toISOString())
      .lte('subscription_expires_at', horizon.toISOString());
    if (clinicsError) throw clinicsError;

    let sent = 0;
    for (const clinic of clinics || []) {
      const expiresAt = new Date(clinic.subscription_expires_at);
      const daysLeft = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
      if (!REMINDER_THRESHOLDS_DAYS.includes(daysLeft)) continue;

      const { data: admin, error: adminError } = await supabase
        .from('users')
        .select('name, email')
        .eq('clinic_id', clinic.id)
        .eq('role', 'admin')
        .eq('active', 1)
        .limit(1)
        .maybeSingle();
      if (adminError || !admin) continue;

      const plan = getPlan(clinic.plan);
      try {
        await sendRenewalReminderEmail(admin.email, admin.name, clinic.name, daysLeft, plan.name, plan.price);
        sent += 1;
      } catch (emailError) {
        console.error(`[CRON] Échec envoi rappel abonnement pour la clinique #${clinic.id}:`, emailError);
      }
    }

    res.json({ checked: (clinics || []).length, sent });
  } catch (error) {
    console.error("Renewal reminders cron error:", error);
    res.status(500).json({ error: "Erreur lors de l'exécution des rappels d'abonnement." });
  }
});

// GET /api/cron/purge-login-failures
// Sans purge, login_failures grossit sans fin. 90 jours couvrent largement
// toute analyse d'incident rétrospective.
router.get('/purge-login-failures', requireCronSecret, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('login_failures')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      // Table absente : rien à purger. Ce n'est pas un échec du cron, et une
      // tâche planifiée qui alerte en rouge pour une migration non lancée
      // finit par être ignorée.
      if (['PGRST205', '42P01'].includes(error.code)) {
        return res.json({ success: true, deleted: 0, tableMissing: true });
      }
      throw error;
    }

    res.json({ success: true, deleted: (data || []).length });
  } catch (error) {
    console.error('[CRON] Purge des échecs de connexion impossible:', error);
    res.status(500).json({ error: 'Erreur lors de la purge.' });
  }
});

// GET /api/cron/reconcile-chariow
// Filet quotidien : rattrape les paiements Chariow dont ni le retour navigateur
// ni le webhook n'ont abouti. Les crons Vercel du plan Hobby ne descendent pas
// sous la journée, ce qui est acceptable ici — les deux autres chemins
// créditent en secondes, celui-ci n'existe que pour ce qui leur a échappé.
router.get('/reconcile-chariow', requireCronSecret, async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('subscription_payments')
      .select('id, provider, status, created_at')
      .eq('provider', 'chariow');
    if (error) throw error;

    const { reconcileChariowSubscription, selectReconcilable } = require('../services/payments/chariowReconcile');
    const candidates = selectReconcilable(rows);

    let credited = 0;
    for (const row of candidates) {
      // Une ligne qui échoue ne doit pas interrompre la boucle : le paiement
      // suivant n'a rien à voir avec celui qui pose problème.
      try {
        const result = await reconcileChariowSubscription(row.id);
        if (result.status === 'paid') credited += 1;
      } catch (rowError) {
        console.error(`[CRON] Réconciliation impossible pour le paiement #${row.id}:`, rowError);
      }
    }

    res.json({ checked: candidates.length, credited });
  } catch (error) {
    console.error('[CRON] Réconciliation Chariow impossible:', error);
    res.status(500).json({ error: 'Erreur lors de la réconciliation Chariow.' });
  }
});

module.exports = router;
