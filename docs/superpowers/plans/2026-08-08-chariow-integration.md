# Chariow Subscription Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Chariow the only way to pay a MediClinic subscription, credit it reliably through three idempotent paths, and switch patient payments and deposits back to cash only.

**Architecture:** A new `chariow.js` adapter talks to Chariow's hosted checkout. Its API key lives encrypted in the existing `platform_settings` table, edited from Platform Admin. Crediting never trusts a webhook body: all three paths (browser return poll, webhook, daily cron) call one `reconcileChariowSubscription()` that re-pulls `GET /sales/{id}` and writes conditionally.

**Tech Stack:** Node 18+ / Express / Supabase REST, `node:crypto` (AES-256-GCM, no new dependency), `libphonenumber-js` (already a backend dependency), React 19 + TypeScript, `node --test`.

**Source spec:** `docs/superpowers/specs/2026-08-08-chariow-integration-design.md`

**Already shipped, not part of this plan:** the spec's commercial-copy section
landed ahead of the code, in commits `c062fdc` (the Hôpital tier stopped
advertising patient Mobile Money) and `6e86779` (the phantom 15 000 FCFA price
removed, landing page reads its catalogue from the API). Do not redo them.

## Global Constraints

- **Never trust a webhook body.** A webhook supplies at most a sale id. Status and amount always come from `GET /sales/{id}`.
- **XOF only.** Any Chariow amount whose currency is not `XOF` is rejected, at config time and at checkout time.
- **`paid_at` is the provider's date** (`settled_at`/`paid_at`), falling back to the row's `created_at`. Never `new Date()`.
- **No secret is ever returned by `GET /api/platform/config`** — only `'set'` / `'blank'`. A test enforces this.
- **Status mapping order is fixed:** `unpaid` → pending first, then failures/cancellations, then successes. `unpaid` contains `paid`.
- **French user-facing strings.** Errors, labels and messages match the existing app.
- **No new npm dependency.** Platform Admin ships in the bundle every clinic downloads.
- **Prices come from `backend/utils/plans.js`.** Never hardcode a price or a limit elsewhere.
- **No DDL in this plan.** The design deliberately needs no migration; `platform_settings` already exists in production.
- Test command, run from `backend/`: `npm test` (Node's built-in runner over `backend/tests/**/*.test.js`).

---

## File Structure

**Create**
- `backend/utils/secretBox.js` — AES-256-GCM encrypt/decrypt of a single string.
- `backend/services/payments/chariow.js` — Chariow HTTP adapter, status mapping, phone resolution.
- `backend/services/payments/chariowReconcile.js` — the only function that credits a subscription.
- `backend/tests/secret-box.test.js`, `backend/tests/chariow-adapter.test.js`, `backend/tests/chariow-reconcile.test.js`, `backend/tests/chariow-webhook.test.js`, `backend/tests/chariow-checkout.test.js`, `backend/tests/cash-only.test.js`
- `frontend/src/pages/PlatformAdmin/sections/ChariowConfigSection.tsx` — the Chariow tab of Config. système.

**Modify**
- `backend/utils/platformSettings.js` — four new keys, two of them secret.
- `backend/routes/platform-config.js` — read/write the Chariow block.
- `backend/routes/webhooks.js` — extract the credit helper, add the Chariow route.
- `backend/routes/financials.js` — Chariow-only subscription checkout, new verify route, cash-only patient payments.
- `backend/routes/deposits.js` — cash only.
- `backend/routes/cron.js` + `vercel.json` — daily reconciliation.
- `backend/middleware/auth.js` — allowlist the verify route.
- `backend/tests/helpers/harness.js` — the fake query builder needs `.in()`.
- `frontend/src/pages/Settings/SettingsPage.tsx`, `frontend/src/pages/PlatformAdmin/sections/SystemConfigSection.tsx`, `frontend/src/pages/Accounting/AccountingPage.tsx`, `frontend/src/pages/Deposits/DepositsPage.tsx`.

---

### Task 1: Encrypted secret storage

**Files:**
- Create: `backend/utils/secretBox.js`
- Test: `backend/tests/secret-box.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `isEncryptionConfigured(): boolean`, `encrypt(plaintext: string): string` (throws `Error` when the key is missing/invalid), `decrypt(stored: string): string | null` (returns `null` on any failure, never throws).

- [ ] **Step 1: Write the failing test**

`backend/tests/secret-box.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const KEY = 'a'.repeat(64); // 32 octets en hexadécimal
const MODULE = path.join(__dirname, '..', 'utils', 'secretBox.js');

function freshModule(key) {
  delete require.cache[require.resolve(MODULE)];
  if (key === null) delete process.env.CONFIG_ENCRYPTION_KEY;
  else process.env.CONFIG_ENCRYPTION_KEY = key;
  return require(MODULE);
}

test('un secret chiffré se relit à l identique', () => {
  const box = freshModule(KEY);
  const stored = box.encrypt('cle-api-chariow-123');
  assert.notStrictEqual(stored, 'cle-api-chariow-123', 'la valeur stockée ne doit pas être en clair');
  assert.ok(stored.startsWith('v1:'), 'le format stocké doit être versionné');
  assert.strictEqual(box.decrypt(stored), 'cle-api-chariow-123');
});

test('deux chiffrements du même secret diffèrent (IV aléatoire)', () => {
  const box = freshModule(KEY);
  assert.notStrictEqual(box.encrypt('meme-secret'), box.encrypt('meme-secret'));
});

test('un secret altéré ne se déchiffre pas et ne lève pas', () => {
  const box = freshModule(KEY);
  const stored = box.encrypt('cle-api-chariow-123');
  const tampered = stored.slice(0, -4) + 'AAAA';
  assert.strictEqual(box.decrypt(tampered), null);
});

test('sans CONFIG_ENCRYPTION_KEY : pas de chiffrement, et jamais de stockage en clair', () => {
  const box = freshModule(null);
  assert.strictEqual(box.isEncryptionConfigured(), false);
  assert.throws(() => box.encrypt('secret'), /CONFIG_ENCRYPTION_KEY/);
  assert.strictEqual(box.decrypt('v1:x:y:z'), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/secret-box.test.js`
Expected: FAIL — `Cannot find module '.../utils/secretBox.js'`

- [ ] **Step 3: Write the implementation**

`backend/utils/secretBox.js`:

```js
// Chiffrement symétrique d'un secret unique, pour les valeurs de
// platform_settings que l'exploitant saisit depuis la console (clé API
// Chariow, secret de webhook). AES-256-GCM via node:crypto — pas de
// dépendance ajoutée, et GCM authentifie : un enregistrement altéré échoue au
// déchiffrement au lieu de rendre des octets faux.
//
// La clé maîtresse reste une variable d'environnement : on déplace le secret
// applicatif vers la base, on ne supprime pas le besoin d'un secret racine.
const crypto = require('node:crypto');

const FORMAT_VERSION = 'v1';
const IV_BYTES = 12; // taille recommandée pour GCM

function readKey() {
  const raw = String(process.env.CONFIG_ENCRYPTION_KEY || '').trim();
  // Format strict : 64 caractères hexadécimaux = 32 octets. Une phrase de
  // passe courte serait acceptée silencieusement par Buffer.from(..., 'hex')
  // en produisant une clé tronquée, donc faible.
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) return null;
  return Buffer.from(raw, 'hex');
}

function isEncryptionConfigured() {
  return readKey() !== null;
}

function encrypt(plaintext) {
  const key = readKey();
  if (!key) {
    throw new Error('CONFIG_ENCRYPTION_KEY absente ou invalide (64 caractères hexadécimaux attendus).');
  }
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

// Ne lève jamais : une clé changée, un enregistrement corrompu ou un format
// inattendu doivent dégrader l'écran de configuration, pas casser une requête.
function decrypt(stored) {
  const key = readKey();
  if (!key || typeof stored !== 'string') return null;

  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) return null;

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'base64'));
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { isEncryptionConfigured, encrypt, decrypt };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx node --test tests/secret-box.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add backend/utils/secretBox.js backend/tests/secret-box.test.js
git commit -m "feat(config): add AES-256-GCM storage for settings secrets"
```

---

### Task 2: Chariow settings in `platform_settings`

**Files:**
- Modify: `backend/utils/platformSettings.js`
- Test: `backend/tests/platform-settings.test.js` (append)

**Interfaces:**
- Consumes: `secretBox.encrypt/decrypt/isEncryptionConfigured` (Task 1).
- Produces:
  - `DEFAULTS` gains `chariow_products` (`''`) and `chariow_api_url` (`'https://api.chariow.com/v1'`).
  - `SECRET_KEYS = ['chariow_api_key', 'chariow_webhook_secret']`.
  - `getSettings()` — unchanged shape, plus `chariowProducts` parsed; secrets absent.
  - `getSecret(key: string): Promise<string|null>` — decrypted value, `null` if unset/undecryptable.
  - `setSecret(key: string, value: string, userId: number): Promise<{ok: true} | {ok: false, tableMissing: boolean, error: string}>`.
  - `hasSecret(key: string): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/platform-settings.test.js`:

```js
test('un secret est stocké chiffré et jamais rendu par getSettings', async () => {
  process.env.CONFIG_ENCRYPTION_KEY = 'b'.repeat(64);
  resetDb();
  const settings = require(path.join(BACKEND, 'utils', 'platformSettings.js'));

  const written = await settings.setSecret('chariow_api_key', 'sk_live_secret_value', 1);
  assert.strictEqual(written.ok, true);

  const row = db.platform_settings.find((r) => r.key === 'chariow_api_key');
  assert.ok(row, 'la ligne doit exister');
  assert.ok(!row.value.includes('sk_live_secret_value'), 'la valeur ne doit pas être stockée en clair');

  assert.strictEqual(await settings.getSecret('chariow_api_key'), 'sk_live_secret_value');
  assert.strictEqual(await settings.hasSecret('chariow_api_key'), true);

  const read = await settings.getSettings();
  assert.strictEqual(JSON.stringify(read.values).includes('sk_live_secret_value'), false);
  assert.strictEqual(read.values.chariow_api_key, undefined, 'aucun secret dans les réglages lisibles');
});

test('un réglage inconnu est refusé', async () => {
  resetDb();
  const settings = require(path.join(BACKEND, 'utils', 'platformSettings.js'));
  const result = await settings.setSecret('mot_de_passe_admin', 'x', 1);
  assert.strictEqual(result.ok, false);
});
```

If `platform-settings.test.js` does not already import `db`, `resetDb` and `BACKEND` from the harness, add at the top:

```js
const { db, resetDb, BACKEND } = require('./helpers/harness');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/platform-settings.test.js`
Expected: FAIL — `settings.setSecret is not a function`

- [ ] **Step 3: Write the implementation**

In `backend/utils/platformSettings.js`, add the require at the top:

```js
const secretBox = require('./secretBox');
```

Extend `DEFAULTS`:

```js
const DEFAULTS = {
  starter_trial_days: 7,
  maintenance_message: '',
  // Correspondance <plan>_<mois> -> identifiant de produit Chariow, en JSON.
  // Vide tant que l'exploitant n'a rien configuré ; le checkout renvoie alors
  // une erreur nommant la combinaison manquante.
  chariow_products: '',
  chariow_api_url: 'https://api.chariow.com/v1'
};

// Clés dont la valeur est chiffrée en base et n'apparaît JAMAIS dans
// getSettings() — donc jamais dans la réponse de GET /api/platform/config.
const SECRET_KEYS = ['chariow_api_key', 'chariow_webhook_secret'];
```

Add, before `module.exports`:

```js
async function readRaw(key) {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (isMissingRelation(error) || error) return null;
  return data ? data.value : null;
}

/** Valeur déchiffrée d'un secret, ou null s'il est absent ou illisible. */
async function getSecret(key) {
  if (!SECRET_KEYS.includes(key)) return null;
  const stored = await readRaw(key);
  if (!stored) return null;
  return secretBox.decrypt(stored);
}

/** Vrai si un secret est enregistré, sans jamais révéler sa valeur. */
async function hasSecret(key) {
  if (!SECRET_KEYS.includes(key)) return false;
  return !!(await readRaw(key));
}

async function setSecret(key, value, userId) {
  if (!SECRET_KEYS.includes(key)) {
    return { ok: false, tableMissing: false, error: `Secret inconnu : ${key}` };
  }
  if (!secretBox.isEncryptionConfigured()) {
    return {
      ok: false,
      tableMissing: false,
      error: "CONFIG_ENCRYPTION_KEY n'est pas configurée : impossible d'enregistrer un secret sans le chiffrer."
    };
  }
  return writeSetting(key, secretBox.encrypt(String(value)), userId);
}
```

Rename the body of the existing `setSetting` to a shared `writeSetting(key, value, userId)` that performs the read-then-insert-or-update without the `DEFAULTS` whitelist check, and keep `setSetting` as the public non-secret entry point:

```js
async function setSetting(key, value, userId) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    return { ok: false, tableMissing: false, error: `Réglage inconnu : ${key}` };
  }
  return writeSetting(key, String(value), userId);
}
```

Export the new functions:

```js
module.exports = { DEFAULTS, SECRET_KEYS, isMissingRelation, getSettings, setSetting, getSecret, setSecret, hasSecret };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx node --test tests/platform-settings.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/utils/platformSettings.js backend/tests/platform-settings.test.js
git commit -m "feat(config): store the Chariow credentials encrypted in platform_settings"
```

---

### Task 3: The Chariow adapter

**Files:**
- Create: `backend/services/payments/chariow.js`
- Test: `backend/tests/chariow-adapter.test.js`

**Interfaces:**
- Consumes: `platformSettings.getSettings/getSecret` (Task 2).
- Produces:
  - `mapChariowStatus(raw: string): 'succeeded'|'failed'|'abandoned'|'pending'`
  - `resolveChariowPhone({phone, phoneCountry, phoneLocal}): {number, country_code} | null`
  - `loadConfig(): Promise<{apiKey: string|null, apiUrl: string, products: object}>` (60 s memory cache)
  - `clearConfigCache(): void` (tests and the config route call it after a write)
  - `productIdFor(products: object, planId: string, months: number): string | null`
  - `isConfigured(): Promise<boolean>`
  - `createCheckout({productId, email, firstName, lastName, phone, redirectUrl, metadata}): Promise<{ok:true, saleId, checkoutUrl, amount:{value, currency}} | {ok:false, error}>`
  - `getSale(saleId): Promise<{ok:true, status, amount:{value,currency}, settledAt: string|null} | {ok:false, error}>`
  - `listProducts(): Promise<{ok:true, products: {id, name, price, currency}[]} | {ok:false, error}>`

- [ ] **Step 1: Write the failing test**

`backend/tests/chariow-adapter.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { BACKEND } = require('./helpers/harness');

const chariow = require(path.join(BACKEND, 'services', 'payments', 'chariow.js'));

test('unpaid est en attente, pas payé', () => {
  // « unpaid » contient « paid » : tester les succès en premier créditerait
  // une vente non payée.
  assert.strictEqual(chariow.mapChariowStatus('unpaid'), 'pending');
  assert.strictEqual(chariow.mapChariowStatus('UNPAID'), 'pending');
});

test('settled vaut payé', () => {
  assert.strictEqual(chariow.mapChariowStatus('settled'), 'succeeded');
  assert.strictEqual(chariow.mapChariowStatus('completed'), 'succeeded');
  assert.strictEqual(chariow.mapChariowStatus('paid'), 'succeeded');
  assert.strictEqual(chariow.mapChariowStatus('success'), 'succeeded');
});

test('les échecs et annulations sont distingués', () => {
  assert.strictEqual(chariow.mapChariowStatus('failed'), 'failed');
  assert.strictEqual(chariow.mapChariowStatus('error'), 'failed');
  assert.strictEqual(chariow.mapChariowStatus('cancelled'), 'abandoned');
  assert.strictEqual(chariow.mapChariowStatus('refunded'), 'abandoned');
  assert.strictEqual(chariow.mapChariowStatus('quelque_chose'), 'pending');
  assert.strictEqual(chariow.mapChariowStatus(undefined), 'pending');
});

test('le téléphone part en national + ISO2, jamais en E.164', () => {
  const fromParts = chariow.resolveChariowPhone({ phoneCountry: 'CI', phoneLocal: '0700000000' });
  assert.strictEqual(fromParts.country_code, 'CI');
  assert.strictEqual(fromParts.number.startsWith('+'), false);

  const fromE164 = chariow.resolveChariowPhone({ phone: '+221771234567' });
  assert.strictEqual(fromE164.country_code, 'SN');
  assert.strictEqual(fromE164.number, '771234567');

  assert.strictEqual(chariow.resolveChariowPhone({}), null);
});

test('la correspondance produit se fait sur plan et durée', () => {
  const products = { hopital_12: 'prod_h12', clinique_1: 'prod_c1' };
  assert.strictEqual(chariow.productIdFor(products, 'hopital', 12), 'prod_h12');
  assert.strictEqual(chariow.productIdFor(products, 'clinique', 1), 'prod_c1');
  assert.strictEqual(chariow.productIdFor(products, 'hopital', 3), null);
  assert.strictEqual(chariow.productIdFor(null, 'hopital', 12), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/chariow-adapter.test.js`
Expected: FAIL — `Cannot find module '.../services/payments/chariow.js'`

- [ ] **Step 3: Write the implementation**

`backend/services/payments/chariow.js`:

```js
// Adaptateur Chariow — checkout hébergé Mobile Money + carte, utilisé
// uniquement pour l'abonnement MediClinic (jamais les paiements patients ni
// les dépôts : Chariow débite le prix de SON produit et n'accepte aucun
// montant libre).
//
// Contrairement à bictorys.js/paytech.js/paypal.js, la configuration ne vient
// pas de l'environnement mais de platform_settings, saisie depuis Platform
// Admin. isConfigured() est donc ASYNCHRONE ici.
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { getSettings, getSecret } = require('../../utils/platformSettings');

const FETCH_TIMEOUT_MS = 15_000;
const CONFIG_CACHE_MS = 60_000;

let cachedConfig = null; // { value, expiresAt }

function clearConfigCache() {
  cachedConfig = null;
}

/**
 * Normalise un statut Chariow.
 * L'ORDRE DES TESTS EST CRITIQUE : « unpaid » contient « paid ». Tester les
 * succès en premier créditerait une vente non payée.
 */
function mapChariowStatus(raw) {
  const status = String(raw || '').toLowerCase();
  if (!status) return 'pending';
  if (status.includes('unpaid')) return 'pending';
  if (status.includes('fail') || status.includes('error')) return 'failed';
  if (status.includes('cancel') || status.includes('abandon') || status.includes('refund')) return 'abandoned';
  if (status.includes('settle') || status.includes('complete') || status.includes('paid') || status.includes('success')) {
    return 'succeeded';
  }
  return 'pending';
}

/**
 * Chariow exige { number: <national sans indicatif ni 0>, country_code: ISO2 }.
 * Un E.164 brut provoque un 400 « Invalid phone number ».
 */
function resolveChariowPhone({ phone, phoneCountry, phoneLocal } = {}) {
  const iso2 = phoneCountry ? String(phoneCountry).trim().toUpperCase() : null;

  if (iso2 && phoneLocal) {
    const parsed = parsePhoneNumberFromString(String(phoneLocal), iso2);
    if (parsed && parsed.isValid()) return { number: parsed.nationalNumber, country_code: parsed.country || iso2 };
  }

  if (phone) {
    const parsed = parsePhoneNumberFromString(String(phone));
    if (parsed && parsed.isValid() && parsed.country) {
      return { number: parsed.nationalNumber, country_code: parsed.country };
    }
  }

  // Dernier repli : ISO2 connu + chiffres bruts, sans validation stricte. Un
  // numéro valide localement mais mal reconnu par la librairie vaut mieux
  // qu'un checkout refusé.
  if (iso2 && (phoneLocal || phone)) {
    const digits = String(phoneLocal || phone).replace(/\D/g, '').replace(/^0+/, '');
    if (digits) return { number: digits, country_code: iso2 };
  }

  return null;
}

function parseProducts(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    console.error('[CHARIOW] chariow_products illisible (JSON invalide) — aucun produit disponible.');
    return {};
  }
}

function productIdFor(products, planId, months) {
  if (!products || typeof products !== 'object') return null;
  const id = products[`${planId}_${months}`];
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

async function loadConfig() {
  if (cachedConfig && cachedConfig.expiresAt > Date.now()) return cachedConfig.value;

  const { values } = await getSettings();
  const value = {
    apiKey: await getSecret('chariow_api_key'),
    apiUrl: String(values.chariow_api_url || 'https://api.chariow.com/v1').replace(/\/+$/, ''),
    products: parseProducts(values.chariow_products)
  };

  cachedConfig = { value, expiresAt: Date.now() + CONFIG_CACHE_MS };
  return value;
}

async function isConfigured() {
  const config = await loadConfig();
  return !!config.apiKey;
}

async function chariowFetch(pathname, init, apiKey, apiUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${apiUrl}${pathname}`, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', ...(init && init.headers) }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function callChariow(pathname, init) {
  const config = await loadConfig();
  if (!config.apiKey) return { ok: false, error: "La clé API Chariow n'est pas configurée." };

  let res;
  try {
    res = await chariowFetch(pathname, init, config.apiKey, config.apiUrl);
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers Chariow : ${err.message}` };
  }

  let body;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: `Chariow a répondu ${res.status} (réponse non JSON).` };
  }

  if (!res.ok) {
    return { ok: false, error: `Chariow a refusé la requête (${res.status}) : ${body.message || 'raison inconnue'}` };
  }
  return { ok: true, data: body.data || body };
}

async function createCheckout({ productId, email, firstName, lastName, phone, redirectUrl, metadata }) {
  const payload = {
    product_id: productId,
    email,
    first_name: firstName,
    last_name: lastName,
    redirect_url: redirectUrl,
    custom_metadata: metadata || {}
  };
  if (phone) payload.phone = phone;

  const call = await callChariow('/checkout', { method: 'POST', body: JSON.stringify(payload) });
  if (!call.ok) return call;

  const purchase = call.data.purchase;
  const checkoutUrl = call.data.payment && call.data.payment.checkout_url;
  if (!purchase || !purchase.id || !checkoutUrl) {
    // Jamais de redirection en dur sur une réponse incomplète.
    return { ok: false, error: 'Chariow: réponse de checkout incomplète (identifiant ou URL manquant).' };
  }

  return {
    ok: true,
    saleId: String(purchase.id),
    checkoutUrl,
    amount: {
      value: Number(purchase.amount && purchase.amount.value),
      currency: String((purchase.amount && purchase.amount.currency) || '').toUpperCase()
    }
  };
}

async function getSale(saleId) {
  const call = await callChariow(`/sales/${encodeURIComponent(saleId)}`, { method: 'GET' });
  if (!call.ok) return call;

  const sale = call.data;
  return {
    ok: true,
    status: mapChariowStatus(sale.status),
    amount: {
      value: Number(sale.amount && sale.amount.value),
      currency: String((sale.amount && sale.amount.currency) || '').toUpperCase()
    },
    // Le nom du champ varie selon la version de l'API : on prend le premier
    // présent, et jamais l'heure courante en repli (voir chariowReconcile.js).
    settledAt: sale.settled_at || sale.paid_at || sale.completed_at || null
  };
}

async function listProducts() {
  const call = await callChariow('/products', { method: 'GET' });
  if (!call.ok) return call;
  const rows = Array.isArray(call.data) ? call.data : call.data.products || [];
  return {
    ok: true,
    products: rows.map((p) => ({
      id: String(p.id),
      name: p.name || '',
      price: Number(p.price && p.price.value !== undefined ? p.price.value : p.price),
      currency: String((p.price && p.price.currency) || p.currency || '').toUpperCase()
    }))
  };
}

module.exports = {
  mapChariowStatus,
  resolveChariowPhone,
  productIdFor,
  loadConfig,
  clearConfigCache,
  isConfigured,
  createCheckout,
  getSale,
  listProducts
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx node --test tests/chariow-adapter.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add backend/services/payments/chariow.js backend/tests/chariow-adapter.test.js
git commit -m "feat(payments): add the Chariow hosted-checkout adapter"
```

---

### Task 4: Chariow block in the platform config API

**Files:**
- Modify: `backend/routes/platform-config.js`
- Test: `backend/tests/platform-config.test.js` (append)

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: `GET /api/platform/config` gains a `chariow` object `{apiKey: 'set'|'blank', webhookSecret: 'set'|'blank', apiUrl, products, encryptionConfigured}`. `PUT /api/platform/config` accepts `chariow_api_key`, `chariow_webhook_secret` (or `chariow_webhook_secret: '__generate__'`), `chariow_products`, `chariow_api_url`, and returns `webhookUrl` **once** when the secret was just written.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/platform-config.test.js`:

```js
test('la réponse de config annonce Chariow sans livrer le moindre secret', async () => {
  process.env.CONFIG_ENCRYPTION_KEY = 'c'.repeat(64);
  resetDb();
  const settings = require(path.join(BACKEND, 'utils', 'platformSettings.js'));
  await settings.setSecret('chariow_api_key', 'sk_live_TOP_SECRET', 1);

  const res = await fetch(`${baseUrl}/api/platform/config`);
  const raw = await res.text();

  assert.strictEqual(res.status, 200);
  assert.strictEqual(raw.includes('sk_live_TOP_SECRET'), false, 'aucun secret ne doit sortir');
  const body = JSON.parse(raw);
  assert.strictEqual(body.chariow.apiKey, 'set');
  assert.strictEqual(body.chariow.webhookSecret, 'blank');
});

test('la correspondance produits refuse une clé hors des 8 combinaisons', async () => {
  resetDb();
  const res = await fetch(`${baseUrl}/api/platform/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chariow_products: { hopital_7: 'prod_x' } })
  });
  assert.strictEqual(res.status, 400);
  const body = await res.json();
  assert.match(body.error, /hopital_7/);
});

test('générer le secret de webhook renvoie l URL complète une seule fois', async () => {
  process.env.CONFIG_ENCRYPTION_KEY = 'c'.repeat(64);
  process.env.API_PUBLIC_URL = 'https://api.test.ci';
  resetDb();

  const put = await fetch(`${baseUrl}/api/platform/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chariow_webhook_secret: '__generate__' })
  });
  const putBody = await put.json();
  assert.match(putBody.webhookUrl, /^https:\/\/api\.test\.ci\/api\/webhooks\/chariow\?secret=.+/);

  const get = await fetch(`${baseUrl}/api/platform/config`);
  const getRaw = await get.text();
  const secret = putBody.webhookUrl.split('secret=')[1];
  assert.strictEqual(getRaw.includes(secret), false, 'le GET ne redonne jamais le secret');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/platform-config.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'apiKey')`

- [ ] **Step 3: Write the implementation**

In `backend/routes/platform-config.js`, add requires:

```js
const crypto = require('node:crypto');
const chariow = require('../services/payments/chariow');
const secretBox = require('../utils/secretBox');
const { getSettings, setSetting, setSecret, hasSecret } = require('../utils/platformSettings');
const { PLAN_IDS } = require('../utils/plans');
```

Add the allowed product keys near `MAINTENANCE_MESSAGE_MAX`:

```js
const CHARIOW_MONTHS = [1, 3, 6, 12];
// Les 8 combinaisons facturables. Starter est gratuit et ne passe jamais par
// un checkout, il n'a donc pas de produit Chariow.
const CHARIOW_PRODUCT_KEYS = PLAN_IDS
  .filter((id) => id !== 'starter')
  .flatMap((id) => CHARIOW_MONTHS.map((m) => `${id}_${m}`));
```

In the `GET /config` handler, add to the response object (after `settings`):

```js
      chariow: {
        apiKey: (await hasSecret('chariow_api_key')) ? 'set' : 'blank',
        webhookSecret: (await hasSecret('chariow_webhook_secret')) ? 'set' : 'blank',
        apiUrl: settings.values.chariow_api_url,
        // Les identifiants de produit ne sont pas des secrets : ils sont
        // visibles dans la boutique Chariow de l'exploitant.
        products: (() => { try { return JSON.parse(settings.values.chariow_products || '{}'); } catch { return {}; } })(),
        expectedProductKeys: CHARIOW_PRODUCT_KEYS,
        encryptionConfigured: secretBox.isEncryptionConfigured()
      }
```

In the `PUT /config` handler, before the `updates.length === 0` check, insert:

```js
    let webhookUrl; // renvoyé UNE SEULE FOIS, à la génération du secret

    if (req.body.chariow_api_url !== undefined) {
      const url = String(req.body.chariow_api_url).trim();
      if (!/^https:\/\/.+/.test(url)) {
        return res.status(400).json({ error: "L'URL de l'API Chariow doit commencer par https://." });
      }
      updates.push(['chariow_api_url', url]);
    }

    if (req.body.chariow_products !== undefined) {
      const products = req.body.chariow_products;
      if (!products || typeof products !== 'object' || Array.isArray(products)) {
        return res.status(400).json({ error: 'La correspondance des produits doit être un objet.' });
      }
      for (const [key, value] of Object.entries(products)) {
        if (!CHARIOW_PRODUCT_KEYS.includes(key)) {
          return res.status(400).json({ error: `Combinaison plan/durée inconnue : ${key}. Attendu parmi ${CHARIOW_PRODUCT_KEYS.join(', ')}.` });
        }
        if (typeof value !== 'string' || !value.trim()) {
          return res.status(400).json({ error: `Identifiant de produit vide pour ${key}.` });
        }
      }
      updates.push(['chariow_products', JSON.stringify(products)]);
    }
```

Then, after the loop that writes `updates`, add the secret handling:

```js
    if (req.body.chariow_api_key !== undefined) {
      const apiKey = String(req.body.chariow_api_key).trim();
      if (!apiKey) return res.status(400).json({ error: 'La clé API Chariow est vide.' });

      const written = await setSecret('chariow_api_key', apiKey, req.user.userId);
      if (!written.ok) {
        return res.status(written.tableMissing ? 503 : 400).json({ error: written.error });
      }
      chariow.clearConfigCache();

      // Validation en conditions réelles : une clé fausse doit être rejetée
      // maintenant, pas au premier client qui tente de payer. Le même appel
      // vérifie que la boutique est bien en XOF.
      const probe = await chariow.listProducts();
      if (!probe.ok) {
        return res.status(400).json({ error: `Clé enregistrée mais refusée par Chariow : ${probe.error}` });
      }
      const foreign = probe.products.find((p) => p.currency && p.currency !== 'XOF');
      if (foreign) {
        return res.status(400).json({
          error: `La boutique Chariow règle en ${foreign.currency}. Cette intégration n'accepte que le XOF : MediClinic facture en FCFA et ne peut pas vérifier un montant dans une autre devise.`
        });
      }

      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PLATFORM_CONFIG_UPDATE',
        // Jamais la valeur, même tronquée.
        details: 'Clé API Chariow mise à jour'
      });
    }

    if (req.body.chariow_webhook_secret !== undefined) {
      const requested = String(req.body.chariow_webhook_secret);
      const secret = requested === '__generate__' ? crypto.randomBytes(24).toString('hex') : requested.trim();
      if (secret.length < 16) {
        return res.status(400).json({ error: 'Le secret de webhook doit faire au moins 16 caractères.' });
      }

      const written = await setSecret('chariow_webhook_secret', secret, req.user.userId);
      if (!written.ok) {
        return res.status(written.tableMissing ? 503 : 400).json({ error: written.error });
      }
      chariow.clearConfigCache();

      // Seule occasion où le secret sort de ce serveur : l'exploitant doit
      // coller cette URL dans Chariow. GET /config ne la redonnera jamais.
      const base = (process.env.API_PUBLIC_URL || '').replace(/\/+$/, '');
      webhookUrl = `${base}/api/webhooks/chariow?secret=${encodeURIComponent(secret)}`;

      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PLATFORM_CONFIG_UPDATE',
        details: 'Secret de webhook Chariow régénéré'
      });
    }
```

Change the `updates.length === 0` guard so a secret-only request is valid:

```js
    if (updates.length === 0 && req.body.chariow_api_key === undefined && req.body.chariow_webhook_secret === undefined) {
      return res.status(400).json({ error: 'Aucun réglage modifiable fourni.' });
    }
```

And the final response:

```js
    const refreshed = await getSettings();
    chariow.clearConfigCache();
    res.json({ success: true, values: refreshed.values, ...(webhookUrl ? { webhookUrl } : {}) });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx node --test tests/platform-config.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/platform-config.js backend/tests/platform-config.test.js
git commit -m "feat(platform): configure Chariow from the system config console"
```

---

### Task 5: Extract the subscription-crediting helper

**Files:**
- Modify: `backend/routes/webhooks.js:67-114`

**Interfaces:**
- Produces: `creditSubscription(row, { provider, paidAt })` exported from `webhooks.js` — extends the clinic's expiry, switches its plan, writes the activity log. `paidAt` is an ISO string.
- Behaviour for Bictorys/PayTech/PayPal must be unchanged: `fulfillSubscriptionEvent` keeps passing `new Date().toISOString()`.

- [ ] **Step 1: Run the existing tests to capture the baseline**

Run: `cd backend && npm test`
Expected: PASS, 63 tests. Note the number — it must not drop.

- [ ] **Step 2: Extract the helper**

In `backend/routes/webhooks.js`, replace the tail of `fulfillSubscriptionEvent` (everything from the `UPDATE ... status: 'paid'` call to the end of the function) with a call to a new shared function, and add that function above it:

```js
/**
 * Crédite un abonnement déjà vérifié : prolonge l'échéance, bascule le plan,
 * journalise. Ne décide RIEN — l'appelant a déjà prouvé le paiement.
 * @param {object} row - ligne subscription_payments déjà passée à 'paid'
 * @param {{provider: string, paidAt: string}} context
 */
async function creditSubscription(row, { provider, paidAt }) {
  const { data: clinic } = await supabase
    .from('clinics')
    .select('subscription_expires_at, subscription_status')
    .eq('id', row.clinic_id)
    .single();

  // L'échéance repart de la date d'expiration en cours si elle est future,
  // pour qu'un renouvellement anticipé n'efface pas les jours restants.
  let baseDate = new Date(paidAt);
  if (clinic?.subscription_status === 'active' && clinic.subscription_expires_at) {
    const currentExpiry = new Date(clinic.subscription_expires_at);
    if (currentExpiry > baseDate) baseDate = currentExpiry;
  }
  baseDate.setMonth(baseDate.getMonth() + row.months);

  await supabase
    .from('clinics')
    .update({ subscription_status: 'active', subscription_expires_at: baseDate.toISOString(), plan: row.plan || undefined })
    .eq('id', row.clinic_id);

  await supabase.from('activity_logs').insert({
    clinic_id: row.clinic_id,
    user_id: row.user_id,
    action: 'SUBSCRIPTION_RENEW',
    details: `Abonnement ${row.plan || ''} renouvelé pour ${row.months} mois (${row.amount} FCFA) via ${provider.toUpperCase()}`
  });
}
```

`fulfillSubscriptionEvent` then ends with:

```js
  const paidAt = new Date().toISOString();
  const { data: updated } = await supabase
    .from('subscription_payments')
    .update({ status: 'paid', paid_at: paidAt, provider })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (!updated) return; // already fulfilled by a concurrent/duplicate webhook

  await creditSubscription(row, { provider, paidAt });
}
```

Export it alongside the router at the bottom of the file:

```js
module.exports = router;
module.exports.creditSubscription = creditSubscription;
```

- [ ] **Step 3: Run the tests to prove nothing changed**

Run: `cd backend && npm test`
Expected: PASS, still 63 tests, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/webhooks.js
git commit -m "refactor(webhooks): extract creditSubscription so the paid date can be supplied"
```

---

### Task 6: The reconciliation core

**Files:**
- Create: `backend/services/payments/chariowReconcile.js`
- Modify: `backend/tests/helpers/harness.js` (add `.in()`)
- Test: `backend/tests/chariow-reconcile.test.js`

**Interfaces:**
- Consumes: `chariow.getSale` (Task 3), `creditSubscription` (Task 5).
- Produces: `reconcileChariowSubscription(subscriptionPaymentId: number): Promise<{status: 'paid'|'pending'|'failed'|'unknown', reason?: string}>`, `FAILED_RETRY_DAYS = 14`.

- [ ] **Step 1: Add `.in()` to the fake query builder**

In `backend/tests/helpers/harness.js`, inside `queryBuilder`, add next to `eq`:

```js
    in(column, values) { state.filters.push([column, values, 'in']); return builder; },
```

and change `rowMatches` to honour it:

```js
  const rowMatches = (row) => state.filters.every(([column, value, op]) => (
    op === 'in' ? value.includes(row[column]) : row[column] === value
  ));
```

- [ ] **Step 2: Write the failing test**

`backend/tests/chariow-reconcile.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });

let saleResponse = null;
stubModule('services/payments/chariow.js', {
  getSale: async () => saleResponse
});

const { reconcileChariowSubscription } = require(path.join(BACKEND, 'services', 'payments', 'chariowReconcile.js'));

function seedPending(overrides = {}) {
  db.clinics.push({ id: 1, name: 'Clinique A', subscription_status: 'active', subscription_expires_at: null });
  db.subscription_payments.push({
    id: 1, clinic_id: 1, user_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'chariow', provider_reference: 'sale_1', status: 'pending',
    created_at: '2026-08-01T10:00:00.000Z', paid_at: null,
    ...overrides
  });
}

test('une vente réglée crédite l abonnement à la date du fournisseur', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'paid');
  const row = db.subscription_payments[0];
  assert.strictEqual(row.status, 'paid');
  assert.strictEqual(row.paid_at, '2026-08-04T09:30:00.000Z', "paid_at doit être la date du fournisseur, jamais l'heure courante");
});

test('une vente non réglée ne touche à rien', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'pending', amount: { value: 14500, currency: 'XOF' }, settledAt: null };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'pending');
  assert.strictEqual(db.subscription_payments[0].status, 'pending');
});

test('un montant divergent ne crédite pas', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 5000, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'unknown');
  assert.strictEqual(db.subscription_payments[0].status, 'pending', 'la ligne reste en attente pour revue manuelle');
});

test('une devise non XOF ne crédite pas', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'USD' }, settledAt: '2026-08-04T09:30:00.000Z' };

  assert.strictEqual((await reconcileChariowSubscription(1)).status, 'unknown');
  assert.strictEqual(db.subscription_payments[0].status, 'pending');
});

test('sans date fournisseur, on retombe sur created_at et jamais sur maintenant', async () => {
  resetDb();
  seedPending();
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: null };

  await reconcileChariowSubscription(1);

  assert.strictEqual(db.subscription_payments[0].paid_at, '2026-08-01T10:00:00.000Z');
});

test('une ligne déjà payée n est pas recréditée', async () => {
  resetDb();
  seedPending({ status: 'paid', paid_at: '2026-08-02T00:00:00.000Z' });
  saleResponse = { ok: true, status: 'succeeded', amount: { value: 14500, currency: 'XOF' }, settledAt: '2026-08-04T09:30:00.000Z' };

  const result = await reconcileChariowSubscription(1);

  assert.strictEqual(result.status, 'paid');
  assert.strictEqual(db.subscription_payments[0].paid_at, '2026-08-02T00:00:00.000Z', 'la date de règlement ne doit pas bouger');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx node --test tests/chariow-reconcile.test.js`
Expected: FAIL — `Cannot find module '.../chariowReconcile.js'`

- [ ] **Step 4: Write the implementation**

`backend/services/payments/chariowReconcile.js`:

```js
// Cœur du crédit d'abonnement Chariow. Appelé par les TROIS chemins — retour
// navigateur, webhook, cron — et seul autorisé à passer une ligne à 'paid'.
//
// Principe non négociable : rien n'est cru sur parole. Même déclenchée par un
// webhook affirmant « payé », cette fonction redemande le statut à Chariow.
const { supabase } = require('../../database');
const chariow = require('./chariow');
const { creditSubscription } = require('../../routes/webhooks');

const FAILED_RETRY_DAYS = 14;
const AMOUNT_TOLERANCE = 0.02; // 2 %

/**
 * @param {number} subscriptionPaymentId
 * @returns {Promise<{status: 'paid'|'pending'|'failed'|'unknown', reason?: string}>}
 */
async function reconcileChariowSubscription(subscriptionPaymentId) {
  const { data: row, error } = await supabase
    .from('subscription_payments')
    .select('*')
    .eq('id', subscriptionPaymentId)
    .maybeSingle();

  if (error || !row) return { status: 'unknown', reason: 'introuvable' };
  if (row.provider !== 'chariow') return { status: 'unknown', reason: 'autre fournisseur' };
  if (row.status === 'paid') return { status: 'paid' };

  // Un échec reste rattrapable 14 jours : une vente réglée après l'expiration
  // de notre côté est un cas réel, documenté par Chariow.
  if (row.status === 'failed') {
    const age = Date.now() - new Date(row.created_at).getTime();
    if (age > FAILED_RETRY_DAYS * 24 * 3600 * 1000) return { status: 'failed', reason: 'hors fenêtre de rattrapage' };
  }

  if (!row.provider_reference) return { status: 'unknown', reason: 'aucune référence de vente' };

  const sale = await chariow.getSale(row.provider_reference);
  if (!sale.ok) {
    console.error(`[CHARIOW] Lecture de la vente ${row.provider_reference} impossible :`, sale.error);
    return { status: 'unknown', reason: 'fournisseur injoignable' };
  }

  if (sale.status === 'failed' || sale.status === 'abandoned') {
    await supabase
      .from('subscription_payments')
      .update({ status: 'failed' })
      .eq('id', row.id)
      .eq('status', 'pending');
    return { status: 'failed' };
  }

  if (sale.status !== 'succeeded') return { status: 'pending' };

  // Contrôle du montant AVANT tout crédit, et sur la valeur relue chez le
  // fournisseur — pas sur celle mémorisée au checkout.
  if (sale.amount.currency !== 'XOF') {
    console.error(`[CHARIOW] ANOMALIE devise sur la vente ${row.provider_reference} : ${sale.amount.currency} au lieu de XOF — NON crédité.`);
    return { status: 'unknown', reason: 'devise inattendue' };
  }
  if (!Number.isFinite(sale.amount.value) || Math.abs(sale.amount.value - row.amount) > row.amount * AMOUNT_TOLERANCE) {
    console.error(`[CHARIOW] ANOMALIE montant sur la vente ${row.provider_reference} : ${sale.amount.value} au lieu de ${row.amount} — NON crédité.`);
    return { status: 'unknown', reason: 'montant inattendu' };
  }

  // Date du fournisseur, sinon celle de création de la ligne. JAMAIS
  // new Date() : un rattrapage tardif daterait la recette du mauvais jour.
  const paidAt = sale.settledAt || row.created_at;

  const { data: updated } = await supabase
    .from('subscription_payments')
    .update({ status: 'paid', paid_at: paidAt })
    .eq('id', row.id)
    .in('status', ['pending', 'failed'])
    .select()
    .maybeSingle();

  // Écriture conditionnelle : un autre chemin a crédité entre-temps.
  if (!updated) return { status: 'paid' };

  await creditSubscription(row, { provider: 'chariow', paidAt });
  return { status: 'paid' };
}

module.exports = { reconcileChariowSubscription, FAILED_RETRY_DAYS };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx node --test tests/chariow-reconcile.test.js`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit**

```bash
git add backend/services/payments/chariowReconcile.js backend/tests/helpers/harness.js backend/tests/chariow-reconcile.test.js
git commit -m "feat(payments): add the Chariow reconciliation core"
```

---

### Task 7: The webhook route

**Files:**
- Modify: `backend/routes/webhooks.js`
- Test: `backend/tests/chariow-webhook.test.js`

**Interfaces:**
- Consumes: `reconcileChariowSubscription` (Task 6), `getSecret` (Task 2), `isDuplicateEvent` (existing in `webhooks.js`).
- Produces: `POST /api/webhooks/chariow?secret=…`.

- [ ] **Step 1: Write the failing test**

`backend/tests/chariow-webhook.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('utils/platformSettings.js', {
  getSettings: async () => ({ values: {}, tableMissing: false }),
  getSecret: async (key) => (key === 'chariow_webhook_secret' ? 'le-bon-secret' : null),
  setSecret: async () => ({ ok: true }),
  hasSecret: async () => true,
  setSetting: async () => ({ ok: true }),
  DEFAULTS: {},
  SECRET_KEYS: [],
  isMissingRelation: () => false
});

const reconciled = [];
stubModule('services/payments/chariowReconcile.js', {
  reconcileChariowSubscription: async (id) => { reconciled.push(id); return { status: 'paid' }; },
  FAILED_RETRY_DAYS: 14
});

const webhooksRouter = require(path.join(BACKEND, 'routes', 'webhooks.js'));

let baseUrl;
let close;
test.before(async () => { ({ baseUrl, close } = await startApp([['/api/webhooks', webhooksRouter]])); });
test.after(() => close());

const post = (query, body) => fetch(`${baseUrl}/api/webhooks/chariow${query}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

test('un secret faux est rejeté', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('?secret=mauvais', { event: 'settled.sale', data: { id: 'sale_1' } });
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(reconciled, [], 'aucune réconciliation ne doit être déclenchée');
});

test('un secret absent est rejeté', async () => {
  resetDb();
  const res = await post('', { event: 'settled.sale', data: { id: 'sale_1' } });
  assert.strictEqual(res.status, 401);
});

test('le corps ne sert qu à trouver la vente, jamais à créditer', async () => {
  resetDb();
  reconciled.length = 0;
  db.subscription_payments.push({ id: 42, provider: 'chariow', provider_reference: 'sale_1', status: 'pending' });

  // Corps hostile : statut et montant mensongers. Ils doivent être ignorés.
  const res = await post('?secret=le-bon-secret', {
    event: 'settled.sale',
    data: { id: 'sale_1', status: 'paid', amount: { value: 999999, currency: 'XOF' } }
  });

  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(reconciled, [42], 'la ligne est retrouvée par son identifiant de vente');
});

test('les métadonnées portent l identifiant quand elles sont présentes', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('?secret=le-bon-secret', {
    event: 'successful.sale',
    data: { id: 'sale_9', custom_metadata: { subscriptionPaymentId: 7 } }
  });
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(reconciled, [7]);
});

test('un événement inconnu répond 200 sans rien faire', async () => {
  resetDb();
  reconciled.length = 0;
  const res = await post('?secret=le-bon-secret', { event: 'product.viewed', data: { id: 'x' } });
  assert.strictEqual(res.status, 200, 'un 4xx/5xx provoquerait des rejeux inutiles');
  assert.deepStrictEqual(reconciled, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/chariow-webhook.test.js`
Expected: FAIL — the route 404s, so `res.status` is 404 rather than 401.

- [ ] **Step 3: Write the implementation**

In `backend/routes/webhooks.js`, add requires at the top:

```js
const { getSecret } = require('../utils/platformSettings');
```

Add the route after the PayTech route:

```js
// Chariow n'expose AUCUNE signature de webhook : l'authentification se réduit
// à un secret placé dans l'URL, comparé en temps constant. C'est faible, d'où
// la règle absolue ci-dessous.
const CHARIOW_SUCCESS_EVENTS = ['successful.sale', 'settled.sale', 'completed.sale'];

function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  // timingSafeEqual exige des longueurs égales : la comparaison de longueur
  // d'abord évite l'exception, et une longueur différente est de toute façon
  // un secret faux.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/chariow', async (req, res) => {
  try {
    const expected = await getSecret('chariow_webhook_secret');
    if (!expected || !secretMatches(req.query.secret, expected)) {
      console.error('[WEBHOOKS] Secret Chariow invalide ou absent.');
      return res.status(401).json({ error: 'Secret invalide.' });
    }

    const body = req.body || {};
    const eventName = String(body.event || body.type || '');
    if (!CHARIOW_SUCCESS_EVENTS.includes(eventName)) {
      // 200 volontaire : un code d'erreur ferait rejouer Chariow indéfiniment
      // sur un événement dont nous n'avons rien à faire.
      return res.json({ received: true, ignored: true });
    }

    const rawBody = req.rawBody;
    if (rawBody && (await isDuplicateEvent('chariow', rawBody))) {
      return res.json({ received: true, deduped: true });
    }

    // RÈGLE ABSOLUE : on ne lit du corps que de quoi identifier la ligne. Ni
    // le statut ni le montant annoncés ne sont pris en compte — la
    // réconciliation les redemande à Chariow.
    const data = body.data || {};
    const metadata = data.custom_metadata || {};
    let subscriptionPaymentId = parseInt(metadata.subscriptionPaymentId, 10);

    if (!Number.isInteger(subscriptionPaymentId)) {
      const saleId = data.id || data.sale_id;
      if (!saleId) return res.json({ received: true, ignored: true });

      const { data: row } = await supabase
        .from('subscription_payments')
        .select('id')
        .eq('provider', 'chariow')
        .eq('provider_reference', String(saleId))
        .maybeSingle();

      if (!row) {
        console.error('[WEBHOOKS] Vente Chariow inconnue de cette installation :', String(saleId));
        return res.json({ received: true, ignored: true });
      }
      subscriptionPaymentId = row.id;
    }

    // Require paresseux : chariowReconcile requiert ce module pour
    // creditSubscription, un require en tête de fichier créerait un cycle.
    const { reconcileChariowSubscription } = require('../services/payments/chariowReconcile');
    const result = await reconcileChariowSubscription(subscriptionPaymentId);

    res.json({ received: true, status: result.status });
  } catch (err) {
    console.error('[WEBHOOKS] Erreur webhook Chariow:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx node --test tests/chariow-webhook.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add backend/routes/webhooks.js backend/tests/chariow-webhook.test.js
git commit -m "feat(webhooks): receive Chariow events without trusting their body"
```

---

### Task 8: Chariow-only subscription checkout and the verify route

**Files:**
- Modify: `backend/routes/financials.js:302-482`, `backend/middleware/auth.js`
- Test: `backend/tests/chariow-checkout.test.js`

**Interfaces:**
- Consumes: Tasks 3 and 6.
- Produces: `POST /api/financials/subscription/checkout` body `{months, planId, phone, phoneCountry, phoneLocal}` → `{success, subscriptionPaymentId, checkoutUrl, provider: 'chariow'}`; `POST /api/financials/subscription/verify` body `{subscriptionPaymentId}` → `{status}`.

- [ ] **Step 1: Write the failing test**

`backend/tests/chariow-checkout.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'admin' }));

let checkoutResponse = null;
stubModule('services/payments/chariow.js', {
  isConfigured: async () => true,
  productIdFor: (products, plan, months) => (products || {})[`${plan}_${months}`] || null,
  loadConfig: async () => ({ apiKey: 'k', apiUrl: 'https://api.chariow.test/v1', products: { hopital_1: 'prod_h1' } }),
  createCheckout: async () => checkoutResponse,
  resolveChariowPhone: () => ({ number: '700000000', country_code: 'CI' }),
  clearConfigCache: () => {}
});
stubModule('services/payments/chariowReconcile.js', {
  reconcileChariowSubscription: async () => ({ status: 'paid' }),
  FAILED_RETRY_DAYS: 14
});

const financials = require(path.join(BACKEND, 'routes', 'financials.js'));

let baseUrl;
let close;
test.before(async () => { ({ baseUrl, close } = await startApp([['/api/financials', financials]])); });
test.after(() => close());

const checkout = (body) => fetch(`${baseUrl}/api/financials/subscription/checkout`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

function seedClinic() {
  db.clinics.push({ id: 1, name: 'Clinique A', plan: 'hopital' });
}

test('un checkout nominal enregistre la vente et renvoie l URL', async () => {
  resetDb();
  seedClinic();
  checkoutResponse = {
    ok: true, saleId: 'sale_1', checkoutUrl: 'https://pay.chariow.test/s/1',
    amount: { value: 14500, currency: 'XOF' }
  };

  const res = await checkout({ months: 1, planId: 'hopital', phone: '+2250700000000', phoneCountry: 'CI', phoneLocal: '0700000000' });
  const body = await res.json();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(body.provider, 'chariow');
  assert.strictEqual(body.checkoutUrl, 'https://pay.chariow.test/s/1');
  const row = db.subscription_payments[0];
  assert.strictEqual(row.provider_reference, 'sale_1');
  assert.strictEqual(row.status, 'pending');
});

test('un produit non configuré nomme la combinaison manquante', async () => {
  resetDb();
  seedClinic();
  const res = await checkout({ months: 6, planId: 'hopital' });
  const body = await res.json();

  assert.strictEqual(res.status, 502);
  assert.match(body.error, /hopital_6/);
});

test('un prix Chariow divergent fait échouer le checkout', async () => {
  resetDb();
  seedClinic();
  // Produit mal rattaché : 5 000 F pour ce qui doit coûter 14 500 F.
  checkoutResponse = {
    ok: true, saleId: 'sale_2', checkoutUrl: 'https://pay.chariow.test/s/2',
    amount: { value: 5000, currency: 'XOF' }
  };

  const res = await checkout({ months: 1, planId: 'hopital' });
  const body = await res.json();

  assert.strictEqual(res.status, 502);
  assert.match(body.error, /montant/i);
  assert.strictEqual(db.subscription_payments[0].status, 'failed');
});

test('une devise non XOF fait échouer le checkout', async () => {
  resetDb();
  seedClinic();
  checkoutResponse = {
    ok: true, saleId: 'sale_3', checkoutUrl: 'https://pay.chariow.test/s/3',
    amount: { value: 14500, currency: 'USD' }
  };

  const res = await checkout({ months: 1, planId: 'hopital' });
  assert.strictEqual(res.status, 502);
  assert.match((await res.json()).error, /XOF/);
});

test('le plan Starter ne passe jamais par un paiement', async () => {
  resetDb();
  seedClinic();
  const res = await checkout({ months: 1, planId: 'starter' });
  assert.strictEqual(res.status, 400);
});

test('verify refuse une ligne d une autre clinique', async () => {
  resetDb();
  db.subscription_payments.push({ id: 5, clinic_id: 99, provider: 'chariow', status: 'pending' });

  const res = await fetch(`${baseUrl}/api/financials/subscription/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscriptionPaymentId: 5 })
  });

  assert.strictEqual(res.status, 404);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/chariow-checkout.test.js`
Expected: FAIL — the response still carries `provider: 'bictorys'`/502 from the old code path.

- [ ] **Step 3: Rewrite the checkout handler**

In `backend/routes/financials.js`, replace the `paypal`/`initiateCheckoutWithFailover` requires with:

```js
const chariow = require('../services/payments/chariow');
```

Replace the body of `POST /subscription/checkout` from the `const { months, phoneNumber, planId, provider } = req.body;` line down to the `res.status(201).json({...})` with:

```js
    const { months, planId, phone, phoneCountry, phoneLocal } = req.body;
    const qtyMonths = parseInt(months, 10);

    if (![1, 3, 6, 12].includes(qtyMonths)) {
      return res.status(400).json({ error: "Durée d'abonnement invalide (1, 3, 6 ou 12 mois)." });
    }

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('name, plan')
      .eq('id', req.user.clinicId)
      .single();
    if (clinicError) throw clinicError;

    const targetPlanId = planId || clinic.plan;
    if (targetPlanId === 'starter') {
      return res.status(400).json({ error: "Le plan Starter est gratuit — activez-le depuis Abonnez-vous, sans paiement." });
    }
    if (!['clinique', 'hopital'].includes(targetPlanId)) {
      return res.status(400).json({ error: "Plan d'abonnement invalide." });
    }

    // Vérification de la limite de personnel avant tout paiement : on
    // n'encaisse pas pour un changement de plan qui laisserait la clinique
    // hors limites.
    if (targetPlanId !== clinic.plan) {
      const targetPlan = getPlan(targetPlanId);
      if (targetPlan.staffLimit !== null) {
        const { count: activeStaffCount, error: countError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('clinic_id', req.user.clinicId)
          .eq('active', 1);
        if (countError) throw countError;
        if ((activeStaffCount || 0) > targetPlan.staffLimit) {
          return res.status(400).json({ error: `Le plan ${targetPlan.name} est limité à ${targetPlan.staffLimit} collaborateurs actifs. Désactivez des comptes dans "Gestion des Utilisateurs" avant de changer de plan.` });
        }
      }
    }

    if (!(await chariow.isConfigured())) {
      return res.status(502).json({ error: "Le paiement en ligne n'est pas configuré pour cette installation. Contactez le support MediClinic." });
    }

    const config = await chariow.loadConfig();
    const productId = chariow.productIdFor(config.products, targetPlanId, qtyMonths);
    if (!productId) {
      // Message nommant la combinaison : c'est celui qu'un exploitant lira à
      // 2 h du matin, « paiement indisponible » ne l'aiderait pas.
      return res.status(502).json({
        error: `Aucun produit Chariow n'est associé à la combinaison ${targetPlanId}_${qtyMonths}. Configurez-la dans Administration plateforme → Config. système → Chariow.`
      });
    }

    const { data: adminUser } = await supabase
      .from('users')
      .select('name, email')
      .eq('id', req.user.userId)
      .maybeSingle();

    const amount = qtyMonths * getPlan(targetPlanId).price;

    const { data: subPayment, error: insertError } = await supabase
      .from('subscription_payments')
      .insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        plan: targetPlanId,
        months: qtyMonths,
        amount,
        provider: 'chariow',
        status: 'pending'
      })
      .select()
      .single();
    if (insertError) throw insertError;

    const [firstName, ...restName] = String(adminUser?.name || clinic.name || 'Clinique').trim().split(/\s+/);
    const checkout = await chariow.createCheckout({
      productId,
      email: adminUser?.email,
      // Chariow exige les deux noms ; un nom unique se dédouble plutôt que
      // d'envoyer une chaîne vide, qui serait refusée.
      firstName: firstName || 'Clinique',
      lastName: restName.join(' ') || firstName || 'MediClinic',
      phone: chariow.resolveChariowPhone({ phone, phoneCountry, phoneLocal }),
      redirectUrl: `${APP_URL}/?checkout=chariow&sub=${subPayment.id}`,
      metadata: { clinicId: req.user.clinicId, subscriptionPaymentId: subPayment.id }
    });

    if (!checkout.ok) {
      await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', subPayment.id);
      return res.status(502).json({ error: checkout.error });
    }

    // Contrôle du prix RÉELLEMENT débité. Chariow facture le prix de son
    // produit : un produit mal rattaché vendrait douze mois au prix d'un sans
    // qu'aucun signal ne se déclenche.
    if (checkout.amount.currency !== 'XOF') {
      await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', subPayment.id);
      return res.status(502).json({ error: `Le produit Chariow est en ${checkout.amount.currency} : seul le XOF est accepté.` });
    }
    if (!Number.isFinite(checkout.amount.value) || Math.abs(checkout.amount.value - amount) > amount * 0.02) {
      await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', subPayment.id);
      return res.status(502).json({
        error: `Le montant du produit Chariow (${checkout.amount.value} FCFA) ne correspond pas au prix attendu (${amount} FCFA) pour ${targetPlanId}_${qtyMonths}. Corrigez le produit avant d'encaisser.`
      });
    }

    await supabase
      .from('subscription_payments')
      .update({ provider_reference: checkout.saleId, checkout_url: checkout.checkoutUrl })
      .eq('id', subPayment.id);

    res.status(201).json({
      success: true,
      subscriptionPaymentId: subPayment.id,
      checkoutUrl: checkout.checkoutUrl,
      provider: 'chariow'
    });
```

- [ ] **Step 4: Add the verify route**

Immediately after the checkout route in `backend/routes/financials.js`:

```js
// POST /api/financials/subscription/verify
// Interrogée par la page d'abonnement au retour de Chariow. Ne décide rien
// elle-même : elle relaie vers la réconciliation, seule habilitée à créditer.
router.post('/subscription/verify', auth, checkRole(['admin']), async (req, res) => {
  try {
    const id = parseInt(req.body.subscriptionPaymentId, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant de paiement invalide.' });

    // Périmètre clinique vérifié avant tout appel sortant : cette route ne
    // doit pas permettre de sonder les paiements d'une autre clinique.
    const { data: row } = await supabase
      .from('subscription_payments')
      .select('id, clinic_id')
      .eq('id', id)
      .eq('clinic_id', req.user.clinicId)
      .maybeSingle();
    if (!row) return res.status(404).json({ error: 'Paiement introuvable.' });

    const { reconcileChariowSubscription } = require('../services/payments/chariowReconcile');
    const result = await reconcileChariowSubscription(id);
    res.json({ status: result.status });
  } catch (error) {
    console.error('[FINANCIALS] Erreur de vérification d\'abonnement:', error);
    res.status(500).json({ error: "Erreur lors de la vérification du paiement." });
  }
});
```

- [ ] **Step 5: Allowlist the verify route for expired subscriptions**

In `backend/middleware/auth.js`, find the `isBillingRoute` definition and extend it so `/financials/subscription/verify` is covered. If it already matches on the `/financials/subscription` prefix, no change is needed — confirm by reading the line, and only edit if the match is exact rather than prefix-based.

- [ ] **Step 6: Run tests**

Run: `cd backend && npx node --test tests/chariow-checkout.test.js`
Expected: PASS, 6 tests

Run: `cd backend && npm test`
Expected: 0 fail. `paypal-subscription.test.js` covers the checkout provider branch that this task removes — update or delete only the assertions about `provider: 'paypal'` on `POST /subscription/checkout`; keep every webhook and return-route test intact, since those paths stay live.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/financials.js backend/middleware/auth.js backend/tests/chariow-checkout.test.js backend/tests/paypal-subscription.test.js
git commit -m "feat(financials): pay subscriptions through Chariow only"
```

---

### Task 9: Cash-only patient payments and deposits

**Files:**
- Modify: `backend/routes/financials.js` (`POST /checkout`), `backend/routes/deposits.js` (`POST /`)
- Test: `backend/tests/cash-only.test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: both routes reject any non-cash `payment_method` with HTTP 400.

- [ ] **Step 1: Write the failing test**

`backend/tests/cash-only.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub({ userId: 1, clinicId: 1, role: 'admin' }));

const financials = require(path.join(BACKEND, 'routes', 'financials.js'));
const deposits = require(path.join(BACKEND, 'routes', 'deposits.js'));

let baseUrl;
let close;
test.before(async () => {
  ({ baseUrl, close } = await startApp([['/api/financials', financials], ['/api/deposits', deposits]]));
});
test.after(() => close());

const postJson = (url, body) => fetch(`${baseUrl}${url}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

test('un paiement patient en Mobile Money est refusé', async () => {
  resetDb();
  db.clinics.push({ id: 1, plan: 'hopital' });
  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: 7500, paymentMethod: 'wave'
  });
  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /espèces/i);
});

test('un paiement patient en espèces passe toujours', async () => {
  resetDb();
  db.clinics.push({ id: 1, plan: 'hopital' });
  db.patients.push({ id: 1, clinic_id: 1 });
  const res = await postJson('/api/financials/checkout', {
    patientId: 1, amountTotal: 7500, paymentMethod: 'cash'
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(db.payments[0].status, 'paid');
});

test('un dépôt de garantie en Mobile Money est refusé', async () => {
  resetDb();
  db.clinics.push({ id: 1, plan: 'hopital' });
  const res = await postJson('/api/deposits', {
    patientId: 1, amount: 20000, paymentMethod: 'orange_money'
  });
  assert.strictEqual(res.status, 400);
  assert.match((await res.json()).error, /espèces/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/cash-only.test.js`
Expected: FAIL — the Mobile Money requests return 201 or 502, not 400.

- [ ] **Step 3: Add the guard to both routes**

In `backend/routes/financials.js`, inside `POST /checkout`, immediately after destructuring the body:

```js
    // Les encaissements patients en ligne ont été retirés avec le passage à
    // Chariow : Chariow ne facture que le prix d'un produit de sa boutique et
    // ne sait pas prendre un montant libre (voir
    // docs/superpowers/specs/2026-08-08-chariow-integration-design.md).
    if (paymentMethod !== 'cash') {
      return res.status(400).json({
        error: "Les encaissements patients se font en espèces uniquement. Le paiement en ligne n'est plus proposé pour les paiements patients."
      });
    }
```

In `backend/routes/deposits.js`, inside `POST /`, at the same position:

```js
    if (paymentMethod !== 'cash') {
      return res.status(400).json({
        error: "Les dépôts de garantie se font en espèces uniquement. Le paiement en ligne n'est plus proposé pour les dépôts."
      });
    }
```

Leave `isPaymentMethodAllowed` and the plan's `paymentMethods` untouched: the guard runs first, and the plan data stays an honest description of what the tier once allowed.

- [ ] **Step 4: Run tests**

Run: `cd backend && npx node --test tests/cash-only.test.js`
Expected: PASS, 3 tests

Run: `cd backend && npm test`
Expected: 0 fail.

- [ ] **Step 5: Commit**

```bash
git add backend/routes/financials.js backend/routes/deposits.js backend/tests/cash-only.test.js
git commit -m "feat(payments): patient payments and deposits are cash only"
```

---

### Task 10: Daily reconciliation cron

**Files:**
- Modify: `backend/routes/cron.js`, `vercel.json`
- Test: `backend/tests/chariow-reconcile.test.js` (append)

**Interfaces:**
- Consumes: `reconcileChariowSubscription` (Task 6).
- Produces: `GET /api/cron/reconcile-chariow` → `{checked, credited}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/chariow-reconcile.test.js`:

```js
test('le cron ne reprend que les lignes Chariow en attente ou récemment échouées', async () => {
  resetDb();
  const recent = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
  const old = new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString();

  db.subscription_payments.push(
    { id: 1, provider: 'chariow', status: 'pending', created_at: recent, provider_reference: 's1' },
    { id: 2, provider: 'chariow', status: 'failed', created_at: recent, provider_reference: 's2' },
    { id: 3, provider: 'chariow', status: 'failed', created_at: old, provider_reference: 's3' },
    { id: 4, provider: 'chariow', status: 'paid', created_at: recent, provider_reference: 's4' },
    { id: 5, provider: 'bictorys', status: 'pending', created_at: recent, provider_reference: 's5' }
  );

  const { selectReconcilable } = require(path.join(BACKEND, 'services', 'payments', 'chariowReconcile.js'));
  const ids = selectReconcilable(db.subscription_payments).map((r) => r.id);

  assert.deepStrictEqual(ids, [1, 2], 'ni les payés, ni les échecs anciens, ni les autres fournisseurs');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx node --test tests/chariow-reconcile.test.js`
Expected: FAIL — `selectReconcilable is not a function`

- [ ] **Step 3: Add the selector and the cron route**

In `backend/services/payments/chariowReconcile.js`, add and export:

```js
/**
 * Filtre les lignes qu'il vaut la peine de réconcilier. Séparé de la boucle
 * du cron pour être testable sans réseau.
 */
function selectReconcilable(rows) {
  const cutoff = Date.now() - FAILED_RETRY_DAYS * 24 * 3600 * 1000;
  return (rows || []).filter((row) => {
    if (row.provider !== 'chariow') return false;
    if (row.status === 'pending') return true;
    if (row.status !== 'failed') return false;
    return new Date(row.created_at).getTime() >= cutoff;
  });
}

module.exports = { reconcileChariowSubscription, selectReconcilable, FAILED_RETRY_DAYS };
```

In `backend/routes/cron.js`, add the route before `module.exports`:

```js
// GET /api/cron/reconcile-chariow
// Filet quotidien : rattrape les paiements dont ni le retour navigateur ni le
// webhook n'ont abouti. Les crons Vercel du plan Hobby ne descendent pas sous
// la journée, ce qui est acceptable — les deux autres chemins créditent en
// secondes, celui-ci n'existe que pour ce qui leur a échappé.
router.get('/reconcile-chariow', requireCronSecret, async (req, res) => {
  try {
    const { data: rows, error } = await supabase
      .from('subscription_payments')
      .select('id, provider, status, created_at')
      .eq('provider', 'chariow');
    if (error) throw error;

    const { reconcileChariowSubscription, selectReconcilable } = require('../services/payments/chariowReconcile');
    const candidates = selectReconcilable(rows);

    let credited = 0;
    for (const row of candidates) {
      const result = await reconcileChariowSubscription(row.id);
      if (result.status === 'paid') credited += 1;
    }

    res.json({ checked: candidates.length, credited });
  } catch (error) {
    console.error('[CRON] Réconciliation Chariow impossible:', error);
    res.status(500).json({ error: 'Erreur lors de la réconciliation Chariow.' });
  }
});
```

In `vercel.json`, add to the `crons` array:

```json
    { "path": "/api/cron/reconcile-chariow", "schedule": "0 5 * * *" }
```

- [ ] **Step 4: Run tests**

Run: `cd backend && npm test`
Expected: 0 fail.

- [ ] **Step 5: Commit**

```bash
git add backend/services/payments/chariowReconcile.js backend/routes/cron.js vercel.json backend/tests/chariow-reconcile.test.js
git commit -m "feat(cron): reconcile stranded Chariow payments daily"
```

---

### Task 11: Subscription payment UI

**Files:**
- Modify: `frontend/src/pages/Settings/SettingsPage.tsx` (renewal panel, around lines 781-860)

**Interfaces:**
- Consumes: `POST /financials/subscription/checkout`, `POST /financials/subscription/verify` (Task 8).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Replace the provider buttons with a single Chariow form**

Remove the "Payer par Mobile Money" and "Payer par PayPal" buttons and the PayPal conversion note. Keep the existing months/plan selectors. Replace the phone field with the shared `PhoneInput`, which must supply all three fields the backend expects.

Add to the component's state:

```tsx
  const [payPhone, setPayPhone] = useState<string>('');       // E.164 rendu par PhoneInput
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifyMessage, setVerifyMessage] = useState<string>('');
```

The submit handler:

```tsx
  const handleChariowCheckout = async () => {
    if (!renewalTargetPlanId) return;
    setIsRenewing(true);
    try {
      const parsed = payPhone ? parsePhoneNumber(payPhone) : null;
      const data = await api.post('/financials/subscription/checkout', {
        months: renewalMonths,
        planId: renewalTargetPlanId,
        // Les trois champs partent ensemble : le serveur normalise, le client
        // ne pré-nettoie jamais (un E.164 brut fait échouer Chariow).
        phone: payPhone || undefined,
        phoneCountry: parsed?.country,
        phoneLocal: parsed?.nationalNumber
      });
      window.location.href = data.checkoutUrl;
    } catch (err: any) {
      showToast('error', 'Paiement impossible', err.error || "Impossible d'initialiser le paiement.");
    } finally {
      setIsRenewing(false);
    }
  };
```

Import the parser next to the existing imports:

```tsx
import { parsePhoneNumber } from 'libphonenumber-js';
```

The button:

```tsx
  <button type="button" className="btn btn-primary" disabled={isRenewing} onClick={handleChariowCheckout}>
    {isRenewing ? 'Initialisation...' : 'Payer par Mobile Money ou carte'}
  </button>
```

- [ ] **Step 2: Poll on return from Chariow**

Add to the same component:

```tsx
  // Retour de la page Chariow : ?checkout=chariow&sub=<id>. On interroge le
  // serveur pendant 45 s. L'URL n'est JAMAIS une preuve de paiement — seul le
  // serveur tranche, après avoir redemandé le statut à Chariow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'chariow') return;
    const subId = parseInt(params.get('sub') || '', 10);
    if (!Number.isInteger(subId)) return;

    let attempts = 0;
    let cancelled = false;
    setVerifying(true);
    setVerifyMessage('Vérification du paiement en cours...');

    const poll = async () => {
      attempts += 1;
      try {
        const data = await api.post('/financials/subscription/verify', { subscriptionPaymentId: subId });
        if (cancelled) return;
        if (data.status === 'paid') {
          setVerifying(false);
          setVerifyMessage('');
          showToast('success', 'Abonnement activé', 'Votre paiement a été confirmé.');
          fetchPlansData();
          window.history.replaceState({}, '', window.location.pathname);
          return;
        }
        if (data.status === 'failed') {
          setVerifying(false);
          setVerifyMessage('Le paiement a échoué. Aucun montant ne vous a été débité par MediClinic.');
          return;
        }
      } catch {
        /* on retente : une erreur réseau ne prouve pas un échec de paiement */
      }
      if (attempts >= 15) {
        setVerifying(false);
        setVerifyMessage("Paiement en cours de validation. Votre abonnement sera activé automatiquement dès confirmation — vous n'avez rien d'autre à faire.");
        return;
      }
      if (!cancelled) setTimeout(poll, 3000);
    };

    poll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

Render the message above the plan cards:

```tsx
  {(verifying || verifyMessage) && (
    <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
      {verifying ? 'Vérification du paiement en cours...' : verifyMessage}
    </div>
  )}
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: `✓ built`, no TypeScript error.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings/SettingsPage.tsx
git commit -m "feat(settings): pay the subscription through Chariow"
```

---

### Task 12: Remove online payment from the cashier screens

**Files:**
- Modify: `frontend/src/pages/Accounting/AccountingPage.tsx:655-660`, `frontend/src/pages/Deposits/DepositsPage.tsx:548-553`

**Interfaces:**
- Consumes: Task 9's server-side guard.
- Produces: nothing.

- [ ] **Step 1: Drop the Mobile Money options**

In `AccountingPage.tsx`, remove the three `<option>` entries for `wave`, `orange_money` and `mtn_momo`, leaving only the cash option. Remove the `PaymentCheckoutModal` usage and its import if nothing else on the page uses it.

In `DepositsPage.tsx`, reduce the payment method list to cash only:

```tsx
                    { id: 'cash', label: 'Espèces', icon: Banknote }
```

Remove the `PaymentCheckoutModal` usage and import if unused.

Add the same one-line comment to both files:

```tsx
{/* Espèces uniquement depuis le passage à Chariow : Chariow ne facture que le
    prix d'un produit de sa boutique et ne prend aucun montant libre. Le
    serveur refuse de toute façon tout autre mode (financials.js, deposits.js). */}
```

- [ ] **Step 2: Build and lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: `✓ built`; no new lint warning (unused imports must be gone).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Accounting/AccountingPage.tsx frontend/src/pages/Deposits/DepositsPage.tsx
git commit -m "feat(ui): cashier screens take cash only"
```

---

### Task 13: Chariow tab in Config. système

**Files:**
- Create: `frontend/src/pages/PlatformAdmin/sections/ChariowConfigSection.tsx`
- Modify: `frontend/src/pages/PlatformAdmin/sections/SystemConfigSection.tsx`

**Interfaces:**
- Consumes: `GET/PUT /api/platform/config` (Task 4).
- Produces: nothing.

- [ ] **Step 1: Write the section**

`frontend/src/pages/PlatformAdmin/sections/ChariowConfigSection.tsx`:

```tsx
import React, { useState } from 'react';
import { api } from '../../../utils/api';
import { useNotifications } from '../../../contexts/NotificationContext';

interface ChariowConfig {
  apiKey: 'set' | 'blank';
  webhookSecret: 'set' | 'blank';
  apiUrl: string;
  products: Record<string, string>;
  expectedProductKeys: string[];
  encryptionConfigured: boolean;
}

interface Props {
  config: ChariowConfig;
  onSaved: () => void;
}

export const ChariowConfigSection: React.FC<Props> = ({ config, onSaved }) => {
  const { showToast } = useNotifications();
  const [apiKey, setApiKey] = useState<string>('');
  const [products, setProducts] = useState<Record<string, string>>(config.products || {});
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const save = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      const data = await api.put('/platform/config', payload);
      if (data.webhookUrl) setWebhookUrl(data.webhookUrl);
      showToast('success', 'Configuration enregistrée', 'Chariow a été mis à jour.');
      onSaved();
    } catch (err: any) {
      showToast('error', 'Enregistrement refusé', err.error || 'Erreur inconnue.');
    } finally {
      setSaving(false);
    }
  };

  if (!config.encryptionConfigured) {
    return (
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Chiffrement non configuré</h3>
        <p style={{ color: 'var(--text-secondary)' }}>
          La variable <code>CONFIG_ENCRYPTION_KEY</code> est absente. La clé API Chariow ne peut pas
          être enregistrée sans être chiffrée. Définissez-la dans les variables d'environnement du
          déploiement (64 caractères hexadécimaux), puis redéployez.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Clé API</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          État actuel : <strong>{config.apiKey === 'set' ? 'configurée' : 'absente'}</strong>. La clé
          n'est jamais réaffichée. Elle est vérifiée auprès de Chariow à l'enregistrement.
        </p>
        <input
          type="password"
          className="input-control"
          value={apiKey}
          placeholder="Coller la clé API Chariow"
          onChange={(e) => setApiKey(e.target.value)}
        />
        <button
          className="btn btn-primary"
          style={{ marginTop: '0.75rem' }}
          disabled={saving || !apiKey.trim()}
          onClick={() => save({ chariow_api_key: apiKey.trim() })}
        >
          Enregistrer la clé
        </button>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Produits par plan et durée</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Chariow débite le prix du produit, pas un montant transmis par MediClinic. Le prix de
          chaque produit doit correspondre exactement au plan multiplié par la durée, sinon le
          paiement est refusé au moment du checkout.
        </p>
        {config.expectedProductKeys.map((key) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <label style={{ width: '140px', fontSize: '0.85rem', fontWeight: 600 }}>{key}</label>
            <input
              className="input-control"
              value={products[key] || ''}
              placeholder="prod_…"
              onChange={(e) => setProducts({ ...products, [key]: e.target.value })}
            />
          </div>
        ))}
        <button
          className="btn btn-primary"
          style={{ marginTop: '0.75rem' }}
          disabled={saving}
          onClick={() => {
            const filled = Object.fromEntries(Object.entries(products).filter(([, v]) => v && v.trim()));
            save({ chariow_products: filled });
          }}
        >
          Enregistrer les produits
        </button>
      </div>

      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ marginTop: 0 }}>Webhook</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          État actuel : <strong>{config.webhookSecret === 'set' ? 'configuré' : 'absent'}</strong>.
          L'URL complète n'est affichée qu'une seule fois, juste après la génération : copiez-la
          immédiatement dans le tableau de bord Chariow. Régénérer invalide l'ancienne.
        </p>
        {webhookUrl && (
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
            {webhookUrl}
          </pre>
        )}
        <button
          className="btn btn-secondary"
          disabled={saving}
          onClick={() => save({ chariow_webhook_secret: '__generate__' })}
        >
          {config.webhookSecret === 'set' ? 'Régénérer le secret' : 'Générer le secret'}
        </button>
      </div>
    </div>
  );
};

export default ChariowConfigSection;
```

- [ ] **Step 2: Mount it in Config. système**

In `SystemConfigSection.tsx`, add `chariow` to the `ConfigResponse` interface, then render the new section under the existing rows:

```tsx
{config.chariow && <ChariowConfigSection config={config.chariow} onSaved={load} />}
```

with `import ChariowConfigSection from './ChariowConfigSection';`. The re-fetch function is called `load` (`SystemConfigSection.tsx:62`), so `onSaved={load}` is correct as written.

Add to the `ConfigResponse` interface:

```tsx
  chariow?: {
    apiKey: 'set' | 'blank';
    webhookSecret: 'set' | 'blank';
    apiUrl: string;
    products: Record<string, string>;
    expectedProductKeys: string[];
    encryptionConfigured: boolean;
  };
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: `✓ built`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PlatformAdmin/sections/ChariowConfigSection.tsx frontend/src/pages/PlatformAdmin/sections/SystemConfigSection.tsx
git commit -m "feat(platform): add the Chariow configuration tab"
```

---

### Task 14: Documentation

**Files:**
- Modify: `CLAUDE.md`, `backend/.env.example`

- [ ] **Step 1: Document the environment variable**

In `backend/.env.example`, add:

```
# Clé maîtresse (64 caractères hexadécimaux) chiffrant les secrets stockés dans
# platform_settings — aujourd'hui la clé API Chariow et son secret de webhook.
# Vide = ces secrets ne peuvent pas être enregistrés (jamais de stockage en clair).
# Générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
CONFIG_ENCRYPTION_KEY=
```

- [ ] **Step 2: Update the architecture notes**

In `CLAUDE.md`, in the Payments section, state that Chariow is the only subscription checkout, that patient payments and deposits are cash only, that Bictorys/PayTech/PayPal keep their webhooks mounted for in-flight payments, and that Chariow accepts XOF shops only. Add the three operator prerequisites: the eight XOF products, `CONFIG_ENCRYPTION_KEY`, and pasting the webhook URL.

- [ ] **Step 3: Full verification**

Run: `cd backend && npm test`
Expected: 0 fail.

Run: `cd frontend && npm run build && npm run lint`
Expected: `✓ built`, no new warnings.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md backend/.env.example
git commit -m "docs: document the Chariow-only subscription flow"
```

---

## Manual verification before going live

Automated tests never touch Chariow's servers. Before announcing the feature:

1. Create the eight products in the Chariow shop, in XOF, at exactly `PLANS[plan].price × months`.
2. Set `CONFIG_ENCRYPTION_KEY` in Vercel Project Settings, then redeploy — environment variables are read at function start.
3. Save the API key in Platform Admin. A wrong key must be refused immediately; a non-XOF shop must be refused with a currency message.
4. Generate the webhook secret, copy the URL into Chariow's dashboard.
5. Run one real subscription payment end to end. Verify: the sale appears in Chariow, `subscription_payments` flips to `paid`, `paid_at` matches Chariow's settlement time and not the current time, and `clinics.subscription_expires_at` moved by the right number of months.
6. Deliberately mis-map one product to a cheaper one and confirm the checkout is refused rather than sold at the wrong price.
