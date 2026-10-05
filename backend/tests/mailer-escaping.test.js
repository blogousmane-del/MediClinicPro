// Les e-mails reprennent des textes saisis par des inconnus : nom de clinique et
// nom du responsable à l'inscription (ouverte, sans vérification d'adresse),
// sujet d'un ticket. Non échappés, ils permettaient de faire envoyer par
// MediClinic, depuis son domaine, un lien piégé à n'importe quelle adresse
// (audit du 2026-10-05).
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { BACKEND } = require('./helpers/harness');

const { escapeHtml } = require(path.join(BACKEND, 'utils', 'html.js'));
const mailer = require(path.join(BACKEND, 'utils', 'mailer.js'));

const PIEGE = '<a href="https://piege.example">Activez votre compte</a>';
const PIEGE_ECHAPPE = '&lt;a href=&quot;https://piege.example&quot;&gt;Activez votre compte&lt;/a&gt;';
const occurrences = (html, needle) => html.split(needle).length - 1;

test('escapeHtml neutralise les cinq caracteres actifs du HTML', () => {
  assert.strictEqual(escapeHtml(`<b class="x">'&`), '&lt;b class=&quot;x&quot;&gt;&#39;&amp;');
  assert.strictEqual(escapeHtml(null), '');
  assert.strictEqual(escapeHtml(undefined), '');
  assert.strictEqual(escapeHtml(9000), '9000');
});

test('bienvenue : nom du responsable et nom de clinique echappes', () => {
  const { html } = mailer.buildConfirmationEmail(PIEGE, PIEGE, 7);
  assert.ok(!html.includes('<a href="https://piege.example">'));
  assert.strictEqual(occurrences(html, PIEGE_ECHAPPE), 2);
});

test('bienvenue : le numero WhatsApp est celui du support', () => {
  const { html } = mailer.buildConfirmationEmail('Awa', 'Clinique A', 7);
  assert.ok(html.includes('+225 07 88 81 81 18'));
  assert.ok(!html.includes('07 07 07 07 07'));
});

test('rappel de renouvellement : nom de clinique echappe', () => {
  const { html } = mailer.buildRenewalReminderEmail('Awa', PIEGE, 3, 'Clinique', 9000);
  assert.ok(!html.includes('<a href="https://piege.example">'));
  assert.strictEqual(occurrences(html, PIEGE_ECHAPPE), 1);
});

test('ticket : sujet et note de resolution echappes', () => {
  const { html } = mailer.buildTicketStatusEmail('Awa', 'Clinique A', PIEGE, 'resolved', PIEGE);
  assert.ok(!html.includes('<a href="https://piege.example">'));
  assert.strictEqual(occurrences(html, PIEGE_ECHAPPE), 2);
});
