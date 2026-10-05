// Lancé par `npm test` (node --test, retrait des types natif à Node 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isVatEnabled, computeInvoiceTotals, receiptBreakdown, vatLabel, paymentMethodLabel } from './invoice.ts';

test('la TVA reste appliquée tant que la clinique ne l\'a pas désactivée', () => {
  assert.equal(isVatEnabled(undefined), true);
  assert.equal(isVatEnabled(null), true);
  assert.equal(isVatEnabled({}), true);
  assert.equal(isVatEnabled({ tariffs: {} }), true);
  assert.equal(isVatEnabled({ vat_enabled: true }), true);
  assert.equal(isVatEnabled({ vat_enabled: false }), false);
});

test('les totaux de caisse ajoutent 18 % seulement si la TVA est active', () => {
  assert.deepEqual(computeInvoiceTotals(40600, true), { subtotal: 40600, vat: 7308, total: 47908 });
  assert.deepEqual(computeInvoiceTotals(40600, false), { subtotal: 40600, vat: 0, total: 40600 });
  assert.equal(computeInvoiceTotals(1001, true).vat, 180);
});

test('la réimpression déduit la TVA de l\'écart entre le total encaissé et les lignes', () => {
  // Le reçu de production qui a révélé le défaut : 25 000 + 15 600, encaissé 47 908.
  assert.deepEqual(receiptBreakdown([{ cost: 25000 }, { cost: 15600 }], 47908), { subtotal: 40600, vat: 7308, total: 47908 });
  assert.deepEqual(receiptBreakdown([{ cost: 25000 }], 25000), { subtotal: 25000, vat: 0, total: 25000 });
  assert.deepEqual(receiptBreakdown([{ cost: '25000' as unknown as number }], '29500' as unknown as number), { subtotal: 25000, vat: 4500, total: 29500 });
});

test('sans lignes exploitables, la réimpression n\'invente aucun détail', () => {
  assert.equal(receiptBreakdown([], 47908), null);
  assert.equal(receiptBreakdown([{}], 47908), null);
  assert.equal(receiptBreakdown([{ cost: 50000 }], 40000), null);
});

test('le libellé de TVA ne cite le taux que s\'il correspond au montant', () => {
  assert.equal(vatLabel(40600, 7308), 'TVA (18 %)');
  assert.equal(vatLabel(40600, 5000), 'TVA');
});

test('les modes de paiement s\'affichent en français', () => {
  assert.equal(paymentMethodLabel('cash'), 'Espèces');
  assert.equal(paymentMethodLabel('wave'), 'Wave');
  assert.equal(paymentMethodLabel('orange_money'), 'Orange Money');
  assert.equal(paymentMethodLabel('mtn_momo'), 'MTN Mobile Money');
  assert.equal(paymentMethodLabel('inconnu'), 'inconnu');
  assert.equal(paymentMethodLabel(null), '');
});
