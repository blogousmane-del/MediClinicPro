// Échappe une valeur avant de l'insérer dans du HTML (e-mails). Les cinq
// caractères qui permettent d'ouvrir une balise ou de sortir d'un attribut.
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { escapeHtml };
