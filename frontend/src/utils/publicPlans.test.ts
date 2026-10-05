// Lancé par `npm test` (node --test, retrait des types natif à Node 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_CATALOG, mergeCatalog, trialDaysOf, formatFcfa } from './publicPlans.ts';

test('sans réponse exploitable, le catalogue de repli', () => {
  assert.deepEqual(mergeCatalog(undefined), FALLBACK_CATALOG);
  assert.deepEqual(mergeCatalog('erreur'), FALLBACK_CATALOG);
  assert.equal(trialDaysOf(mergeCatalog(null)), 7);
});

test('les valeurs de l\'API remplacent le repli, y compris la durée d\'essai', () => {
  const catalog = mergeCatalog({
    starter: { id: 'starter', price: 0, trialDays: 14, staffLimit: 3 },
    clinique: { id: 'clinique', price: 9500, trialDays: null, staffLimit: 6 },
    hopital: { id: 'hopital', price: 15000, trialDays: null, staffLimit: null }
  });
  assert.equal(trialDaysOf(catalog), 14);
  assert.deepEqual(catalog.clinique, { price: 9500, staffLimit: 6, trialDays: null });
  assert.equal(catalog.hopital.staffLimit, null);
});

test('une valeur malformée garde le repli plutôt qu\'afficher « NaN FCFA »', () => {
  const catalog = mergeCatalog({ clinique: { price: '9000', staffLimit: 'cinq' }, starter: { trialDays: 0 } });
  assert.deepEqual(catalog.clinique, FALLBACK_CATALOG.clinique);
  assert.equal(trialDaysOf(catalog), 7);
});

test('les montants s\'écrivent avec une espace fine insécable entre les milliers', () => {
  assert.equal(formatFcfa(0), '0');
  assert.equal(formatFcfa(9000), '9 000');
  assert.equal(formatFcfa(14500), '14 500');
  assert.equal(formatFcfa(1234567), '1 234 567');
});
