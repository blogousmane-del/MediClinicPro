const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');
const { validateAndNormalizePhone } = require('../utils/phone');
const chariow = require('../services/payments/chariow');
const { getPlan, isPaymentMethodAllowed } = require('../utils/plans');

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:5000';
const ONLINE_METHODS = ['wave', 'orange_money', 'mtn_momo'];

// GET /api/financials/payments
// List payments / receipts
router.get('/payments', auth, async (req, res) => {
  try {
    const { startDate, endDate, method, status } = req.query;

    let queryBuilder = supabase
      .from('payments')
      .select('*, patient:patients(first_name, last_name, folder_number), cashier:users(name)')
      .eq('clinic_id', req.user.clinicId);

    if (startDate) {
      queryBuilder = queryBuilder.gte('created_at', `${startDate}T00:00:00`);
    }
    if (endDate) {
      queryBuilder = queryBuilder.lte('created_at', `${endDate}T23:59:59`);
    }
    if (method) {
      queryBuilder = queryBuilder.eq('payment_method', method);
    }
    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }

    const { data: payments, error } = await queryBuilder.order('created_at', { ascending: false });
    if (error) throw error;

    const formattedPayments = (payments || []).map(pay => ({
      ...pay,
      patient_first_name: pay.patient ? pay.patient.first_name : 'Inconnu',
      patient_last_name: pay.patient ? pay.patient.last_name : 'Inconnu',
      folder_number: pay.patient ? pay.patient.folder_number : '',
      cashier_name: pay.cashier ? pay.cashier.name : 'Inconnu',
      items: typeof pay.items === 'string' ? JSON.parse(pay.items) : pay.items
    }));

    res.json(formattedPayments);
  } catch (error) {
    console.error("Get Payments Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des transactions." });
  }
});

// POST /api/financials/checkout
// Process a patient billing payment. Cash is recorded immediately (paid at the
// counter). Mobile Money methods create a pending row and return a hosted
// checkout URL — the payment is only marked 'paid' once the provider's
// webhook confirms it (see routes/webhooks.js).
router.post('/checkout', auth, checkRole(['admin', 'secretary', 'manager']), async (req, res) => {
  try {
    const { patientId, amountTotal, paymentMethod, referenceNumber, items } = req.body;

    if (!patientId || !amountTotal || !paymentMethod || !items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Les informations de facturation essentielles sont requises." });
    }

    // Verify patient belongs to the user's clinic (prevent IDOR)
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('first_name, last_name')
      .eq('id', patientId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!patient) {
      return res.status(404).json({ error: "Patient non trouvé dans cette clinique." });
    }

    const isOnline = ONLINE_METHODS.includes(paymentMethod);

    if (isOnline) {
      const { data: clinicPlan, error: clinicPlanError } = await supabase
        .from('clinics')
        .select('plan')
        .eq('id', req.user.clinicId)
        .single();
      if (clinicPlanError) throw clinicPlanError;

      if (!isPaymentMethodAllowed(clinicPlan.plan, paymentMethod)) {
        const plan = getPlan(clinicPlan.plan);
        return res.status(403).json({ error: `Le plan ${plan.name} ne permet pas les encaissements Mobile Money. Passez au plan Hôpital dans Abonnez-vous, ou encaissez en espèces.` });
      }
    }

    const { data: paymentResult, error: insertError } = await supabase
      .from('payments')
      .insert({
        clinic_id: req.user.clinicId,
        patient_id: patientId,
        user_id: req.user.userId,
        amount_total: amountTotal,
        payment_method: paymentMethod,
        reference_number: referenceNumber || `REF-${Date.now()}`,
        status: isOnline ? 'pending' : 'paid',
        provider: isOnline ? null : 'manual',
        items
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (!isOnline) {
      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PAYMENT_RECORD',
        details: `Encaissement de ${amountTotal} FCFA pour ${patient.first_name} ${patient.last_name} (${paymentMethod})`
      });

      return res.status(201).json({
        success: true,
        paymentId: paymentResult.id,
        message: "Paiement enregistré avec succès."
      });
    }

    const checkout = await initiateCheckoutWithFailover(
      {
        amount: amountTotal,
        currency: 'XOF',
        description: `Facture patient ${patient.first_name} ${patient.last_name}`,
        reference: `pay-${paymentResult.id}`,
        returnUrl: `${APP_URL}/`,
        cancelUrl: `${APP_URL}/`,
        customerName: `${patient.first_name} ${patient.last_name}`
      },
      { itemName: 'Facture MediClinic', ipnUrl: `${API_PUBLIC_URL}/api/webhooks/paytech` }
    );

    if (!checkout.ok) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', paymentResult.id);
      return res.status(502).json({ error: checkout.error });
    }

    await supabase
      .from('payments')
      .update({
        provider: checkout.provider,
        provider_reference: checkout.providerReference,
        checkout_url: checkout.checkoutUrl
      })
      .eq('id', paymentResult.id);

    res.status(201).json({
      success: true,
      pending: true,
      paymentId: paymentResult.id,
      checkoutUrl: checkout.checkoutUrl,
      provider: checkout.provider
    });
  } catch (error) {
    console.error("Checkout Payment Error:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'encaissement." });
  }
});

// GET /api/financials/payments/:id/status
// Polled by the frontend while a Mobile Money checkout is pending confirmation.
router.get('/payments/:id/status', auth, async (req, res) => {
  try {
    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, status, checkout_url')
      .eq('id', req.params.id)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (error) throw error;
    if (!payment) return res.status(404).json({ error: "Paiement introuvable." });

    res.json({ status: payment.status, checkoutUrl: payment.checkout_url });
  } catch (error) {
    console.error("Get Payment Status Error:", error);
    res.status(500).json({ error: "Erreur lors de la vérification du paiement." });
  }
});

// GET /api/financials/stats
// Financial analytics for manager / admin
router.get('/stats', auth, async (req, res) => {
  try {
    const hasFinancialsAccess = ['admin', 'manager'].includes(req.user.role);

    // 1. Fetch all payments for CA calculations (only if permitted)
    let totalRevenue = 0;
    let todayRevenue = 0;
    let distribution = [];

    if (hasFinancialsAccess) {
      const { data: allPayments, error: payError } = await supabase
        .from('payments')
        .select('amount_total, payment_method, created_at, status')
        .eq('clinic_id', req.user.clinicId)
        .eq('status', 'paid');

      if (payError) throw payError;

      // Calculate Chiffre d'affaires total
      totalRevenue = (allPayments || []).reduce((sum, p) => sum + p.amount_total, 0);

      // Calculate Chiffre d'affaires aujourd'hui (local date comparison)
      const todayStr = new Date().toISOString().split('T')[0];
      todayRevenue = (allPayments || [])
        .filter(p => p.created_at && p.created_at.startsWith(todayStr))
        .reduce((sum, p) => sum + p.amount_total, 0);

      // Calculate payment methods distribution
      const distMap = {};
      (allPayments || []).forEach(p => {
        const method = p.payment_method;
        if (!distMap[method]) {
          distMap[method] = { method, total: 0, count: 0 };
        }
        distMap[method].total += p.amount_total;
        distMap[method].count += 1;
      });
      distribution = Object.values(distMap);
    }

    // 2. Fetch recent activity logs (10)
    const { data: logs, error: logsError } = await supabase
      .from('activity_logs')
      .select('*, user:users(name)')
      .eq('clinic_id', req.user.clinicId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (logsError) throw logsError;

    const formattedLogs = (logs || []).map(l => ({
      ...l,
      user_name: l.user ? l.user.name : 'Système'
    }));

    // 3. Total counts for patients, appointments
    const { count: patientCount, error: patCountErr } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', req.user.clinicId)
      .eq('archived', 0);

    if (patCountErr) throw patCountErr;

    const { count: apptCount, error: apptCountErr } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', req.user.clinicId)
      .eq('status', 'scheduled');

    if (apptCountErr) throw apptCountErr;

    // 4. Stock Alerts (Low stock and near expiry)
    const { data: medications, error: medError } = await supabase
      .from('medications')
      .select('stock_quantity, min_stock_threshold, expiry_date')
      .eq('clinic_id', req.user.clinicId);

    if (medError) throw medError;

    const lowStockCount = (medications || []).filter(m => m.stock_quantity <= m.min_stock_threshold).length;

    const limit30Days = new Date();
    limit30Days.setDate(limit30Days.getDate() + 30);
    const limitStr = limit30Days.toISOString().split('T')[0];
    const todayStr2 = new Date().toISOString().split('T')[0];

    const nearExpiryCount = (medications || []).filter(m => {
      return m.expiry_date && m.expiry_date <= limitStr && m.expiry_date >= todayStr2;
    }).length;

    res.json({
      totalRevenue,
      todayRevenue,
      distribution,
      logs: formattedLogs,
      patientsTotal: patientCount || 0,
      appointmentsScheduled: apptCount || 0,
      lowStockCount,
      nearExpiryCount
    });
  } catch (error) {
    console.error("Get Financial Stats Error:", error);
    res.status(500).json({ error: "Erreur lors du calcul des statistiques." });
  }
});

// POST /api/financials/subscription/checkout
// Renouvellement d'abonnement via Chariow — seul canal depuis le retrait de
// Bictorys/PayTech/PayPal de l'initiation (leurs webhooks restent montés pour
// les paiements déjà en vol). Crée une ligne subscription_payments 'pending'
// et renvoie l'URL de la page hébergée : le plan de la clinique n'est basculé
// qu'à la confirmation, par services/payments/chariowReconcile.js.
router.post('/subscription/checkout', auth, checkRole(['admin']), async (req, res) => {
  try {
    // Les trois champs téléphone arrivent ensemble et non nettoyés : c'est
    // l'adaptateur qui normalise (Chariow refuse un E.164 brut).
    const { months, planId, phone, phoneCountry, phoneLocal } = req.body;
    const qtyMonths = parseInt(months, 10);

    if (![1, 3, 6, 12].includes(qtyMonths)) {
      return res.status(400).json({ error: "Durée d'abonnement invalide (1, 3, 6 ou 12 mois)." });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('name, plan')
      .eq('id', req.user.clinicId)
      .single();
    if (clinicError) throw clinicError;

    // Par défaut, renouvellement du plan courant. Starter est gratuit et ne
    // passe jamais par un paiement.
    const targetPlanId = planId || clinic.plan;
    if (targetPlanId === 'starter') {
      return res.status(400).json({ error: "Le plan Starter est gratuit — activez-le depuis Abonnez-vous, sans paiement." });
    }
    if (!['clinique', 'hopital'].includes(targetPlanId)) {
      return res.status(400).json({ error: "Plan d'abonnement invalide." });
    }

    // Changement de palier : on vérifie que l'effectif actuel tient dans le
    // plan visé AVANT d'encaisser, pour ne pas facturer un basculement qui
    // laisserait la clinique hors limites.
    if (targetPlanId !== clinic.plan) {
      const targetPlan = getPlan(targetPlanId);
      if (targetPlan.staffLimit !== null) {
        const { count: activeStaffCount, error: countError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', req.user.clinicId)
          .eq('active', 1);
        if (countError) throw countError;

        if ((activeStaffCount || 0) > targetPlan.staffLimit) {
          return res.status(400).json({ error: `Le plan ${targetPlan.name} est limité à ${targetPlan.staffLimit} collaborateurs actifs. Désactivez des comptes dans "Gestion des Utilisateurs" avant de changer de plan.` });
        }
      }
    }

    if (!(await chariow.isConfigured())) {
      return res.status(502).json({ error: "Le paiement en ligne n'est pas configuré pour cette installation. Contactez le support MediClinic." });
    }

    const config = await chariow.loadConfig();
    const productId = chariow.productIdFor(config.products, targetPlanId, qtyMonths);
    if (!productId) {
      // Message nommant la combinaison manquante : c'est celui qu'un
      // exploitant lira à 2 h du matin, « paiement indisponible » ne
      // l'aiderait pas.
      return res.status(502).json({
        error: `Aucun produit Chariow n'est associé à la combinaison ${targetPlanId}_${qtyMonths}. Configurez-la dans Administration plateforme → Config. système → Chariow.`
      });
    }

    const { data: adminUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.user.userId)
      .maybeSingle();

    const amount = qtyMonths * getPlan(targetPlanId).price;

    const { data: subPayment, error: insertError } = await supabase
      .from('subscription_payments')
      .insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        plan: targetPlanId,
        months: qtyMonths,
        amount,
        provider: 'chariow',
        status: 'pending'
      })
      .select()
      .single();
    if (insertError) throw insertError;

    // Chariow exige un prénom ET un nom. Un nom unique est dédoublé plutôt
    // qu'accompagné d'une chaîne vide, que l'API refuse.
    const [firstName, ...restName] = String(adminUser?.name || clinic.name || 'Clinique').trim().split(/\s+/);

    const checkout = await chariow.createCheckout({
      productId,
      email: adminUser?.email,
      firstName: firstName || 'Clinique',
      lastName: restName.join(' ') || firstName || 'MediClinic',
      phone: chariow.resolveChariowPhone({ phone, phoneCountry, phoneLocal }),
      redirectUrl: `${APP_URL}/?checkout=chariow&sub=${subPayment.id}`,
      metadata: { clinicId: req.user.clinicId, subscriptionPaymentId: subPayment.id }
    });

    if (!checkout.ok) {
      await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', subPayment.id);
      return res.status(502).json({ error: checkout.error });
    }

    // Contrôle du prix RÉELLEMENT débité. Chariow facture le prix de son
    // produit, jamais un montant que nous lui transmettons : un produit mal
    // rattaché vendrait douze mois au prix d'un sans qu'aucun signal ne se
    // déclenche. On refuse plutôt que d'encaisser le mauvais montant.
    if (checkout.amount.currency !== 'XOF') {
      await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', subPayment.id);
      return res.status(502).json({ error: `Le produit Chariow est libellé en ${checkout.amount.currency} : seul le XOF est accepté.` });
    }
    if (!Number.isFinite(checkout.amount.value) || Math.abs(checkout.amount.value - amount) > amount * 0.02) {
      await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', subPayment.id);
      return res.status(502).json({
        error: `Le montant du produit Chariow (${checkout.amount.value} FCFA) ne correspond pas au prix attendu (${amount} FCFA) pour ${targetPlanId}_${qtyMonths}. Corrigez le produit dans la boutique avant d'encaisser.`
      });
    }

    await supabase
      .from('subscription_payments')
      .update({ provider_reference: checkout.saleId, checkout_url: checkout.checkoutUrl })
      .eq('id', subPayment.id);

    res.status(201).json({
      success: true,
      subscriptionPaymentId: subPayment.id,
      checkoutUrl: checkout.checkoutUrl,
      provider: 'chariow'
    });
  } catch (error) {
    console.error("Subscription checkout error:", error);
    res.status(500).json({ error: "Erreur lors de l'initialisation du paiement d'abonnement." });
  }
});

// POST /api/financials/subscription/verify
// Interrogée par la page d'abonnement au retour de Chariow. Elle ne décide
// rien : elle relaie vers la réconciliation, seule habilitée à créditer, qui
// redemande elle-même le statut au fournisseur.
router.post('/subscription/verify', auth, checkRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.body.subscriptionPaymentId, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant de paiement invalide.' });

    // Périmètre clinique vérifié AVANT tout appel sortant : cette route ne
    // doit pas permettre de sonder les paiements d'une autre clinique, ni de
    // déclencher un appel vers Chariow pour une ligne qui ne nous regarde pas.
    const { data: row } = await supabase
      .from('subscription_payments')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();
    if (!row) return res.status(404).json({ error: 'Paiement introuvable.' });

    const { reconcileChariowSubscription } = require('../services/payments/chariowReconcile');
    const result = await reconcileChariowSubscription(id);
    res.json({ status: result.status });
  } catch (error) {
    console.error("[FINANCIALS] Erreur de vérification d'abonnement:", error);
    res.status(500).json({ error: 'Erreur lors de la vérification du paiement.' });
  }
});

// GET /api/financials/subscription/status/:id
// Polled by the frontend while a subscription renewal is pending confirmation.
router.get('/subscription/status/:id', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { data: subPayment, error } = await supabase
      .from('subscription_payments')
      .select('id, status, checkout_url')
      .eq('id', req.params.id)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (error) throw error;
    if (!subPayment) return res.status(404).json({ error: "Paiement d'abonnement introuvable." });

    let clinic = null;
    if (subPayment.status === 'paid') {
      const { data } = await supabase.from('clinics').select('*').eq('id', req.user.clinicId).single();
      clinic = data;
    }

    res.json({ status: subPayment.status, checkoutUrl: subPayment.checkout_url, clinic });
  } catch (error) {
    console.error("Get Subscription Payment Status Error:", error);
    res.status(500).json({ error: "Erreur lors de la vérification du paiement." });
  }
});

module.exports = router;
