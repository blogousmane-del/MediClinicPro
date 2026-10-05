// Filtre .or() de PostgREST qui cherche `q` dans plusieurs colonnes (ilike).
// La virgule et les parenthèses sont la syntaxe de ce filtre : laissées dans la
// saisie, elles en changeaient la structure, et « Koné, Awa » cassait la
// requête. Elles deviennent des espaces. Renvoie null quand il n'y a rien à
// chercher, l'appelant ne filtre alors pas.
function ilikeOrFilter(columns, q) {
  if (typeof q !== 'string') return null;
  const term = q.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!term) return null;
  return columns.map((column) => `${column}.ilike.%${term}%`).join(',');
}

module.exports = { ilikeOrFilter };
