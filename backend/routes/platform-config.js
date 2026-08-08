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
const crypto = require('node:crypto');
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/superAdmin');
const { PLAN_IDS, getPlan } = require('../utils/plans');
const bictorys = require('../services/payments/bictorys');
const paytech = require('../services/payments/paytech');
const paypal = require('../services/payments/paypal');
const chariow = require('../services/payments/chariow');
const secretBox = require('../utils/secretBox');
const { getSettings, setSetting, setSecret, hasSecret } = require('../utils/platformSettings');

router.use(auth, superAdminOnly);

const MAINTENANCE_MESSAGE_MAX = 280;

const CHARIOW_MONTHS = [1, 3, 6, 12];
// Les 8 combinaisons facturables. Starter est gratuit et ne passe jamais par
// un checkout : il n'a pas de produit Chariow.
const CHARIOW_PRODUCT_KEYS = PLAN_IDS
  .filter((id) => id !== 'starter')
  .flatMap((id) => CHARIOW_MONTHS.map((m) => `${id}_${m}`));

function parseStoredProducts(raw) {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

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
      chariow: {
        // 'set'/'blank' et rien d'autre : ni la clé, ni son préfixe, ni sa
        // longueur. Même règle que pour les secrets d'environnement au-dessus.
        apiKey: (await hasSecret('chariow_api_key')) ? 'set' : 'blank',
        webhookSecret: (await hasSecret('chariow_webhook_secret')) ? 'set' : 'blank',
        apiUrl: settings.values.chariow_api_url,
        // Les identifiants de produit ne sont pas des secrets : ils sont
        // visibles dans la boutique Chariow de l'exploitant.
        products: parseStoredProducts(settings.values.chariow_products),
        expectedProductKeys: CHARIOW_PRODUCT_KEYS,
        encryptionConfigured: secretBox.isEncryptionConfigured()
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

    let webhookUrl; // renvoyé UNE SEULE FOIS, à la génération du secret

    if (req.body.chariow_api_url !== undefined) {
      const url = String(req.body.chariow_api_url).trim();
      if (!/^https:\/\/.+/.test(url)) {
        return res.status(400).json({ error: "L'URL de l'API Chariow doit commencer par https://." });
      }
      updates.push(['chariow_api_url', url]);
    }

    if (req.body.chariow_products !== undefined) {
      const products = req.body.chariow_products;
      if (!products || typeof products !== 'object' || Array.isArray(products)) {
        return res.status(400).json({ error: 'La correspondance des produits doit être un objet.' });
      }
      // Validation complète AVANT toute écriture : une correspondance à moitié
      // enregistrée vendrait certaines durées et pas d'autres.
      for (const [key, value] of Object.entries(products)) {
        if (!CHARIOW_PRODUCT_KEYS.includes(key)) {
          return res.status(400).json({ error: `Combinaison plan/durée inconnue : ${key}. Attendu parmi ${CHARIOW_PRODUCT_KEYS.join(', ')}.` });
        }
        if (typeof value !== 'string' || !value.trim()) {
          return res.status(400).json({ error: `Identifiant de produit vide pour ${key}.` });
        }
      }
      updates.push(['chariow_products', JSON.stringify(products)]);
    }

    const touchesSecret = req.body.chariow_api_key !== undefined || req.body.chariow_webhook_secret !== undefined;

    if (updates.length === 0 && !touchesSecret) {
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

    if (req.body.chariow_api_key !== undefined) {
      const apiKey = String(req.body.chariow_api_key).trim();
      if (!apiKey) return res.status(400).json({ error: 'La clé API Chariow est vide.' });

      const written = await setSecret('chariow_api_key', apiKey, req.user.userId);
      if (!written.ok) {
        return res.status(written.tableMissing ? 503 : 400).json({ error: written.error });
      }
      chariow.clearConfigCache();

      // Validation en conditions réelles : une clé fausse doit être rejetée
      // maintenant, pas au premier client qui tente de payer. Le même appel
      // sert à vérifier que la boutique règle bien en XOF.
      const probe = await chariow.listProducts();
      if (!probe.ok) {
        return res.status(400).json({ error: `Clé enregistrée mais refusée par Chariow : ${probe.error}` });
      }
      const foreign = probe.products.find((p) => p.currency && p.currency !== 'XOF');
      if (foreign) {
        return res.status(400).json({
          error: `La boutique Chariow règle en ${foreign.currency}. Cette intégration n'accepte que le XOF : MediClinic facture en FCFA et ne peut pas vérifier un montant dans une autre devise.`
        });
      }

      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PLATFORM_CONFIG_UPDATE',
        // Jamais la valeur, même tronquée : un journal est lu par plus de
        // monde qu'une base de configuration.
        details: 'Clé API Chariow mise à jour'
      });
    }

    if (req.body.chariow_webhook_secret !== undefined) {
      const requested = String(req.body.chariow_webhook_secret);
      const secret = requested === '__generate__' ? crypto.randomBytes(24).toString('hex') : requested.trim();
      if (secret.length < 16) {
        return res.status(400).json({ error: 'Le secret de webhook doit faire au moins 16 caractères.' });
      }

      const written = await setSecret('chariow_webhook_secret', secret, req.user.userId);
      if (!written.ok) {
        return res.status(written.tableMissing ? 503 : 400).json({ error: written.error });
      }
      chariow.clearConfigCache();

      // Seule occasion où ce secret sort du serveur : l'exploitant doit coller
      // cette URL dans Chariow. GET /config ne la redonnera jamais.
      const base = (process.env.API_PUBLIC_URL || '').replace(/\/+$/, '');
      webhookUrl = `${base}/api/webhooks/chariow?secret=${encodeURIComponent(secret)}`;

      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PLATFORM_CONFIG_UPDATE',
        details: 'Secret de webhook Chariow régénéré'
      });
    }

    const settings = await getSettings();
    chariow.clearConfigCache();
    res.json({ success: true, values: settings.values, ...(webhookUrl ? { webhookUrl } : {}) });
  } catch (error) {
    console.error('[PLATFORM-CONFIG] Erreur de mise à jour:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration.' });
  }
});

module.exports = router;
