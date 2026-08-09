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

test('le prix est lu dans la forme reelle de GET /products', () => {
  // Forme constatee en production le 2026-08-09 : ni `amount`, ni `price`, mais
  // pricing.current_price. Une lecture unique rendait undefined, ce qui
  // neutralisait le controle de devise et faisait echouer celui du prix.
  const produit = {
    id: 'prd_tn4e8e01',
    pricing: { type: 'one_time', current_price: { value: 174000, formatted: 'F CFA 174,000', currency: 'XOF' } }
  };
  assert.deepStrictEqual(chariow.extractAmount(produit), { value: 174000, currency: 'XOF' });
});

test('les autres formes de montant restent lues', () => {
  assert.deepStrictEqual(chariow.extractAmount({ amount: { value: 9000, currency: 'xof' } }), { value: 9000, currency: 'XOF' });
  assert.deepStrictEqual(chariow.extractAmount({ price: { value: 27000, currency: 'XOF' } }), { value: 27000, currency: 'XOF' });
  assert.deepStrictEqual(chariow.extractAmount({ amount: 14500, currency: 'XOF' }), { value: 14500, currency: 'XOF' });
});

test('une forme inconnue rend NaN, jamais un zero credible', () => {
  // Zero passerait le controle « montant fini » et pourrait crediter un
  // abonnement non paye. NaN echoue ferme.
  const { value, currency } = chariow.extractAmount({ montant: 9000 });
  assert.ok(Number.isNaN(value));
  assert.strictEqual(currency, '');
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
