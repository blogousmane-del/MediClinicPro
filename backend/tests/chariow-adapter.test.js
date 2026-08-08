const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { BACKEND } = require('./helpers/harness');

const chariow = require(path.join(BACKEND, 'services', 'payments', 'chariow.js'));

test('unpaid est en attente, pas paye', () => {
  // « unpaid » contient « paid » : tester les succes en premier crediterait
  // une vente non payee.
  assert.strictEqual(chariow.mapChariowStatus('unpaid'), 'pending');
  assert.strictEqual(chariow.mapChariowStatus('UNPAID'), 'pending');
});

test('le motif de refus est lu quel que soit le champ utilise par Chariow', () => {
  // Ne lire que `message` rendait « raison inconnue » alors que la reponse
  // portait l'explication — l'exploitant cherchait alors la panne ailleurs.
  assert.strictEqual(chariow.describeError({ message: 'Unauthorized' }, ''), 'Unauthorized');
  assert.strictEqual(chariow.describeError({ error: 'Invalid API key' }, ''), 'Invalid API key');
  assert.strictEqual(chariow.describeError({ detail: 'Token expired' }, ''), 'Token expired');
  assert.strictEqual(chariow.describeError({ error_description: 'bad token' }, ''), 'bad token');
  assert.match(chariow.describeError({ errors: ['product_id manquant'] }, ''), /product_id manquant/);
});

test('sans champ reconnu, le corps brut est rendu tronque', () => {
  // Mieux vaut un extrait brut qu'un « raison inconnue » qui perd l'information.
  assert.match(chariow.describeError({ zzz: 1 }, '{"zzz":1}'), /zzz/);
  assert.strictEqual(chariow.describeError(null, ''), 'corps vide');
  const long = 'x'.repeat(500);
  assert.ok(chariow.describeError(null, long).length < 250, 'un corps long est tronque');
});

test('settled vaut paye', () => {
  assert.strictEqual(chariow.mapChariowStatus('settled'), 'succeeded');
  assert.strictEqual(chariow.mapChariowStatus('completed'), 'succeeded');
  assert.strictEqual(chariow.mapChariowStatus('paid'), 'succeeded');
  assert.strictEqual(chariow.mapChariowStatus('success'), 'succeeded');
});

test('les echecs et annulations sont distingues', () => {
  assert.strictEqual(chariow.mapChariowStatus('failed'), 'failed');
  assert.strictEqual(chariow.mapChariowStatus('error'), 'failed');
  assert.strictEqual(chariow.mapChariowStatus('cancelled'), 'abandoned');
  assert.strictEqual(chariow.mapChariowStatus('refunded'), 'abandoned');
  assert.strictEqual(chariow.mapChariowStatus('quelque_chose'), 'pending');
  assert.strictEqual(chariow.mapChariowStatus(undefined), 'pending');
});

test('le telephone part en national + ISO2, jamais en E.164', () => {
  const fromParts = chariow.resolveChariowPhone({ phoneCountry: 'CI', phoneLocal: '0700000000' });
  assert.strictEqual(fromParts.country_code, 'CI');
  assert.strictEqual(fromParts.number.startsWith('+'), false);

  const fromE164 = chariow.resolveChariowPhone({ phone: '+221771234567' });
  assert.strictEqual(fromE164.country_code, 'SN');
  assert.strictEqual(fromE164.number, '771234567');

  assert.strictEqual(chariow.resolveChariowPhone({}), null);
});

test('un numero europeen a besoin de son pays, et le garde', () => {
  // Le repli par indicatifs africains ne couvre pas +33 : sans phoneCountry ni
  // E.164 valide, Chariow rejetterait le checkout avec un 400.
  const parsed = chariow.resolveChariowPhone({ phone: '+33763627155' });
  assert.strictEqual(parsed.country_code, 'FR');
  assert.strictEqual(parsed.number, '763627155');
});

test('la correspondance produit se fait sur plan et duree', () => {
  const products = { hopital_12: 'prod_h12', clinique_1: 'prod_c1' };
  assert.strictEqual(chariow.productIdFor(products, 'hopital', 12), 'prod_h12');
  assert.strictEqual(chariow.productIdFor(products, 'clinique', 1), 'prod_c1');
  assert.strictEqual(chariow.productIdFor(products, 'hopital', 3), null);
  assert.strictEqual(chariow.productIdFor(null, 'hopital', 12), null);
  assert.strictEqual(chariow.productIdFor({ hopital_1: '   ' }, 'hopital', 1), null);
});
