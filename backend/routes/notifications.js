// Clinic-facing notification feed — merges stored Super Admin broadcasts
// (backend/routes/platform.js's POST /notifications is the only writer of
// the notifications/notification_clinics tables) with system alerts
// recomputed live from the same low-stock/near-expiry query already used
// for the Dashboard's alert counts (backend/routes/financials.js). System
// alerts have no row of their own — they're given a synthetic, stable id
// (sys-lowstock-<medication id>, sys-expiry-<medication id>) purely so
// notification_reads can track whether a user has seen them.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');

router.use(auth);

const NEAR_EXPIRY_WINDOW_DAYS = 30;

async function getSystemAlerts(clinicId) {
  const { data: medications, error } = await supabase
    .from('medications')
    .select('id, name, stock_quantity, min_stock_threshold, expiry_date')
    .eq('clinic_id', clinicId);
  if (error) throw error;

  const todayStr = new Date().toISOString().split('T')[0];
  const limit = new Date();
  limit.setDate(limit.getDate() + NEAR_EXPIRY_WINDOW_DAYS);
  const limitStr = limit.toISOString().split('T')[0];

  const alerts = [];
  for (const m of medications || []) {
    if (m.stock_quantity <= m.min_stock_threshold) {
      alerts.push({
        id: `sys-lowstock-${m.id}`,
        type: 'system',
        title: 'Stock bas',
        body: `${m.name} : ${m.stock_quantity} unité(s) restante(s) (seuil ${m.min_stock_threshold}).`,
        createdAt: todayStr
      });
    }
    if (m.expiry_date && m.expiry_date <= limitStr && m.expiry_date >= todayStr) {
      alerts.push({
        id: `sys-expiry-${m.id}`,
        type: 'system',
        title: 'Péremption proche',
        body: `${m.name} expire le ${m.expiry_date}.`,
        createdAt: todayStr
      });
    }
  }
  return alerts;
}

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const clinicId = req.user.clinicId;

    // Scope the notifications fetch server-side to this clinic's own
    // targeted broadcasts plus target_all ones, instead of pulling every
    // clinic's broadcasts (and recipient lists) and filtering in JS — that
    // both leaked other clinics' targeting data and risked PostgREST's
    // default row cap truncating results before this clinic's own targeted
    // broadcast was even reached.
    const { data: links, error: linksError } = await supabase
      .from('notification_clinics')
      .select('notification_id')
      .eq('clinic_id', clinicId);
    if (linksError) throw linksError;
    const ownIds = (links || []).map(l => l.notification_id);

    let broadcastQuery = supabase
      .from('notifications')
      .select('id, title, body, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    broadcastQuery = ownIds.length > 0
      ? broadcastQuery.or(`target_all.eq.true,id.in.(${ownIds.join(',')})`)
      : broadcastQuery.eq('target_all', true);
    const { data: broadcastRows, error: broadcastError } = await broadcastQuery;
    if (broadcastError) throw broadcastError;

    const broadcasts = (broadcastRows || []).map(n => ({
      id: String(n.id),
      type: 'broadcast',
      title: n.title,
      body: n.body,
      createdAt: n.created_at
    }));

    const systemAlerts = await getSystemAlerts(clinicId);

    const merged = [...broadcasts, ...systemAlerts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const ids = merged.map(n => n.id);
    let readIds = new Set();
    if (ids.length > 0) {
      const { data: reads, error: readsError } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', req.user.userId)
        .in('notification_id', ids);
      if (readsError) throw readsError;
      readIds = new Set((reads || []).map(r => r.notification_id));
    }

    const items = merged.map(n => ({ ...n, read: readIds.has(n.id) }));
    const unreadCount = items.filter(n => !n.read).length;

    res.json({ items, unreadCount });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    res.status(500).json({ error: "Erreur lors du chargement des notifications." });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req, res) => {
  try {
    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        { user_id: req.user.userId, notification_id: req.params.id, read_at: new Date().toISOString() },
        { onConflict: 'user_id,notification_id' }
      );
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Mark Notification Read Error:", error);
    res.status(500).json({ error: "Erreur lors du marquage de la notification." });
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ success: true });
    }
    const rows = ids.map(id => ({
      user_id: req.user.userId,
      notification_id: String(id),
      read_at: new Date().toISOString()
    }));
    const { error } = await supabase
      .from('notification_reads')
      .upsert(rows, { onConflict: 'user_id,notification_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Mark All Notifications Read Error:", error);
    res.status(500).json({ error: "Erreur lors du marquage des notifications." });
  }
});

module.exports = router;
