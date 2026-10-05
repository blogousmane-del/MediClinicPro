// Lancé par `npm test` (node --test, retrait des types natif à Node 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { frenchList } from './frenchList.ts';

test('énumère à la française, avec « et » ou « ou » avant le dernier élément', () => {
  assert.equal(frenchList([]), '');
  assert.equal(frenchList(['Wave']), 'Wave');
  assert.equal(frenchList(['Wave', 'carte bancaire'], 'ou'), 'Wave ou carte bancaire');
  assert.equal(frenchList(['consultations', 'ordonnances', 'examens']), 'consultations, ordonnances et examens');
});
