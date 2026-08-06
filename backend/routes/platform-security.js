// Section Sécurité du console Super Admin. Trois vues en lecture seule :
// échecs de connexion, journal d'audit inter-cliniques, posture de la
// plateforme. Monté sous /api/platform à côté de platform.js, qui n'est pas
// modifié.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly, SUPER_ADMIN_EMAILS } = require('../middleware/superAdmin');
const { getRecentFailures } = require('../utils/loginFailures');

router.use(auth, superAdminOnly);

// Au-delà de ce nombre d'échecs depuis une même IP en une heure, on parle de
// bourrage d'identifiants et non d'un mot de passe oublié.
const BRUTE_FORCE_THRESHOLD = 10;
const ONE_HOUR_MS = 3600 * 1000;
const AUDIT_PAGE_SIZE = 50;

const isSet = (name) => !!(process.env[name] || '').trim();

// GET /api/platform/security/logins
router.get('/security/logins', async (req, res) => {
  try {
    const { rows, tableMissing } = await getRecentFailures(500);

    if (tableMissing) {
      return res.json({ tableMissing: true, total24h: 0, recent: [], topIps: [], topEmails: [] });
    }

    const now = Date.now();
    const byIp = new Map();
    const byEmail = new Map();
    let total24h = 0;

    for (const row of rows) {
      const age = now - new Date(row.created_at).getTime();
      if (age <= 24 * ONE_HOUR_MS) total24h++;

      const ip = row.ip_address || 'inconnue';
      const ipEntry = byIp.get(ip) || { ip, count: 0, lastHour: 0 };
      ipEntry.count++;
      if (age <= ONE_HOUR_MS) ipEntry.lastHour++;
      byIp.set(ip, ipEntry);

      byEmail.set(row.email, (byEmail.get(row.email) || 0) + 1);
    }

    res.json({
      tableMissing: false,
      total24h,
      recent: rows.slice(0, 50).map((row) => ({
        id: row.id,
        email: row.email,
        clinicId: row.clinic_id,
        reason: row.reason,
        ip: row.ip_address,
        createdAt: row.created_at
      })),
      topIps: [...byIp.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((entry) => ({
          ip: entry.ip,
          count: entry.count,
          // Le seuil porte sur la DERNIÈRE HEURE, pas sur le total : douze
          // échecs étalés sur trois mois sont un utilisateur distrait, douze
          // en une heure sont une attaque.
          suspicious: entry.lastHour > BRUTE_FORCE_THRESHOLD
        })),
      topEmails: [...byEmail.entries()]
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    });
  } catch (error) {
    console.error('[PLATFORM-SECURITY] Erreur de lecture des connexions:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture des échecs de connexion.' });
  }
});

// GET /api/platform/security/audit
// Journal inter-cliniques. Volontairement hors du filtre clinic_id — c'est
// l'exception assumée de platform.js, voir CLAUDE.md.
router.get('/security/audit', async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page, 10) || 0);
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 24 * ONE_HOUR_MS).toISOString();

    let query = supabase
      .from('activity_logs')
      .select('id, clinic_id, user_id, action, details, ip_address, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (req.query.clinicId) query = query.eq('clinic_id', parseInt(req.query.clinicId, 10));
    if (req.query.action) query = query.eq('action', String(req.query.action));

    const { data: logs, error: logsError } = await query;
    if (logsError) throw logsError;

    const { data: clinics } = await supabase.from('clinics').select('id, name');
    const { data: users } = await supabase.from('users').select('id, name');
    const clinicNameById = new Map((clinics || []).map((c) => [c.id, c.name]));
    const userNameById = new Map((users || []).map((u) => [u.id, u.name]));

    const all = logs || [];
    const start = page * AUDIT_PAGE_SIZE;
    const slice = all.slice(start, start + AUDIT_PAGE_SIZE);

    res.json({
      rows: slice.map((row) => ({
        id: row.id,
        clinicId: row.clinic_id,
        clinicName: clinicNameById.get(row.clinic_id) || `Clinique ${row.clinic_id}`,
        userId: row.user_id,
        userName: userNameById.get(row.user_id) || null,
        action: row.action,
        details: row.details,
        ip: row.ip_address,
        // Sur ces lignes, la clinique du user_id et le clinic_id de la ligne
        // divergent volontairement : c'est un Super Admin agissant sur une
        // autre clinique. Sans ce marquage, ça se lit comme si la clinique
        // s'était modifiée elle-même.
        isPlatformAction: String(row.action || '').startsWith('PLATFORM_')
      })),
      page,
      pageSize: AUDIT_PAGE_SIZE,
      hasMore: start + AUDIT_PAGE_SIZE < all.length,
      actions: [...new Set(all.map((row) => row.action))].sort()
    });
  } catch (error) {
    console.error('[PLATFORM-SECURITY] Erreur de lecture du journal:', error);
    res.status(500).json({ error: "Erreur lors de la lecture du journal d'audit." });
  }
});

// GET /api/platform/security/posture
router.get('/security/posture', async (req, res) => {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, suspended_by_platform');
    if (clinicsError) throw clinicsError;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, clinic_id, role, active, password_set');
    if (usersError) throw usersError;

    const activeAdminClinicIds = new Set(
      (users || []).filter((u) => u.role === 'admin' && u.active === 1).map((u) => u.clinic_id)
    );

    res.json({
      suspendedClinics: (clinics || [])
        .filter((c) => c.suspended_by_platform)
        .map((c) => ({ id: c.id, name: c.name })),
      // Une clinique sans admin actif ne peut plus gérer son propre personnel
      // ni son abonnement : elle est enfermée dehors.
      clinicsWithoutActiveAdmin: (clinics || [])
        .filter((c) => !activeAdminClinicIds.has(c.id))
        .map((c) => ({ id: c.id, name: c.name })),
      deactivatedUsers: (users || []).filter((u) => u.active === 0).length,
      // Comptes Google n'ayant jamais défini de mot de passe : ils dépendent
      // entièrement de Google et deviennent inaccessibles si GOOGLE_CLIENT_ID
      // est retiré.
      googleOnlyAccounts: (users || []).filter((u) => u.password_set === false).length,
      superAdminCount: SUPER_ADMIN_EMAILS.length,
      // En mémoire sur Vercel, la limitation est par instance et remise à zéro
      // à chaque démarrage à froid — donc quasi inexistante.
      rateLimitBackend: isSet('UPSTASH_REDIS_REST_URL') && isSet('UPSTASH_REDIS_REST_TOKEN') ? 'redis' : 'memory'
    });
  } catch (error) {
    console.error('[PLATFORM-SECURITY] Erreur de lecture de la posture:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture de la posture de sécurité.' });
  }
});

module.exports = router;
