// Inspecteur de configuration de la plateforme (Super Admin uniquement).
//
// RÈGLE ABSOLUE : cette route ne renvoie JAMAIS la valeur d'un secret —
// seulement des booléens « renseigné / vide », plus les URLs publiques. Pas de
// clé, pas de préfixe de clé, pas de longueur. superAdminOnly protège la
// route, mais une route qui n'expose rien ne peut rien fuiter même si la garde
// tombe un jour. Un test dédié (tests/platform-config.test.js) échoue si une
// valeur de secret ressort dans le corps de la réponse.
//
// Monté sous /api/platform à côté de routes/platform.js, qui n'est pas modifié.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/superAdmin');
const { PLAN_IDS, getPlan } = require('../utils/plans');
const bictorys = require('../services/payments/bictorys');
const paytech = require('../services/payments/paytech');
const paypal = require('../services/payments/paypal');
const { getSettings, setSetting } = require('../utils/platformSettings');

router.use(auth, superAdminOnly);

const MAINTENANCE_MESSAGE_MAX = 280;

const isSet = (name) => !!(process.env[name] || '').trim();

// Même ordre de priorité que utils/mailer.js : Resend, puis SMTP, puis console.
function emailChannel() {
  if (isSet('RESEND_API_KEY')) return 'resend';
  if (isSet('SMTP_HOST')) return 'smtp';
  return 'console';
}

async function databaseConnected() {
  try {
    const { error } = await supabase.from('clinics').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// GET /api/platform/config
router.get('/config', async (req, res) => {
  try {
    const rawMode = (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase();
    const settings = await getSettings();

    res.json({
      payments: {
        bictorys: bictorys.isConfigured(),
        paytech: paytech.isConfigured(),
        paypal: paypal.isConfigured()
      },
      paypal: {
        // Un mode non reconnu retombe en sandbox côté paypal.js. On le signale
        // ici parce que c'est silencieux autrement : des identifiants live
        // pointés vers sandbox échouent en 401 sans explication visible.
        mode: rawMode === 'live' ? 'live' : 'sandbox',
        modeRecognised: rawMode === 'live' || rawMode === 'sandbox',
        webhookConfigured: isSet('PAYPAL_WEBHOOK_ID'),
        rateConfigured: isSet('XOF_TO_USD_RATE')
      },
      email: { channel: emailChannel() },
      rateLimit: {
        backend: isSet('UPSTASH_REDIS_REST_URL') && isSet('UPSTASH_REDIS_REST_TOKEN') ? 'redis' : 'memory'
      },
      google: { configured: isSet('GOOGLE_CLIENT_ID') },
      cron: { configured: isSet('CRON_SECRET') },
      urls: {
        apiPublicUrl: process.env.API_PUBLIC_URL || '',
        appUrl: process.env.APP_URL || ''
      },
      database: { connected: await databaseConnected() },
      plans: PLAN_IDS.map((id) => {
        const plan = getPlan(id);
        return { id, name: plan.name, price: plan.price, staffLimit: plan.staffLimit };
      }),
      settings
    });
  } catch (error) {
    console.error('[PLATFORM-CONFIG] Erreur de lecture de la configuration:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture de la configuration.' });
  }
});

// PUT /api/platform/config
// Seuls les deux réglages sûrs sont modifiables. Les prix de plans et
// SUPER_ADMIN_EMAILS sont délibérément absents — voir utils/platformSettings.js.
router.put('/config', async (req, res) => {
  try {
    const updates = [];

    if (req.body.starter_trial_days !== undefined) {
      const raw = String(req.body.starter_trial_days).trim();
      if (!/^\d+$/.test(raw)) {
        return res.status(400).json({ error: "La durée d'essai doit être un nombre entier de jours." });
      }
      const days = parseInt(raw, 10);
      if (days < 1 || days > 90) {
        return res.status(400).json({ error: "La durée d'essai doit être comprise entre 1 et 90 jours." });
      }
      updates.push(['starter_trial_days', String(days)]);
    }

    if (req.body.maintenance_message !== undefined) {
      const message = String(req.body.maintenance_message);
      if (message.length > MAINTENANCE_MESSAGE_MAX) {
        return res.status(400).json({ error: `Le message de maintenance est limité à ${MAINTENANCE_MESSAGE_MAX} caractères.` });
      }
      updates.push(['maintenance_message', message]);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun réglage modifiable fourni.' });
    }

    for (const [key, value] of updates) {
      const result = await setSetting(key, value, req.user.userId);
      if (!result.ok) {
        return res.status(result.tableMissing ? 503 : 500).json({
          error: result.tableMissing
            ? "La table platform_settings est absente de la base. Exécutez la migration déclarée dans backend/supabase_schema.sql."
            : result.error
        });
      }
      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PLATFORM_CONFIG_UPDATE',
        details: `Réglage plateforme ${key} défini à "${value}"`
      });
    }

    const settings = await getSettings();
    res.json({ success: true, values: settings.values });
  } catch (error) {
    console.error('[PLATFORM-CONFIG] Erreur de mise à jour:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration.' });
  }
});

module.exports = router;
