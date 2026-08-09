// Contenu des emails : ces assertions portent sur ce que le client LIT, pas
// sur l'acheminement. Un lien mort ou une duree fausse ne fait echouer aucun
// envoi — l'email part, et c'est le destinataire qui decouvre le probleme.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { BACKEND } = require('./helpers/harness');

function withEnv(env, fn) {
  const saved = {};
  for (const [key, value] of Object.entries(env)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const mailerPath = path.join(BACKEND, 'utils', 'mailer.js');

// Le modele est interne au module : on passe par l'envoi en mode console, qui
// imprime le texte exact. Plus fidele qu'exporter le modele pour le test.
function renderConfirmation({ trialDays, env = {} }) {
  const logged = [];
  const originalLog = console.log;
  console.log = (...args) => logged.push(args.join(' '));
  try {
    return withEnv({ RESEND_API_KEY: '', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', ...env }, async () => {
      delete require.cache[require.resolve(mailerPath)];
      const { sendConfirmationEmail } = require(mailerPath);
      await sendConfirmationEmail('cliente@test.ci', 'Awa', 'Clinique A', trialDays);
      return logged.join('\n');
    });
  } finally {
    console.log = originalLog;
  }
}

test('la duree d essai annoncee est celle appliquee au compte', async () => {
  const out = await renderConfirmation({ trialDays: 14, env: { APP_URL: 'https://app.test' } });
  assert.match(out, /14 jours d'essai gratuit/);
  assert.doesNotMatch(out, /7 jours d'essai/, 'le 7 code en dur ne doit plus apparaitre');
});

test('un essai d un seul jour reste au singulier', async () => {
  const out = await renderConfirmation({ trialDays: 1, env: { APP_URL: 'https://app.test' } });
  assert.match(out, /1 jour d'essai gratuit/);
});

test('sans duree fournie, le repli reste 7 jours', async () => {
  const out = await renderConfirmation({ trialDays: undefined, env: { APP_URL: 'https://app.test' } });
  assert.match(out, /7 jours d'essai gratuit/);
});

test('le lien pointe sur APP_URL et jamais sur localhost en production', async () => {
  const out = await renderConfirmation({
    trialDays: 7,
    env: { APP_URL: '', VERCEL: '1', NODE_ENV: 'production' }
  });
  assert.doesNotMatch(out, /localhost/, 'un lien vers localhost se fait passer pour une destination valable');
});
