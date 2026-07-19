const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

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
// Process a patient billing payment (checkout)
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

    const { data: paymentResult, error: insertError } = await supabase
      .from('payments')
      .insert({
        clinic_id: req.user.clinicId,
        patient_id: patientId,
        user_id: req.user.userId,
        amount_total: amountTotal,
        payment_method: paymentMethod,
        reference_number: referenceNumber || `REF-${Date.now()}`,
        status: 'paid',
        items: items // Handled natively as JSONB
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log Activity
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'PAYMENT_RECORD',
      details: `Encaissement de ${amountTotal} FCFA pour ${patient.first_name} ${patient.last_name} (${paymentMethod})`
    });

    res.status(201).json({
      success: true,
      paymentId: paymentResult.id,
      message: "Paiement enregistré avec succès."
    });
  } catch (error) {
    console.error("Checkout Payment Error:", error);
    res.status(500).json({ error: "Erreur lors de l'enregistrement de l'encaissement." });
  }
});

// GET /api/financials/stats
// Financial analytics for manager / admin
router.get('/stats', auth, checkRole(['admin', 'manager']), async (req, res) => {
  try {
    // 1. Fetch all payments for CA calculations
    const { data: allPayments, error: payError } = await supabase
      .from('payments')
      .select('amount_total, payment_method, created_at')
      .eq('clinic_id', req.user.clinicId);

    if (payError) throw payError;

    // Calculate Chiffre d'affaires total
    const totalRevenue = (allPayments || []).reduce((sum, p) => sum + p.amount_total, 0);

    // Calculate Chiffre d'affaires aujourd'hui (local date comparison)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayRevenue = (allPayments || [])
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
    const distribution = Object.values(distMap);

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

// POST /api/financials/subscription-pay
// Mobile Money subscription simulator (15 000 FCFA/mois)
router.post('/subscription-pay', auth, checkRole(['admin']), async (req, res) => {
  try {
    const { provider, phoneNumber, months } = req.body;

    if (!provider || !phoneNumber) {
      return res.status(400).json({ error: "Fournisseur mobile money et numéro de téléphone requis." });
    }

    const qtyMonths = parseInt(months) || 1;
    const amount = qtyMonths * 15000;

    // Simulate Payment confirmation
    console.log(`[MOBILE MONEY SIMULATOR] Push request sent to provider "${provider}" for number "${phoneNumber}" of amount "${amount} FCFA".`);
    console.log(`[MOBILE MONEY SIMULATOR] User confirmed PIN code. Payment successful!`);

    // Fetch current clinic details
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('subscription_expires_at, subscription_status')
      .eq('id', req.user.clinicId)
      .single();

    if (clinicError) throw clinicError;

    let baseDate = new Date();
    // If the clinic is active and hasn't expired yet, extend from expiry date
    if (clinic.subscription_status === 'active' && clinic.subscription_expires_at) {
      const currentExpiry = new Date(clinic.subscription_expires_at);
      if (currentExpiry > baseDate) {
        baseDate = currentExpiry;
      }
    }

    // Add months
    baseDate.setMonth(baseDate.getMonth() + qtyMonths);
    const newExpiryStr = baseDate.toISOString();

    // Update Clinic subscription status
    const { error: updateError } = await supabase
      .from('clinics')
      .update({
        subscription_status: 'active',
        subscription_expires_at: newExpiryStr
      })
      .eq('id', req.user.clinicId);

    if (updateError) throw updateError;

    // Log payment record in clinic activity log
    await supabase.from('activity_logs').insert({
      clinic_id: req.user.clinicId,
      user_id: req.user.userId,
      action: 'SUBSCRIPTION_RENEW',
      details: `Abonnement renouvelé pour ${qtyMonths} mois (${amount} FCFA) via ${provider.toUpperCase()}`
    });

    const { data: updatedClinic, error: loadUpdatedError } = await supabase
      .from('clinics')
      .select('*')
      .eq('id', req.user.clinicId)
      .single();

    if (loadUpdatedError) throw loadUpdatedError;

    res.json({
      success: true,
      message: `Abonnement de ${amount} FCFA traité avec succès via ${provider.toUpperCase()}.`,
      clinic: updatedClinic
    });
  } catch (error) {
    console.error("Subscription renewal failed:", error);
    res.status(500).json({ error: "Erreur lors du traitement de l'abonnement." });
  }
});

module.exports = router;
