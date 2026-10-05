// Lancé par `npm test` (node --test, retrait des types natif à Node 26).
import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, clinicHeaderHtml, buildPrintDocument } from './print.ts';

test('escapeHtml neutralise les cinq caractères actifs du HTML', () => {
  assert.equal(
    escapeHtml(`<img src=x onerror="alert('x')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;'
  );
});

test('escapeHtml accepte null, undefined et les nombres', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(15000), '15000');
});

test("l'en-tête porte la clinique connectée, échappée", () => {
  const html = clinicHeaderHtml({ name: 'Cabinet <b>Les Palmiers</b>', address: 'Cocody', phone: '+225 01' }, 'Reçu FAC-2026-00042');
  assert.ok(html.includes('CABINET &lt;B&gt;LES PALMIERS&lt;/B&gt;'));
  assert.ok(html.includes('Cocody · +225 01'));
  assert.ok(html.includes('Reçu FAC-2026-00042'));
  assert.ok(!html.includes("L'AVENIR"));
});

test("le sous-titre est échappé : d'anciennes références ont été saisies côté client", () => {
  const html = clinicHeaderHtml({ name: 'A' }, 'Reçu <script>x</script>');
  assert.ok(!html.includes('<script>'));
});

test("sans clinique, un en-tête neutre plutôt que celui d'une autre", () => {
  const html = clinicHeaderHtml(null, 'Ordonnance');
  assert.ok(html.includes('CLINIQUE'));
  assert.ok(!html.includes('clinic-meta'));
});

test('le titre du document est échappé', () => {
  const html = buildPrintDocument('<script>x</script>', '<p>corps</p>');
  assert.ok(!html.includes('<title><script>'));
  assert.ok(html.includes('<p>corps</p>'));
});
