// Journal des échecs de connexion, alimenté par POST /auth/login et lu par
// Platform Admin > Sécurité.
//
// Pourquoi une table dédiée plutôt qu'activity_logs : celle-ci impose
// clinic_id NOT NULL, or un échec sur un email inconnu n'a pas de clinique.
//
// Trois règles non négociables :
//  1. L'écriture ne doit JAMAIS casser la connexion. Tout est encapsulé dans
//     un try/catch et la fonction ne rejette pas — y compris si la table
//     n'existe pas encore (migration manuelle, voir CLAUDE.md).
//  2. Le mot de passe tenté n'est jamais stocké, ni son empreinte, ni sa
//     longueur. Seulement l'email, l'IP et le motif.
//  3. Le motif reste interne. L'appelant renvoie le même message générique
//     dans tous les cas, sinon la route devient un oracle indiquant quels
//     emails existent.
const { supabase } = require('../database');

const REASONS = {
  // La requête de connexion filtre déjà .eq('active', 1) : un email inconnu et
  // un compte désactivé sont indiscernables sans une seconde requête, que ce
  // chemin ne peut pas se permettre puisqu'un attaquant l'inonde. Aucune perte
  // de détection : le signal de bourrage vient du volume par IP.
  UNKNOWN_OR_INACTIVE: 'unknown_or_inactive',
  BAD_PASSWORD: 'bad_password'
};

const MISSING_RELATION_CODES = ['PGRST205', 'PGRST204', '42P01', '42703'];
const isMissingRelation = (error) => !!error && MISSING_RELATION_CODES.includes(error.code);

/**
 * Enregistre un échec de connexion. Ne rejette jamais.
 * Toute propriété non listée dans la destructuration (mot de passe compris)
 * est ignorée et ne peut donc pas fuiter en base.
 * @param {{email: string, clinicId?: number|null, reason: string, ip?: string|null}} params
 * @returns {Promise<void>}
 */
async function recordLoginFailure({ email, clinicId = null, reason, ip = null }) {
  try {
    const { error } = await supabase.from('login_failures').insert({
      email: String(email || '').trim().toLowerCase(),
      clinic_id: clinicId,
      reason,
      ip_address: ip
    });
    if (error && !isMissingRelation(error)) {
      console.error('[LOGIN-FAILURES] Enregistrement refusé (connexion non affectée):', error.message);
    }
  } catch (error) {
    console.error('[LOGIN-FAILURES] Enregistrement impossible (connexion non affectée):', error.message);
  }
}

/**
 * @param {number} [limitRows]
 * @returns {Promise<{rows: Array, tableMissing: boolean}>}
 */
async function getRecentFailures(limitRows = 200) {
  try {
    const { data, error } = await supabase
      .from('login_failures')
      .select('id, email, clinic_id, reason, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(limitRows);

    if (isMissingRelation(error)) return { rows: [], tableMissing: true };
    if (error) throw error;
    return { rows: data || [], tableMissing: false };
  } catch (error) {
    if (isMissingRelation(error)) return { rows: [], tableMissing: true };
    throw error;
  }
}

module.exports = { REASONS, recordLoginFailure, getRecentFailures, isMissingRelation };
