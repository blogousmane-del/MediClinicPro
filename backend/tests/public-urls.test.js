const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { BACKEND } = require('./helpers/harness');

const { getAppUrl, getApiPublicUrl } = require(path.join(BACKEND, 'utils', 'publicUrls.js'));

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

test('en production, une APP_URL absente vaut null et non localhost', () => {
  // Le repli silencieux sur localhost renvoyait un acheteur qui vient de payer
  // vers sa propre machine. null force l'appelant a refuser.
  withEnv({ APP_URL: '', VERCEL: '1', NODE_ENV: 'production' }, () => {
    assert.strictEqual(getAppUrl(), null);
  });
});

test('hors production, le repli localhost reste', () => {
  withEnv({ APP_URL: '', VERCEL: undefined, NODE_ENV: 'development' }, () => {
    assert.strictEqual(getAppUrl(), 'http://localhost:5173');
  });
});

test('la barre oblique finale est retiree', () => {
  // Sans ca, l'adresse de retour contiendrait un double slash.
  withEnv({ APP_URL: 'https://mediclinicpro.com///' }, () => {
    assert.strictEqual(getAppUrl(), 'https://mediclinicpro.com');
  });
});

test('une valeur faite d espaces equivaut a une absence', () => {
  withEnv({ APP_URL: '   ', VERCEL: '1' }, () => {
    assert.strictEqual(getAppUrl(), null);
  });
});

test('API_PUBLIC_URL n a jamais de repli', () => {
  // Inventer une adresse de rappel enverrait les webhooks du fournisseur dans
  // le vide, sans que rien ne le signale.
  withEnv({ API_PUBLIC_URL: '' }, () => assert.strictEqual(getApiPublicUrl(), null));
  withEnv({ API_PUBLIC_URL: 'https://api.test/' }, () => assert.strictEqual(getApiPublicUrl(), 'https://api.test'));
});
