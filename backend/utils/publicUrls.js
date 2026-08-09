// Résolution des deux URL publiques de l'installation. Isolée ici parce que le
// repli silencieux sur localhost a une conséquence différente selon l'endroit
// où il s'applique : dans un email, un mauvais lien se voit et se corrige ;
// dans l'adresse de retour d'un paiement, il renvoie un acheteur qui vient de
// payer vers sa propre machine, et la vente est perdue sans trace.
const DEV_APP_URL = 'http://localhost:5173';

function isProduction() {
  return !!process.env.VERCEL || process.env.NODE_ENV === 'production';
}

function clean(raw) {
  const value = String(raw || '').trim().replace(/\/+$/, '');
  return value || null;
}

/**
 * URL publique du frontend.
 * @returns {string|null} null en production quand APP_URL n'est pas défini —
 * l'appelant doit alors refuser plutôt que d'inventer une destination.
 */
function getAppUrl() {
  const configured = clean(process.env.APP_URL);
  if (configured) return configured;
  return isProduction() ? null : DEV_APP_URL;
}

/**
 * URL publique de CE backend, utilisée pour construire les adresses de rappel
 * des fournisseurs de paiement.
 * @returns {string|null}
 */
function getApiPublicUrl() {
  return clean(process.env.API_PUBLIC_URL);
}

module.exports = { getAppUrl, getApiPublicUrl, isProduction, DEV_APP_URL };
