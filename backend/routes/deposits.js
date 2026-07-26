const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');
const { initiateCheckoutWithFailover } = require('../services/payments');
const { getPlan, isPaymentMethodAllowed } = require('../utils/plans');

const DEPOSIT_ROLES = ['admin', 'secretary', 'manager'];
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || 'http://localhost:5000';
const ONLINE_METHODS = ['wave', 'orange_money', 'mtn_momo'];

// GET /api/deposits
// List deposits for the clinic, optionally scoped to one patient
router.get('/', auth, checkRole(DEPOSIT_ROLES), async (req, res) => {
  try {
    const { patientId } = req.query;

    let queryBuilder = supabase
      .from('deposits')
      .select('*, patient:patients(first_name, last_name, folder_number), cashier:users!deposits_user_id_fkey(name), resolver:users!deposits_resolved_by_fkey(name)')
      .eq('clinic_id', req.user.clinicId);

    if (patientId) {
      queryBuilder = queryBuilder.eq('patient_id', patientId);
    }

    const { data: deposits, error } = await queryBuilder.order('created_at', { ascending: false });
    if (error) throw error;

    const formatted = (deposits || []).map(dep => ({
      ...dep,
      patient_first_name: dep.patient ? dep.patient.first_name : 'Inconnu',
      patient_last_name: dep.patient ? dep.patient.last_name : 'Inconnu',
      folder_number: dep.patient ? dep.patient.folder_number : '',
      cashier_name: dep.cashier ? dep.cashier.name : 'Inconnu',
      resolved_by_name: dep.resolver ? dep.resolver.name : null
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Get Deposits Error:", error);
    res.status(500).json({ error: "Erreur lors de la récupération des dépôts de garantie." });
  }
});

// POST /api/deposits
// Record a new deposit (held)
router.post('/', auth, checkRole(DEPOSIT_ROLES), async (req, res) => {
  try {
    const { patientId, amount, paymentMethod, referenceNumber, reason, items } = req.body;

    if (!patientId || !amount || !paymentMethod) {
      return res.status(400).json({ error: "Patient, montant et mode de paiement sont requis." });
    }
    if (amount <= 0) {
      return res.status(400).json({ error: "Le montant du dépôt doit être supérieur à 0." });
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

    const safeItems = Array.isArray(items) ? items : [];
    const estimatedTotal = safeItems.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);
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

    const { data: depositResult, error: insertError } = await supabase
      .from('deposits')
      .insert({
        clinic_id: req.user.clinicId,
        patient_id: patientId,
        user_id: req.user.userId,
        amount,
        payment_method: paymentMethod,
        reference_number: referenceNumber || null,
        reason: reason || null,
        items: safeItems,
        estimated_total: estimatedTotal,
        status: 'held',
        payment_status: isOnline ? 'pending' : 'paid',
        provider: isOnline ? null : 'manual'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    if (!isOnline) {
      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'DEPOSIT_CREATE',
        details: `Dépôt de garantie de ${amount} FCFA enregistré pour ${patient.first_name} ${patient.last_name} (${paymentMethod})`
      });

      return res.status(201).json({ success: true, deposit: depositResult });
    }

    const checkout = await initiateCheckoutWithFailover(
      {
        amount,
        currency: 'XOF',
        description: `Dépôt de garantie — ${patient.first_name} ${patient.last_name}`,
        reference: `dep-${depositResult.id}`,
        returnUrl: `${APP_URL}/`,
        cancelUrl: `${APP_URL}/`,
        customerName: `${patient.first_name} ${patient.last_name}`
      },
      { itemName: 'Dépôt de garantie MediClinic', ipnUrl: `${API_PUBLIC_URL}/api/webhooks/paytech` }
    );

    if (!checkout.ok) {
      await supabase.from('deposits').update({ payment_status: 'failed' }).eq('id', depositResult.id);
      return res.status(502).json({ error: checkout.error });
    }

    await supabase
      .from('deposits')
      .update({
        provider: checkout.provider,
        provider_reference: checkout.providerReference,
        checkout_url: checkout.checkoutUrl
      })
      .eq('id', depositResult.id);

    res.status(201).json({
      success: true,
      pending: true,
      deposit: depositResult,
      checkoutUrl: checkout.checkoutUrl,
      provider: checkout.provider
    });
  } catch (error) {
    console.error("Create Deposit Error:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement du dépôt de garantie." });
  }
});

// GET /api/deposits/:id/status
// Polled by the frontend while a Mobile Money deposit is pending confirmation.
router.get('/:id/status', auth, async (req, res) => {
  try {
    const { data: deposit, error } = await supabase
      .from('deposits')
      .select('id, payment_status, checkout_url')
      .eq('id', req.params.id)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (error) throw error;
    if (!deposit) return res.status(404).json({ error: "Dépôt introuvable." });

    res.json({ status: deposit.payment_status, checkoutUrl: deposit.checkout_url });
  } catch (error) {
    console.error("Get Deposit Status Error:", error);
    res.status(500).json({ error: "Erreur lors de la vérification du paiement." });
  }
});

// PUT /api/deposits/:id
// Resolve a held deposit: mark as refunded or deducted
router.put('/:id', auth, checkRole(DEPOSIT_ROLES), async (req, res) => {
  try {
    const { status } = req.body;
    const depositId = req.params.id;

    if (!['refunded', 'deducted'].includes(status)) {
      return res.status(400).json({ error: "Statut de résolution invalide (attendu : refunded ou deducted)." });
    }

    const { data: deposit, error: checkError } = await supabase
      .from('deposits')
      .select('id, status, payment_status, amount, patient_id')
      .eq('id', depositId)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!deposit) {
      return res.status(404).json({ error: "Dépôt de garantie non trouvé." });
    }
    if (deposit.status !== 'held') {
      return res.status(400).json({ error: "Ce dépôt a déjà été résolu." });
    }
    if (deposit.payment_status !== 'paid') {
      return res.status(400).json({ error: "Ce dépôt ne peut pas être résolu tant que le paiement n'est pas confirmé." });
    }

    const { error: updateError } = await supabase
      .from('deposits')
      .update({
        status,
        resolved_at: new Date().toISOString(),
        resolved_by: req.user.userId
      })
      .eq('id', depositId)
      .eq('clinic_id', req.user.clinicId);

    if (updateError) throw updateError;

    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'DEPOSIT_RESOLVE',
      details: `Dépôt de garantie #${depositId} (${deposit.amount} FCFA) marqué comme ${status === 'refunded' ? 'remboursé' : 'déduit'}`
    });

    res.json({ success: true, message: "Dépôt de garantie mis à jour avec succès." });
  } catch (error) {
    console.error("Resolve Deposit Error:", error);
    res.status(500).json({ error: "Erreur lors de la mise à jour du dépôt de garantie." });
  }
});

module.exports = router;
