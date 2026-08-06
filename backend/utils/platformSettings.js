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

const DEFAULTS = {
  starter_trial_days: 7,
  maintenance_message: ''
};

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

module.exports = { DEFAULTS, isMissingRelation, getSettings, setSetting };
