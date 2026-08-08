// Réglages de plateforme (table platform_settings), lus par le console Super
// Admin et par l'inscription. La table est une migration à exécuter à la main
// (voir CLAUDE.md, schema drift) : tout ce module dégrade proprement tant
// qu'elle n'existe pas, il ne lève jamais pour cette raison.
//
// Périmètre volontairement étroit : les prix et limites de plans restent dans
// utils/plans.js (une faute de saisie dans un stockage modifiable casserait la
// facturation de toutes les cliniques d'un coup) et SUPER_ADMIN_EMAILS reste
// une variable d'environnement — c'est la frontière d'authentification du
// console qui servirait à l'éditer.
const { supabase } = require('../database');
const secretBox = require('./secretBox');

const DEFAULTS = {
  starter_trial_days: 7,
  maintenance_message: '',
  // Correspondance <plan>_<mois> -> identifiant de produit Chariow, en JSON.
  // Vide tant que l'exploitant n'a rien configuré ; le checkout renvoie alors
  // une erreur nommant la combinaison manquante.
  chariow_products: '',
  chariow_api_url: 'https://api.chariow.com/v1'
};

// Clés dont la valeur est chiffrée en base et n'apparaît JAMAIS dans
// getSettings() — donc jamais dans la réponse de GET /api/platform/config.
// Elles vivent dans la même table que les réglages ordinaires mais ne
// partagent ni leur chemin de lecture ni leur chemin d'écriture.
const SECRET_KEYS = ['chariow_api_key', 'chariow_webhook_secret'];

// PGRST205 = table inconnue du cache de schéma, PGRST204 = colonne inconnue
// dans le corps d'un write, 42P01/42703 = les équivalents côté Postgres.
const MISSING_RELATION_CODES = ['PGRST205', 'PGRST204', '42P01', '42703'];

function isMissingRelation(error) {
  return !!error && MISSING_RELATION_CODES.includes(error.code);
}

function coerce(key, raw) {
  if (raw === undefined || raw === null) return DEFAULTS[key];
  if (key === 'starter_trial_days') {
    // Format strict : parseInt('14 jours') vaudrait 14 et masquerait une
    // saisie douteuse. Une valeur illisible ou hors bornes retombe sur le
    // défaut plutôt que de fixer une durée d'essai absurde.
    if (!/^\d+$/.test(String(raw).trim())) return DEFAULTS.starter_trial_days;
    const n = parseInt(String(raw).trim(), 10);
    return n >= 1 && n <= 90 ? n : DEFAULTS.starter_trial_days;
  }
  return String(raw);
}

/**
 * @returns {Promise<{values: {starter_trial_days: number, maintenance_message: string}, tableMissing: boolean}>}
 */
async function getSettings() {
  const { data, error } = await supabase.from('platform_settings').select('key, value');

  if (isMissingRelation(error)) {
    return { values: { ...DEFAULTS }, tableMissing: true };
  }
  if (error) throw error;

  const byKey = new Map((data || []).map((row) => [row.key, row.value]));
  const values = {};
  for (const key of Object.keys(DEFAULTS)) values[key] = coerce(key, byKey.get(key));
  return { values, tableMissing: false };
}

/**
 * @returns {Promise<{ok: true} | {ok: false, tableMissing: boolean, error: string}>}
 */
async function setSetting(key, value, userId) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    return { ok: false, tableMissing: false, error: `Réglage inconnu : ${key}` };
  }
  return writeSetting(key, String(value), userId);
}

// Écriture brute, sans liste blanche : les deux appelants (setSetting pour les
// réglages ordinaires, setSecret pour les valeurs chiffrées) valident leur clé
// selon leur propre liste avant d'arriver ici.
async function writeSetting(key, value, userId) {
  const { data: existing, error: readError } = await supabase
    .from('platform_settings')
    .select('key')
    .eq('key', key)
    .maybeSingle();

  if (isMissingRelation(readError)) {
    return { ok: false, tableMissing: true, error: 'La table platform_settings est absente.' };
  }
  if (readError) return { ok: false, tableMissing: false, error: readError.message };

  const payload = { key, value: String(value), updated_by: userId, updated_at: new Date().toISOString() };
  const { error: writeError } = existing
    ? await supabase.from('platform_settings').update(payload).eq('key', key)
    : await supabase.from('platform_settings').insert(payload);

  if (isMissingRelation(writeError)) {
    return { ok: false, tableMissing: true, error: 'La table platform_settings est absente.' };
  }
  if (writeError) return { ok: false, tableMissing: false, error: writeError.message };

  return { ok: true };
}

async function readRaw(key) {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (isMissingRelation(error) || error) return null;
  return data ? data.value : null;
}

/**
 * Valeur déchiffrée d'un secret, ou null s'il est absent ou illisible.
 * Réservé au code serveur qui doit réellement s'en servir (l'adaptateur
 * Chariow, la vérification du webhook) — jamais à une réponse HTTP.
 * @param {string} key
 * @returns {Promise<string|null>}
 */
async function getSecret(key) {
  if (!SECRET_KEYS.includes(key)) return null;
  const stored = await readRaw(key);
  if (!stored) return null;
  return secretBox.decrypt(stored);
}

/**
 * Vrai si un secret est enregistré, sans jamais révéler sa valeur. C'est ce
 * que la console de configuration affiche.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function hasSecret(key) {
  if (!SECRET_KEYS.includes(key)) return false;
  return !!(await readRaw(key));
}

/**
 * @returns {Promise<{ok: true} | {ok: false, tableMissing: boolean, error: string}>}
 */
async function setSecret(key, value, userId) {
  if (!SECRET_KEYS.includes(key)) {
    return { ok: false, tableMissing: false, error: `Secret inconnu : ${key}` };
  }
  // Refus net plutôt qu'un repli en clair : un secret stocké lisiblement dans
  // une table que la console sait afficher serait pire que pas de secret.
  if (!secretBox.isEncryptionConfigured()) {
    return {
      ok: false,
      tableMissing: false,
      error: "CONFIG_ENCRYPTION_KEY n'est pas configurée : impossible d'enregistrer un secret sans le chiffrer."
    };
  }
  return writeSetting(key, secretBox.encrypt(String(value)), userId);
}

module.exports = {
  DEFAULTS,
  SECRET_KEYS,
  isMissingRelation,
  getSettings,
  setSetting,
  getSecret,
  setSecret,
  hasSecret
};
