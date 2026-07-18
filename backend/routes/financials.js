const express = require('express');
const router = express.Router();
const { runAsync, getAsync, allAsync } = require('../database');
const { auth, checkRole } = require('../middleware/auth');

// GET /api/financials/payments
// List payments / receipts
router.get('/payments', auth, async (req, res) => {
  try {
    const { startDate, endDate, method, status } = req.query;
    let query = `
      SELECT pay.*, pat.first_name as patient_first_name, pat.last_name as patient_last_name, pat.folder_number, u.name as cashier_name
      FROM payments pay
      JOIN patients pat ON pay.patient_id = pat.id
      JOIN users u ON pay.user_id = u.id
      WHERE pay.clinic_id = ?
    `;
    const params = [req.user.clinicId];

    if (startDate) {
      query += " AND pay.created_at >= ?";
      params.push(`${startDate}T00:00:00`);
    }
    if (endDate) {
      query += " AND pay.created_at <= ?";
      params.push(`${endDate}T23:59:59`);
    }
    if (method) {
      query += " AND pay.payment_method = ?";
      params.push(method);
    }
    if (status) {
      query += " AND pay.status = ?";
      params.push(status);
    }

    query += " ORDER BY pay.created_at DESC";
    const payments = await allAsync(query, params);

    // Parse JSON items
    const parsedPayments = payments.map(pay => ({
      ...pay,
      items: JSON.parse(pay.items || '[]')
    }));

    res.json(parsedPayments);
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

    const itemsJson = JSON.stringify(items);
    const result = await runAsync(
      `INSERT INTO payments (clinic_id, patient_id, user_id, amount_total, payment_method, reference_number, status, items) 
       VALUES (?, ?, ?, ?, ?, ?, 'paid', ?)`,
      [req.user.clinicId, patientId, req.user.userId, amountTotal, paymentMethod, referenceNumber || `REF-${Date.now()}`, itemsJson]
    );

    // Log Activity
    const patient = await getAsync("SELECT first_name, last_name FROM patients WHERE id = ?", [patientId]);
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'PAYMENT_RECORD', ?)",
      [req.user.clinicId, req.user.userId, `Encaissement de ${amountTotal} FCFA pour ${patient.first_name} ${patient.last_name} (${paymentMethod})`]
    );

    res.status(201).json({
      success: true,
      paymentId: result.lastID,
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
    // 1. Chiffre d'affaires total
    const totalRevRow = await getAsync("SELECT SUM(amount_total) as total FROM payments WHERE clinic_id = ?", [req.user.clinicId]);
    const totalRevenue = totalRevRow.total || 0;

    // 2. Chiffre d'affaires aujourd'hui
    const today = new Date().toISOString().split('T')[0];
    const todayRevRow = await getAsync(
      "SELECT SUM(amount_total) as total FROM payments WHERE clinic_id = ? AND created_at LIKE ?",
      [req.user.clinicId, `${today}%`]
    );
    const todayRevenue = todayRevRow.total || 0;

    // 3. Distribution des paiements par mode
    const distribution = await allAsync(
      "SELECT payment_method as method, SUM(amount_total) as total, COUNT(*) as count FROM payments WHERE clinic_id = ? GROUP BY payment_method",
      [req.user.clinicId]
    );

    // 4. Activité récente (10 derniers logs)
    const logs = await allAsync(
      `SELECT l.*, u.name as user_name 
       FROM activity_logs l 
       LEFT JOIN users u ON l.user_id = u.id 
       WHERE l.clinic_id = ? 
       ORDER BY l.created_at DESC LIMIT 10`,
      [req.user.clinicId]
    );

    // 5. Total counts for patients, appointments
    const patientCount = await getAsync("SELECT COUNT(*) as count FROM patients WHERE clinic_id = ? AND archived = 0", [req.user.clinicId]);
    const apptCount = await getAsync("SELECT COUNT(*) as count FROM appointments WHERE clinic_id = ? AND status = 'scheduled'", [req.user.clinicId]);

    // 6. Stock Alerts Counts
    const lowStockRow = await getAsync("SELECT COUNT(*) as count FROM medications WHERE clinic_id = ? AND stock_quantity <= min_stock_threshold", [req.user.clinicId]);
    
    const limit30Days = new Date();
    limit30Days.setDate(limit30Days.getDate() + 30);
    const nearExpiryRow = await getAsync(
      "SELECT COUNT(*) as count FROM medications WHERE clinic_id = ? AND expiry_date <= ? AND expiry_date > CURRENT_TIMESTAMP", 
      [req.user.clinicId, limit30Days.toISOString().split('T')[0]]
    );

    res.json({
      totalRevenue,
      todayRevenue,
      distribution,
      logs,
      patientsTotal: patientCount.count,
      appointmentsScheduled: apptCount.count,
      lowStockCount: lowStockRow.count,
      nearExpiryCount: nearExpiryRow.count
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
    const { provider, phoneNumber, months } = req.body; // e.g., 'wave', 'orange_money', 'mtn_momo'

    if (!provider || !phoneNumber) {
      return res.status(400).json({ error: "Fournisseur mobile money et numéro de téléphone requis." });
    }

    const qtyMonths = parseInt(months) || 1;
    const amount = qtyMonths * 15000;

    // Simulate Network push
    console.log(`[MOBILE MONEY SIMULATOR] Push request sent to provider "${provider}" for number "${phoneNumber}" of amount "${amount} FCFA".`);
    console.log(`[MOBILE MONEY SIMULATOR] User confirmed PIN code. Payment successful!`);

    // Fetch current clinic details
    const clinic = await getAsync("SELECT subscription_expires_at, subscription_status FROM clinics WHERE id = ?", [req.user.clinicId]);
    
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
    await runAsync(
      "UPDATE clinics SET subscription_status = 'active', subscription_expires_at = ? WHERE id = ?",
      [newExpiryStr, req.user.clinicId]
    );

    // Log payment record in clinic activity log
    await runAsync(
      "INSERT INTO activity_logs (clinic_id, user_id, action, details) VALUES (?, ?, 'SUBSCRIPTION_RENEW', ?)",
      [req.user.clinicId, req.user.userId, `Abonnement renouvelé pour ${qtyMonths} mois (${amount} FCFA) via ${provider.toUpperCase()}`]
    );

    const updatedClinic = await getAsync("SELECT * FROM clinics WHERE id = ?", [req.user.clinicId]);

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
