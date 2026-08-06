# Platform Admin — Config. système — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disabled "Config. système" sidebar entry with a working read-only configuration inspector plus two safe editable platform settings.

**Architecture:** One new backend route module (`platform-config.js`) mounted under `/api/platform` behind the existing `auth` + `superAdminOnly` chain, one new settings helper with graceful degradation when the table is missing, and one new frontend section component. `platform.js` and its 591 lines are not touched.

**Tech Stack:** Express 4, `@supabase/supabase-js` (PostgREST), React 19 + TypeScript, plain CSS, `node --test` (Node built-in runner, no test framework dependency).

Spec: `docs/superpowers/specs/2026-08-06-platform-admin-sections-design.md`

## Global Constraints

- All user-facing strings are in French. Error messages included.
- Every `/api/platform/*` route is gated by `router.use(auth, superAdminOnly)` at module top — the pattern in `backend/routes/platform.js:16`.
- **`GET /api/platform/config` must never return a secret value** — only `true`/`false` for "set/blank", plus the public URLs `API_PUBLIC_URL` and `APP_URL`. No key, no key prefix, no key length.
- A missing table (`PGRST205`) or missing column (`42703`) must produce a clear French message, never a 500. This repo has no DDL access; the user runs migrations by hand.
- Plan prices and staff limits stay in `backend/utils/plans.js`. `SUPER_ADMIN_EMAILS` stays an environment variable.
- No new npm dependencies.
- Tests mount the real route modules and replace only `database.js` and `middleware/auth.js` through the `require` cache.

## File Structure

| File | Responsibility |
|---|---|
| `backend/tests/helpers/harness.js` (create) | Shared test harness: in-memory Supabase fake, module stubbing, Express app builder |
| `backend/tests/paypal-subscription.test.js` (modify) | Switch to the shared harness |
| `backend/utils/platformSettings.js` (create) | Read/write `platform_settings` with defaults and missing-table degradation |
| `backend/routes/platform-config.js` (create) | `GET /config`, `PUT /config` |
| `backend/server.js` (modify) | Mount the new router |
| `backend/supabase_schema.sql` (modify) | Declare `platform_settings` |
| `backend/routes/auth.js` (modify) | Read `starter_trial_days` at registration; expose `maintenanceMessage` on `GET /auth/me` |
| `backend/tests/platform-config.test.js` (create) | Tests for the two routes |
| `frontend/src/pages/PlatformAdmin/sections/SystemConfigSection.tsx` (create) | The section UI |
| `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx` (modify) | Remove the "BIENTÔT" entry, wire the section |
| `frontend/src/components/Header.tsx` (modify) | Maintenance banner |

---

### Task 1: Extract the shared test harness

The existing `backend/tests/paypal-subscription.test.js` carries ~120 lines of stub setup. Plans 2 and 3 need the same. Extract it once.

**Files:**
- Create: `backend/tests/helpers/harness.js`
- Modify: `backend/tests/paypal-subscription.test.js`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `db` — Proxy where `db.<table>` auto-creates an array. `db.subscription_payments.push({...})`.
  - `resetDb(): void` — empties every table.
  - `stubModule(relativePath: string, exports: object): void` — replaces a `backend/`-relative module in the require cache. Must be called before the route module is required.
  - `makeSupabaseStub(): { from: (table: string) => QueryBuilder }` — the in-memory PostgREST fake.
  - `authStub(user?: {userId:number, clinicId:number, role:string}): { auth, checkRole }` — pass-through auth middleware.
  - `startApp(mounts: Array<[string, unknown]>): Promise<{ baseUrl: string, close: () => void }>` — builds an Express app with the `rawBody` verify hook, mounts each `[path, router]`, listens on port 0.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/helpers/harness.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { db, resetDb, makeSupabaseStub } = require('./harness');

test('le faux Supabase insere puis relit une ligne', async () => {
  resetDb();
  const supabase = makeSupabaseStub();

  const inserted = await supabase.from('clinics').insert({ name: 'Test' }).select().single();
  assert.strictEqual(inserted.error, null);
  assert.strictEqual(inserted.data.id, 1);

  const read = await supabase.from('clinics').select('*').eq('id', 1).maybeSingle();
  assert.strictEqual(read.data.name, 'Test');
  assert.strictEqual(db.clinics.length, 1);
});

test('resetDb vide toutes les tables', async () => {
  resetDb();
  const supabase = makeSupabaseStub();
  await supabase.from('clinics').insert({ name: 'X' });
  resetDb();
  assert.strictEqual(db.clinics.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/helpers/harness.test.js`
Expected: FAIL with `Cannot find module './harness'`

- [ ] **Step 3: Write the harness**

Create `backend/tests/helpers/harness.js`:

```js
// Harnais de test partagé. Charge les VRAIES routes et ne remplace que ce qui
// sort de la machine : Supabase, le réseau, l'authentification.
const path = require('node:path');
const express = require('express');

const BACKEND = path.join(__dirname, '..', '..');

const db = new Proxy({}, {
  get(tables, name) {
    if (typeof name === 'string' && !tables[name]) tables[name] = [];
    return tables[name];
  }
});

function resetDb() {
  for (const table of Object.keys(db)) db[table].length = 0;
}

function stubModule(relativePath, exports) {
  const file = require.resolve(path.join(BACKEND, relativePath));
  require.cache[file] = { id: file, filename: file, loaded: true, exports, children: [], paths: [] };
}

function queryBuilder(table) {
  const state = { op: 'select', filters: [], payload: null, singleRow: false };
  const rowMatches = (row) => state.filters.every(([column, value]) => row[column] === value);

  const run = () => {
    const rows = db[table];
    if (state.op === 'insert') {
      const row = { id: rows.length + 1, ...state.payload };
      rows.push(row);
      return { data: state.singleRow ? row : [row], error: null };
    }
    const hits = rows.filter(rowMatches);
    if (state.op === 'update') {
      hits.forEach((row) => Object.assign(row, state.payload));
      return { data: state.singleRow ? hits[0] || null : hits, error: null };
    }
    return { data: state.singleRow ? hits[0] || null : hits, error: null };
  };

  const builder = {
    select() { return builder; },
    eq(column, value) { state.filters.push([column, value]); return builder; },
    insert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
    update(payload) { state.op = 'update'; state.payload = payload; return builder; },
    upsert(payload) { state.op = 'insert'; state.payload = payload; return builder; },
    maybeSingle() { state.singleRow = true; return builder; },
    single() { state.singleRow = true; return builder; },
    then(onOk, onErr) { return Promise.resolve().then(run).then(onOk, onErr); }
  };
  return builder;
}

function makeSupabaseStub() {
  return { from: queryBuilder };
}

function authStub(user = { userId: 1, clinicId: 1, role: 'admin' }) {
  return {
    auth: (req, _res, next) => { req.user = { ...user }; next(); },
    checkRole: () => (_req, _res, next) => next()
  };
}

async function startApp(mounts) {
  const app = express();
  app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
  for (const [mountPath, router] of mounts) app.use(mountPath, router);
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => server.close()
  };
}

module.exports = { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/helpers/harness.test.js`
Expected: PASS, 2 tests

- [ ] **Step 5: Switch the PayPal test to the harness**

In `backend/tests/paypal-subscription.test.js`, delete the local `db` Proxy, `resetDb`, `stubModule`, `queryBuilder`, `makeSupabaseStub`-equivalent block and the local `app`/`server` setup, and replace them with:

```js
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub());
```

Keep the PayPal-specific stubs (`services/payments/paypal.js`, `services/payments/index.js`) and the env-var block exactly as they are. Replace the `test.before`/`test.after` bodies with:

```js
let server;
let baseUrl;

test.before(async () => {
  const started = await startApp([
    ['/api/webhooks', require(path.join(BACKEND, 'routes/webhooks.js'))],
    ['/api/financials', require(path.join(BACKEND, 'routes/financials.js'))]
  ]);
  baseUrl = started.baseUrl;
  server = started;
});

test.after(() => server.close());
```

- [ ] **Step 6: Run the whole suite to verify nothing regressed**

Run: `cd backend && npm test`
Expected: PASS, 11 tests (9 PayPal + 2 harness), 0 fail

- [ ] **Step 7: Commit**

```bash
git add backend/tests/helpers/harness.js backend/tests/helpers/harness.test.js backend/tests/paypal-subscription.test.js
git commit -m "test: extract the shared route-test harness"
```

---

### Task 2: `platform_settings` table and settings helper

**Files:**
- Create: `backend/utils/platformSettings.js`
- Create: `backend/tests/platform-settings.test.js`
- Modify: `backend/supabase_schema.sql`

**Interfaces:**
- Consumes: `db`, `resetDb`, `makeSupabaseStub`, `stubModule` from Task 1
- Produces:
  - `DEFAULTS: { starter_trial_days: 7, maintenance_message: '' }`
  - `isMissingRelation(error: object|null): boolean` — true for PostgREST codes `PGRST205`, `PGRST204`, `42P01`, `42703`
  - `getSettings(): Promise<{ values: {starter_trial_days: number, maintenance_message: string}, tableMissing: boolean }>` — never throws on a missing table
  - `setSetting(key: string, value: string, userId: number): Promise<{ok: true} | {ok: false, tableMissing: boolean, error: string}>`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-settings.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
const settings = require(path.join(BACKEND, 'utils/platformSettings.js'));

test('table vide : renvoie les valeurs par defaut', async () => {
  resetDb();
  const { values, tableMissing } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 7);
  assert.strictEqual(values.maintenance_message, '');
  assert.strictEqual(tableMissing, false);
});

test('valeur en base : ecrase le defaut et est typee', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '14' });
  db.platform_settings.push({ key: 'maintenance_message', value: 'Maintenance prevue' });
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 14);
  assert.strictEqual(values.maintenance_message, 'Maintenance prevue');
});

test('valeur illisible : repli sur le defaut', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: 'quatorze' });
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 7);
});

test('isMissingRelation reconnait les codes PostgREST', () => {
  assert.strictEqual(settings.isMissingRelation({ code: 'PGRST205' }), true);
  assert.strictEqual(settings.isMissingRelation({ code: '42703' }), true);
  assert.strictEqual(settings.isMissingRelation({ code: '23505' }), false);
  assert.strictEqual(settings.isMissingRelation(null), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-settings.test.js`
Expected: FAIL with `Cannot find module ...utils/platformSettings.js`

- [ ] **Step 3: Write the helper**

Create `backend/utils/platformSettings.js`:

```js
// Réglages de plateforme (table platform_settings), lus par le console Super
// Admin et par l'inscription. La table est une migration à exécuter à la main
// (voir CLAUDE.md, schema drift) : tout ce module dégrade proprement tant
// qu'elle n'existe pas, il ne lève jamais pour cette raison.
const { supabase } = require('../database');

const DEFAULTS = {
  starter_trial_days: 7,
  maintenance_message: ''
};

// PGRST205 = table inconnue du cache de schéma, PGRST204 = colonne inconnue
// dans le corps d'un write, 42P01/42703 = les équivalents côté Postgres.
const MISSING_RELATION_CODES = ['PGRST205', 'PGRST204', '42P01', '42703'];

function isMissingRelation(error) {
  return !!error && MISSING_RELATION_CODES.includes(error.code);
}

function coerce(key, raw) {
  if (raw === undefined || raw === null) return DEFAULTS[key];
  if (key === 'starter_trial_days') {
    // Format strict : parseInt('14 jours') vaudrait 14 et masquerait une
    // saisie douteuse. Une valeur illisible retombe sur le défaut.
    if (!/^\d+$/.test(String(raw).trim())) return DEFAULTS.starter_trial_days;
    const n = parseInt(String(raw).trim(), 10);
    return n >= 1 && n <= 90 ? n : DEFAULTS.starter_trial_days;
  }
  return String(raw);
}

async function getSettings() {
  const { data, error } = await supabase.from('platform_settings').select('key, value');

  if (isMissingRelation(error)) {
    return { values: { ...DEFAULTS }, tableMissing: true };
  }
  if (error) throw error;

  const byKey = new Map((data || []).map((row) => [row.key, row.value]));
  const values = {};
  for (const key of Object.keys(DEFAULTS)) values[key] = coerce(key, byKey.get(key));
  return { values, tableMissing: false };
}

async function setSetting(key, value, userId) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    return { ok: false, tableMissing: false, error: `Réglage inconnu : ${key}` };
  }

  const { data: existing, error: readError } = await supabase
    .from('platform_settings')
    .select('key')
    .eq('key', key)
    .maybeSingle();

  if (isMissingRelation(readError)) {
    return { ok: false, tableMissing: true, error: 'La table platform_settings est absente.' };
  }
  if (readError) return { ok: false, tableMissing: false, error: readError.message };

  const payload = { key, value: String(value), updated_by: userId, updated_at: new Date().toISOString() };
  const { error: writeError } = existing
    ? await supabase.from('platform_settings').update(payload).eq('key', key)
    : await supabase.from('platform_settings').insert(payload);

  if (isMissingRelation(writeError)) {
    return { ok: false, tableMissing: true, error: 'La table platform_settings est absente.' };
  }
  if (writeError) return { ok: false, tableMissing: false, error: writeError.message };

  return { ok: true };
}

module.exports = { DEFAULTS, isMissingRelation, getSettings, setSetting };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-settings.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Declare the table in the schema file**

Append to `backend/supabase_schema.sql`, after the `notification_reads` table:

```sql
-- 20. Platform Settings Table (Super-Admin-editable platform-wide values).
-- Deliberately narrow: plan prices and staff limits stay in
-- backend/utils/plans.js, and SUPER_ADMIN_EMAILS stays an environment
-- variable — it is the auth boundary of the console that would edit it.
CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

- [ ] **Step 6: Commit**

```bash
git add backend/utils/platformSettings.js backend/tests/platform-settings.test.js backend/supabase_schema.sql
git commit -m "feat(platform): add platform_settings helper with missing-table degradation"
```

---

### Task 3: `GET /api/platform/config` inspector

**Files:**
- Create: `backend/routes/platform-config.js`
- Create: `backend/tests/platform-config.test.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `getSettings`, `DEFAULTS` from Task 2; `authStub`, `startApp`, `stubModule` from Task 1
- Produces: `GET /api/platform/config` returning
  `{ payments: {bictorys: boolean, paytech: boolean, paypal: boolean}, paypal: {mode: string, modeRecognised: boolean}, email: {channel: 'resend'|'smtp'|'console'}, rateLimit: {backend: 'redis'|'memory'}, google: {configured: boolean}, cron: {configured: boolean}, urls: {apiPublicUrl: string, appUrl: string}, database: {connected: boolean}, plans: Array<{id, name, price, staffLimit}>, settings: {values, tableMissing} }`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-config.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

process.env.PAYPAL_CLIENT_ID = 'un-secret-tres-secret';
process.env.PAYPAL_CLIENT_SECRET = 'un-autre-secret';
process.env.PAYPAL_MODE = 'https://sandbox.paypal.com'; // volontairement invalide
process.env.API_PUBLIC_URL = 'https://api.test';
process.env.APP_URL = 'https://app.test';

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub());
stubModule('middleware/superAdmin.js', {
  superAdminOnly: (_req, _res, next) => next(),
  SUPER_ADMIN_EMAILS: ['ops@test.ci']
});

let server;
let baseUrl;

test.before(async () => {
  const started = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform-config.js'))]]);
  baseUrl = started.baseUrl;
  server = started;
});

test.after(() => server.close());

test('la reponse ne contient AUCUNE valeur de secret', async () => {
  resetDb();
  const body = await (await fetch(`${baseUrl}/api/platform/config`)).text();
  assert.ok(!body.includes('un-secret-tres-secret'), 'PAYPAL_CLIENT_ID ne doit jamais sortir');
  assert.ok(!body.includes('un-autre-secret'), 'PAYPAL_CLIENT_SECRET ne doit jamais sortir');
});

test('signale un PAYPAL_MODE non reconnu', async () => {
  resetDb();
  const body = await (await fetch(`${baseUrl}/api/platform/config`)).json();
  assert.strictEqual(body.paypal.modeRecognised, false);
});

test('expose les URLs publiques et les plans en lecture seule', async () => {
  resetDb();
  const body = await (await fetch(`${baseUrl}/api/platform/config`)).json();
  assert.strictEqual(body.urls.apiPublicUrl, 'https://api.test');
  assert.ok(Array.isArray(body.plans) && body.plans.length >= 3);
});

test('table absente : renvoie les defauts sans 500', async () => {
  resetDb();
  const res = await fetch(`${baseUrl}/api/platform/config`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.settings.values.starter_trial_days, 7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-config.test.js`
Expected: FAIL with `Cannot find module ...routes/platform-config.js`

- [ ] **Step 3: Write the route module**

Create `backend/routes/platform-config.js`:

```js
// Inspecteur de configuration de la plateforme (Super Admin uniquement).
//
// RÈGLE ABSOLUE : cette route ne renvoie JAMAIS la valeur d'un secret —
// seulement des booléens « renseigné / vide », plus les URLs publiques. Pas de
// clé, pas de préfixe de clé, pas de longueur. superAdminOnly protège la
// route, mais une route qui n'expose rien ne peut rien fuiter même si la garde
// tombe un jour.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/superAdmin');
const { PLAN_IDS, getPlan } = require('../utils/plans');
const bictorys = require('../services/payments/bictorys');
const paytech = require('../services/payments/paytech');
const paypal = require('../services/payments/paypal');
const { getSettings, setSetting, DEFAULTS } = require('../utils/platformSettings');

router.use(auth, superAdminOnly);

const isSet = (name) => !!(process.env[name] || '').trim();

function emailChannel() {
  if (isSet('RESEND_API_KEY')) return 'resend';
  if (isSet('SMTP_HOST')) return 'smtp';
  return 'console';
}

async function databaseConnected() {
  try {
    const { error } = await supabase.from('clinics').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

// GET /api/platform/config
router.get('/config', async (req, res) => {
  try {
    const rawMode = (process.env.PAYPAL_MODE || 'sandbox').trim().toLowerCase();
    const settings = await getSettings();

    res.json({
      payments: {
        bictorys: bictorys.isConfigured(),
        paytech: paytech.isConfigured(),
        paypal: paypal.isConfigured()
      },
      paypal: {
        mode: rawMode === 'live' ? 'live' : 'sandbox',
        modeRecognised: rawMode === 'live' || rawMode === 'sandbox',
        webhookConfigured: isSet('PAYPAL_WEBHOOK_ID'),
        rateConfigured: isSet('XOF_TO_USD_RATE')
      },
      email: { channel: emailChannel() },
      rateLimit: {
        backend: isSet('UPSTASH_REDIS_REST_URL') && isSet('UPSTASH_REDIS_REST_TOKEN') ? 'redis' : 'memory'
      },
      google: { configured: isSet('GOOGLE_CLIENT_ID') },
      cron: { configured: isSet('CRON_SECRET') },
      urls: {
        apiPublicUrl: process.env.API_PUBLIC_URL || '',
        appUrl: process.env.APP_URL || ''
      },
      database: { connected: await databaseConnected() },
      plans: PLAN_IDS.map((id) => {
        const plan = getPlan(id);
        return { id, name: plan.name, price: plan.price, staffLimit: plan.staffLimit };
      }),
      settings
    });
  } catch (error) {
    console.error('[PLATFORM-CONFIG] Erreur de lecture de la configuration:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture de la configuration.' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-config.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Mount the router**

In `backend/server.js`, after line 20 (`const platformRoutes = require('./routes/platform');`) add:

```js
const platformConfigRoutes = require('./routes/platform-config');
```

and after line 109 (`app.use('/api/platform', platformRoutes);`) add:

```js
app.use('/api/platform', platformConfigRoutes);
```

- [ ] **Step 6: Run the whole suite**

Run: `cd backend && npm test`
Expected: PASS, 19 tests, 0 fail (9 PayPal + 2 harness + 4 settings + 4 config)

- [ ] **Step 7: Commit**

```bash
git add backend/routes/platform-config.js backend/tests/platform-config.test.js backend/server.js
git commit -m "feat(platform): add the read-only system configuration inspector"
```

---

### Task 4: `PUT /api/platform/config`

**Files:**
- Modify: `backend/routes/platform-config.js`
- Modify: `backend/tests/platform-config.test.js`

**Interfaces:**
- Consumes: `setSetting` from Task 2
- Produces: `PUT /api/platform/config` accepting `{ starter_trial_days?: number|string, maintenance_message?: string }`, returning `{ success: true, values }` or `400` with a French `error`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/platform-config.test.js`:

```js
const putConfig = (body) => fetch(`${baseUrl}/api/platform/config`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

test('starter_trial_days hors bornes est refuse', async () => {
  resetDb();
  const res = await putConfig({ starter_trial_days: 0 });
  assert.strictEqual(res.status, 400);
  const res2 = await putConfig({ starter_trial_days: 91 });
  assert.strictEqual(res2.status, 400);
});

test('starter_trial_days valide est enregistre et journalise', async () => {
  resetDb();
  const res = await putConfig({ starter_trial_days: 14 });
  assert.strictEqual(res.status, 200, await res.text());
  const { db } = require('./helpers/harness');
  assert.strictEqual(db.platform_settings.find(r => r.key === 'starter_trial_days').value, '14');
  assert.strictEqual(db.activity_logs.length, 1);
});

test('maintenance_message trop long est refuse', async () => {
  resetDb();
  const res = await putConfig({ maintenance_message: 'x'.repeat(281) });
  assert.strictEqual(res.status, 400);
});

test('aucun champ connu fourni : refuse', async () => {
  resetDb();
  const res = await putConfig({ plan_price: 99 });
  assert.strictEqual(res.status, 400);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-config.test.js`
Expected: FAIL — `PUT` returns 404, assertions expect 400/200

- [ ] **Step 3: Add the route**

In `backend/routes/platform-config.js`, before `module.exports`, add:

```js
const MAINTENANCE_MESSAGE_MAX = 280;

// PUT /api/platform/config
// Seuls les deux réglages sûrs sont modifiables. Les prix de plans et
// SUPER_ADMIN_EMAILS sont délibérément absents — voir l'en-tête du spec.
router.put('/config', async (req, res) => {
  try {
    const updates = [];

    if (req.body.starter_trial_days !== undefined) {
      const raw = String(req.body.starter_trial_days).trim();
      if (!/^\d+$/.test(raw)) {
        return res.status(400).json({ error: "La durée d'essai doit être un nombre entier de jours." });
      }
      const days = parseInt(raw, 10);
      if (days < 1 || days > 90) {
        return res.status(400).json({ error: "La durée d'essai doit être comprise entre 1 et 90 jours." });
      }
      updates.push(['starter_trial_days', String(days)]);
    }

    if (req.body.maintenance_message !== undefined) {
      const message = String(req.body.maintenance_message);
      if (message.length > MAINTENANCE_MESSAGE_MAX) {
        return res.status(400).json({ error: `Le message de maintenance est limité à ${MAINTENANCE_MESSAGE_MAX} caractères.` });
      }
      updates.push(['maintenance_message', message]);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucun réglage modifiable fourni.' });
    }

    for (const [key, value] of updates) {
      const result = await setSetting(key, value, req.user.userId);
      if (!result.ok) {
        const status = result.tableMissing ? 503 : 500;
        return res.status(status).json({
          error: result.tableMissing
            ? "La table platform_settings est absente de la base. Exécutez la migration indiquée dans backend/supabase_schema.sql."
            : result.error
        });
      }
      await supabase.from('activity_logs').insert({
        clinic_id: req.user.clinicId,
        user_id: req.user.userId,
        action: 'PLATFORM_CONFIG_UPDATE',
        details: `Réglage plateforme ${key} défini à "${value}"`
      });
    }

    const settings = await getSettings();
    res.json({ success: true, values: settings.values });
  } catch (error) {
    console.error('[PLATFORM-CONFIG] Erreur de mise à jour:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la configuration.' });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-config.test.js`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add backend/routes/platform-config.js backend/tests/platform-config.test.js
git commit -m "feat(platform): allow editing the two safe platform settings"
```

---

### Task 5: Wire `starter_trial_days` and `maintenance_message` into auth

**Files:**
- Modify: `backend/routes/auth.js:47-48`, `backend/routes/auth.js:267` and the `GET /auth/me` handler
- Create: `backend/tests/auth-platform-settings.test.js`

**Interfaces:**
- Consumes: `getSettings` from Task 2
- Produces: `GET /auth/me` response gains `maintenanceMessage: string`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/auth-platform-settings.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
const settings = require(path.join(BACKEND, 'utils/platformSettings.js'));

test('la duree d essai suit le reglage plateforme', async () => {
  resetDb();
  db.platform_settings.push({ key: 'starter_trial_days', value: '14' });
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, 14);
});

test('sans reglage, la duree d essai reste celle de plans.js', async () => {
  resetDb();
  const { getPlan } = require(path.join(BACKEND, 'utils/plans.js'));
  const { values } = await settings.getSettings();
  assert.strictEqual(values.starter_trial_days, getPlan('starter').trialDays);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/auth-platform-settings.test.js`
Expected: FAIL on the first test — `getSettings` is not yet consulted anywhere, but this test asserts the helper contract, so it should PASS. If it fails, the Task 2 helper is wrong; fix that before continuing.

- [ ] **Step 3: Use the setting at registration**

In `backend/routes/auth.js`, add near the other requires:

```js
const { getSettings } = require('../utils/platformSettings');
```

Replace `backend/routes/auth.js:47-48`:

```js
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + starterPlan.trialDays);
```

with:

```js
    // La durée d'essai est pilotable depuis Config. système ; repli sur
    // plans.js si la table platform_settings n'existe pas encore.
    const { values: platformValues } = await getSettings();
    const trialDays = platformValues.starter_trial_days || starterPlan.trialDays;
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + trialDays);
```

The Google registration path at `backend/routes/auth.js:266-268` has the identical shape:

```js
      const starterPlan = getPlan('starter');
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + starterPlan.trialDays);
```

Replace it with (note the deeper indentation — it sits inside an `if` block):

```js
      const starterPlan = getPlan('starter');
      const { values: platformValues } = await getSettings();
      const trialDays = platformValues.starter_trial_days || starterPlan.trialDays;
      const trialExpiry = new Date();
      trialExpiry.setDate(trialExpiry.getDate() + trialDays);
```

- [ ] **Step 4: Expose the maintenance message on `GET /auth/me`**

In the `GET /auth/me` handler in `backend/routes/auth.js`, add `maintenanceMessage` to the JSON response object:

```js
    const { values: platformValues } = await getSettings();
```

and in the response body:

```js
      maintenanceMessage: platformValues.maintenance_message || '',
```

- [ ] **Step 5: Run the whole suite**

Run: `cd backend && npm test`
Expected: PASS, 25 tests, 0 fail

- [ ] **Step 6: Commit**

```bash
git add backend/routes/auth.js backend/tests/auth-platform-settings.test.js
git commit -m "feat(auth): drive trial length and maintenance banner from platform settings"
```

---

### Task 6: `SystemConfigSection.tsx` and sidebar wiring

**Files:**
- Create: `frontend/src/pages/PlatformAdmin/sections/SystemConfigSection.tsx`
- Modify: `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx:254-279`
- Modify: `frontend/src/components/Header.tsx`

**Interfaces:**
- Consumes: `GET /api/platform/config`, `PUT /api/platform/config` from Tasks 3-4; `api` from `frontend/src/utils/api.ts`; `useNotification` from `frontend/src/contexts/NotificationContext.tsx`
- Produces: `SystemConfigSection` default-exported React component taking no props

- [ ] **Step 1: Create the section component**

Create `frontend/src/pages/PlatformAdmin/sections/SystemConfigSection.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../../utils/api';
import { useNotification } from '../../../contexts/NotificationContext';

interface ConfigResponse {
  payments: { bictorys: boolean; paytech: boolean; paypal: boolean };
  paypal: { mode: string; modeRecognised: boolean; webhookConfigured: boolean; rateConfigured: boolean };
  email: { channel: 'resend' | 'smtp' | 'console' };
  rateLimit: { backend: 'redis' | 'memory' };
  google: { configured: boolean };
  cron: { configured: boolean };
  urls: { apiPublicUrl: string; appUrl: string };
  database: { connected: boolean };
  plans: { id: string; name: string; price: number; staffLimit: number | null }[];
  settings: { values: { starter_trial_days: number; maintenance_message: string }; tableMissing: boolean };
}

const Status: React.FC<{ ok: boolean; okLabel?: string; koLabel?: string }> = ({ ok, okLabel = 'Configuré', koLabel = 'Non configuré' }) => (
  <span className="badge" style={{ backgroundColor: ok ? 'hsl(145 60% 92%)' : 'hsl(0 70% 95%)', color: ok ? 'hsl(145 70% 25%)' : 'hsl(0 70% 40%)' }}>
    {ok ? okLabel : koLabel}
  </span>
);

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', gap: '12px' }}>
    <span style={{ fontSize: '0.875rem' }}>{label}</span>
    <span style={{ fontSize: '0.8rem', textAlign: 'right' }}>{children}</span>
  </div>
);

export const SystemConfigSection: React.FC = () => {
  const { showToast } = useNotification();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [trialDays, setTrialDays] = useState('');
  const [maintenance, setMaintenance] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data: ConfigResponse = await api.get('/platform/config');
      setConfig(data);
      setTrialDays(String(data.settings.values.starter_trial_days));
      setMaintenance(data.settings.values.maintenance_message);
    } catch (err: any) {
      showToast('error', 'Erreur', err.error || 'Impossible de lire la configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/platform/config', {
        starter_trial_days: trialDays,
        maintenance_message: maintenance
      });
      showToast('success', 'Enregistré', 'Les réglages de la plateforme ont été mis à jour.');
      await load();
    } catch (err: any) {
      showToast('error', 'Échec', err.error || "Impossible d'enregistrer les réglages.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Chargement de la configuration…</p>;
  if (!config) return <p style={{ color: 'var(--text-muted)' }}>Configuration indisponible.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Paiements</h3>
        <Row label="Bictorys (Mobile Money principal)"><Status ok={config.payments.bictorys} /></Row>
        <Row label="PayTech (Mobile Money secours)"><Status ok={config.payments.paytech} /></Row>
        <Row label="PayPal (abonnements uniquement)"><Status ok={config.payments.paypal} /></Row>
        <Row label="Mode PayPal">
          {config.paypal.modeRecognised
            ? <Status ok={config.paypal.mode === 'live'} okLabel="live" koLabel="sandbox" />
            : <Status ok={false} koLabel="PAYPAL_MODE non reconnu" />}
        </Row>
        <Row label="Webhook PayPal déclaré"><Status ok={config.paypal.webhookConfigured} /></Row>
        <Row label="Taux FCFA → USD"><Status ok={config.paypal.rateConfigured} /></Row>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Services</h3>
        <Row label="Envoi d'emails">
          <Status
            ok={config.email.channel !== 'console'}
            okLabel={config.email.channel === 'resend' ? 'Resend' : 'SMTP'}
            koLabel="Console (aucun email réel envoyé)"
          />
        </Row>
        <Row label="Limitation de débit">
          <Status
            ok={config.rateLimit.backend === 'redis'}
            okLabel="Redis partagé"
            koLabel="Mémoire — inefficace en serverless"
          />
        </Row>
        <Row label="Google Sign-In"><Status ok={config.google.configured} /></Row>
        <Row label="Tâches planifiées (CRON_SECRET)"><Status ok={config.cron.configured} /></Row>
        <Row label="Base de données"><Status ok={config.database.connected} okLabel="Connectée" koLabel="Injoignable" /></Row>
        <Row label="API_PUBLIC_URL">{config.urls.apiPublicUrl || <em>non défini</em>}</Row>
        <Row label="APP_URL">{config.urls.appUrl || <em>non défini</em>}</Row>
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Plans en vigueur</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
          Lecture seule — les tarifs sont définis dans le code (backend/utils/plans.js) pour qu'une faute de saisie
          ne puisse pas casser la facturation de toutes les cliniques.
        </p>
        {config.plans.map((plan) => (
          <Row key={plan.id} label={plan.name}>
            {plan.price.toLocaleString()} FCFA/mois — {plan.staffLimit === null ? 'personnel illimité' : `${plan.staffLimit} collaborateurs`}
          </Row>
        ))}
      </div>

      <div className="card">
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Réglages modifiables</h3>
        {config.settings.tableMissing && (
          <p style={{ fontSize: '0.8rem', color: 'hsl(0 70% 40%)', margin: '0 0 10px' }}>
            La table <code>platform_settings</code> est absente de la base. Exécutez la migration déclarée
            dans <code>backend/supabase_schema.sql</code> avant de modifier ces valeurs.
          </p>
        )}
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Durée de l'essai Starter (jours)
          </span>
          <input
            type="number"
            className="input-control"
            value={trialDays}
            onChange={(e) => setTrialDays(e.target.value)}
            style={{ maxWidth: '160px' }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Message de maintenance (vide = aucun bandeau)
          </span>
          <textarea
            className="input-control"
            value={maintenance}
            maxLength={280}
            rows={2}
            onChange={(e) => setMaintenance(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" disabled={saving || config.settings.tableMissing} onClick={save}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
};

export default SystemConfigSection;
```

- [ ] **Step 2: Wire it into the sidebar**

In `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`:

Add the import at the top:

```tsx
import SystemConfigSection from './sections/SystemConfigSection';
```

Add `'system'` to the `Section` union type (find its declaration near the top of the file).

Add to `navItems` (line 254-261), after the `notifications` entry:

```tsx
    { id: 'system', label: 'Config. système', icon: SettingsIcon }
```

Remove the `Config. système` line from `comingSoonItems` (line 269), leaving only `Rapports` and `Sécurité`.

Add to `sectionTitles` (line 272-279):

```tsx
    system: 'Configuration système'
```

In the section-rendering block, add:

```tsx
        {activeSection === 'system' && <SystemConfigSection />}
```

- [ ] **Step 3: Add the maintenance banner**

In `frontend/src/components/Header.tsx`, read how the existing subscription-expiry banner is rendered, then add above it, using `maintenanceMessage` from the auth context user/clinic payload:

```tsx
      {maintenanceMessage && (
        <div style={{ backgroundColor: 'hsl(38 92% 92%)', color: 'hsl(30 80% 25%)', padding: '8px 16px', fontSize: '0.85rem', textAlign: 'center' }}>
          {maintenanceMessage}
        </div>
      )}
```

The value is plain text and must be rendered as a text child, never with `dangerouslySetInnerHTML`.

Expose `maintenanceMessage` from `frontend/src/contexts/AuthContext.tsx` by storing it from the `GET /auth/me` response alongside `user` and `clinic`.

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: no output (success)

- [ ] **Step 5: Verify in the browser**

Run: `npm run dev` from the repo root. Log in as a `SUPER_ADMIN_EMAILS` address, open Platform Admin, click "Config. système".
Expected: the four cards render, PayPal mode shows "PAYPAL_MODE non reconnu" if `.env` still holds a URL, and the settings card shows the missing-table warning until the migration is run.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PlatformAdmin/sections/SystemConfigSection.tsx frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx frontend/src/components/Header.tsx frontend/src/contexts/AuthContext.tsx
git commit -m "feat(platform): ship the Config. système section"
```

---

### Task 7: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the architecture notes**

In `CLAUDE.md`, in the "Cross-clinic platform admin" section, replace the sentence listing `Rapports`, `Sécurité`, `Config. système` as disabled with a description of the now-shipped Config. système section, and correct `backend/middleware/superAdminOnly` to `backend/middleware/superAdmin.js` (the file's real name — it *exports* `superAdminOnly`).

Add `platform_settings` to the table list in the "Data layer" section, and add the new migration to the historical migration block.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the Config. système section and fix the superAdmin middleware path"
```

---

## Migration to run by hand

Before Task 4's settings can be saved, run this in the Supabase SQL Editor:

```sql
CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Everything else in this plan works without it — the inspector degrades to defaults and the settings card shows a clear warning.
