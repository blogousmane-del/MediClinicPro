// La recherche patients passe la saisie dans un filtre .or() de PostgREST, dont
// la virgule et les parenthèses sont la syntaxe : « Koné, Awa » cassait la
// requête et la page affichait une erreur au lieu des résultats.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const { ilikeOrFilter } = require(path.join(__dirname, '..', 'utils', 'search.js'));

const COLUMNS = ['first_name', 'last_name', 'folder_number', 'phone'];

test('une recherche ordinaire porte sur chaque colonne', () => {
  assert.strictEqual(
    ilikeOrFilter(COLUMNS, 'Koné'),
    'first_name.ilike.%Koné%,last_name.ilike.%Koné%,folder_number.ilike.%Koné%,phone.ilike.%Koné%'
  );
});

test('virgules et parenthèses de la saisie ne changent plus la structure du filtre', () => {
  const filter = ilikeOrFilter(COLUMNS, ' Koné, Awa (mère) ');
  assert.strictEqual(filter.split(',').length, COLUMNS.length);
  assert.doesNotMatch(filter, /[()]/);
  assert.match(filter, /^first_name\.ilike\.%Koné Awa mère%,/);
});

test('une saisie vide, faite seulement de séparateurs, ou qui n\'est pas du texte ne filtre rien', () => {
  assert.strictEqual(ilikeOrFilter(COLUMNS, ''), null);
  assert.strictEqual(ilikeOrFilter(COLUMNS, ' , ( ) '), null);
  assert.strictEqual(ilikeOrFilter(COLUMNS, undefined), null);
  // ?q=a&q=b : Express en fait un tableau, qui devenait « a,b » dans le filtre.
  assert.strictEqual(ilikeOrFilter(COLUMNS, ['a', 'b']), null);
});
