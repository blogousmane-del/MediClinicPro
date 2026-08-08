# Platform Admin — Sécurité — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disabled "Sécurité" sidebar entry with a working section: a cross-clinic audit trail, failed-login monitoring backed by a new table, and a read-only view of the platform's defensive posture.

**Architecture:** One new backend route module (`platform-security.js`) mounted under `/api/platform` behind the existing `auth` + `superAdminOnly` chain, one new helper that records login failures without ever being able to break login, and one new frontend section. Follows the shape established by `platform-config.js`.

**Tech Stack:** Express 4, `@supabase/supabase-js` (PostgREST), React 19 + TypeScript, plain CSS, `node --test`.

Spec: `docs/superpowers/specs/2026-08-06-platform-admin-sections-design.md`

## Global Constraints

- All user-facing strings are in French.
- Gated by `router.use(auth, superAdminOnly)` at module top, as in `platform-config.js`.
- **The client-facing login error stays exactly `"Identifiants invalides."`** for every failure reason. The reason is recorded server-side only. Revealing it turns login into an oracle for which emails exist.
- **Recording a failure must never break login.** Every write is fire-and-forget inside a try/catch.
- A missing table (`PGRST205`) must produce a clear French message, never a 500.
- No new npm dependencies.
- Tests use `backend/tests/helpers/harness.js`.

## Deviation from the spec, and why

The spec lists three failure reasons: `unknown_email`, `bad_password`, `inactive_account`. The login query at `backend/routes/auth.js:146-151` already filters `.eq('active', 1)`, so an unknown email and a deactivated account land in the **same** `!user` branch. Telling them apart needs a second lookup on every failed login — precisely the request an attacker floods.

This plan therefore records **two** reasons: `unknown_or_inactive` and `bad_password`. No detection value is lost: the brute-force signal comes from request volume per IP, not from reason granularity.

## Verified prerequisites

Checked against the live database on 2026-08-06:

- `login_failures` — **does not exist** (`PGRST205`). Task 1 creates it; the user runs the SQL.
- `activity_logs` — exists, 501 rows, columns `clinic_id`, `user_id`, `action`, `details`, `ip_address`, `created_at`.
- 12 clinics, 21 users. JS-side aggregation is comfortable at this scale.

## File Structure

| File | Responsibility |
|---|---|
| `backend/utils/loginFailures.js` (create) | Record and query failed logins; never throws at the caller |
| `backend/routes/auth.js` (modify) | Call the recorder at the two failure branches |
| `backend/routes/platform-security.js` (create) | `GET /security/audit`, `/security/logins`, `/security/posture` |
| `backend/routes/cron.js` (modify) | 90-day purge |
| `backend/server.js` (modify) | Mount the new router |
| `backend/supabase_schema.sql` (modify) | Declare `login_failures` |
| `backend/tests/platform-security.test.js` (create) | Route tests |
| `backend/tests/login-failures.test.js` (create) | Recorder tests |
| `frontend/src/pages/PlatformAdmin/sections/SecuritySection.tsx` (create) | Section UI |
| `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx` (modify) | Wire the section |

---

### Task 1: `login_failures` table and recorder

**Files:**
- Create: `backend/utils/loginFailures.js`
- Create: `backend/tests/login-failures.test.js`
- Modify: `backend/supabase_schema.sql`

**Interfaces:**
- Consumes: `db`, `resetDb`, `stubModule`, `makeSupabaseStub`, `BACKEND` from `tests/helpers/harness.js`
- Produces:
  - `REASONS = { UNKNOWN_OR_INACTIVE: 'unknown_or_inactive', BAD_PASSWORD: 'bad_password' }`
  - `recordLoginFailure({ email, clinicId, reason, ip }): Promise<void>` — never rejects
  - `getRecentFailures(limitRows?: number): Promise<{ rows: Array, tableMissing: boolean }>`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/login-failures.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
const failures = require(path.join(BACKEND, 'utils/loginFailures.js'));

test('enregistre un echec avec son motif', async () => {
  resetDb();
  await failures.recordLoginFailure({
    email: 'inconnu@test.ci', clinicId: null,
    reason: failures.REASONS.UNKNOWN_OR_INACTIVE, ip: '10.0.0.1'
  });
  assert.strictEqual(db.login_failures.length, 1);
  assert.strictEqual(db.login_failures[0].email, 'inconnu@test.ci');
  assert.strictEqual(db.login_failures[0].reason, 'unknown_or_inactive');
});

test('n echoue JAMAIS, meme si la base rejette', async () => {
  resetDb();
  const { supabase } = require(path.join(BACKEND, 'database.js'));
  const original = supabase.from;
  supabase.from = () => { throw new Error('base injoignable'); };
  try {
    await failures.recordLoginFailure({ email: 'x@test.ci', reason: 'bad_password', ip: '1.1.1.1' });
  } finally {
    supabase.from = original;
  }
  // Aucune exception remontee : la connexion doit continuer a fonctionner.
  assert.ok(true);
});

test('ne stocke jamais le mot de passe tente', async () => {
  resetDb();
  await failures.recordLoginFailure({
    email: 'a@test.ci', reason: 'bad_password', ip: '1.1.1.1', password: 'motdepasse-secret'
  });
  const stored = JSON.stringify(db.login_failures[0]);
  assert.ok(!stored.includes('motdepasse-secret'), 'le mot de passe ne doit jamais etre stocke');
});

test('getRecentFailures signale une table absente sans lever', async () => {
  resetDb();
  const { supabase } = require(path.join(BACKEND, 'database.js'));
  const original = supabase.from;
  supabase.from = () => ({
    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }) }) })
  });
  try {
    const result = await failures.getRecentFailures(10);
    assert.strictEqual(result.tableMissing, true);
    assert.deepStrictEqual(result.rows, []);
  } finally {
    supabase.from = original;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/login-failures.test.js`
Expected: FAIL with `Cannot find module ...utils/loginFailures.js`

- [ ] **Step 3: Write the recorder**

Create `backend/utils/loginFailures.js`:

```js
// Journal des échecs de connexion, alimenté par POST /auth/login et lu par
// Platform Admin > Sécurité.
//
// Pourquoi une table dédiée plutôt qu'activity_logs : celle-ci impose
// clinic_id NOT NULL, or un échec sur un email inconnu n'a pas de clinique.
//
// Deux règles non négociables :
//  1. L'écriture ne doit JAMAIS casser la connexion. Tout est encapsulé dans
//     un try/catch et la fonction ne rejette pas.
//  2. Le mot de passe tenté n'est jamais stocké, ni son empreinte, ni sa
//     longueur. Seulement l'email, l'IP et le motif.
const { supabase } = require('../database');

const REASONS = {
  // La requête de connexion filtre déjà .eq('active', 1) : un email inconnu et
  // un compte désactivé sont indiscernables sans une seconde requête, que ce
  // chemin ne peut pas se permettre puisqu'un attaquant l'inonde.
  UNKNOWN_OR_INACTIVE: 'unknown_or_inactive',
  BAD_PASSWORD: 'bad_password'
};

const MISSING_RELATION_CODES = ['PGRST205', 'PGRST204', '42P01', '42703'];
const isMissingRelation = (error) => !!error && MISSING_RELATION_CODES.includes(error.code);

/**
 * Enregistre un échec. Ne rejette jamais.
 * Les propriétés non listées ici (mot de passe compris) sont ignorées.
 */
async function recordLoginFailure({ email, clinicId = null, reason, ip = null }) {
  try {
    await supabase.from('login_failures').insert({
      email: String(email || '').trim().toLowerCase(),
      clinic_id: clinicId,
      reason,
      ip_address: ip
    });
  } catch (error) {
    console.error('[LOGIN-FAILURES] Enregistrement impossible (connexion non affectée):', error.message);
  }
}

/**
 * @returns {Promise<{rows: Array, tableMissing: boolean}>}
 */
async function getRecentFailures(limitRows = 200) {
  try {
    const { data, error } = await supabase
      .from('login_failures')
      .select('id, email, clinic_id, reason, ip_address, created_at')
      .order('created_at', { ascending: false })
      .limit(limitRows);

    if (isMissingRelation(error)) return { rows: [], tableMissing: true };
    if (error) throw error;
    return { rows: data || [], tableMissing: false };
  } catch (error) {
    if (isMissingRelation(error)) return { rows: [], tableMissing: true };
    throw error;
  }
}

module.exports = { REASONS, recordLoginFailure, getRecentFailures, isMissingRelation };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/login-failures.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Declare the table**

Append to `backend/supabase_schema.sql`, after the `platform_settings` table:

```sql
-- 21. Login Failures Table (failed password logins, surfaced in Platform
-- Admin > Sécurité). Separate from activity_logs because that table requires
-- clinic_id NOT NULL and a failure against an unknown email has no clinic.
-- Successful logins are NOT duplicated here — they are already activity_logs
-- rows with action LOGIN / LOGIN_GOOGLE.
-- The attempted password is never stored, in any form.
-- Purged after 90 days by GET /api/cron/purge-login-failures.
CREATE TABLE login_failures (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,              -- normalised; may match no account
  clinic_id BIGINT REFERENCES clinics(id) ON DELETE CASCADE,  -- NULL when unknown
  reason TEXT NOT NULL,             -- unknown_or_inactive | bad_password
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_login_failures_created ON login_failures(created_at DESC);
CREATE INDEX idx_login_failures_ip ON login_failures(ip_address, created_at DESC);
```

- [ ] **Step 6: Commit**

```bash
git add backend/utils/loginFailures.js backend/tests/login-failures.test.js backend/supabase_schema.sql
git commit -m "feat(security): add the login-failure recorder"
```

---

### Task 2: Record failures from the login route

**Files:**
- Modify: `backend/routes/auth.js` (the `POST /login` handler, around lines 146-161)
- Create: `backend/tests/auth-login-failures.test.js`

**Interfaces:**
- Consumes: `recordLoginFailure`, `REASONS` from Task 1
- Produces: no new exports; the login response is byte-for-byte unchanged

- [ ] **Step 1: Write the failing test**

Create `backend/tests/auth-login-failures.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

process.env.JWT_SECRET = 'secret-de-test';
stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', { ...authStub(), JWT_SECRET: 'secret-de-test' });

let server;
let baseUrl;

test.before(async () => {
  server = await startApp([['/api/auth', require(path.join(BACKEND, 'routes/auth.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const login = (email, password) => fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

test('email inconnu : echec enregistre, message generique', async () => {
  resetDb();
  const res = await login('inconnu@test.ci', 'peu-importe');
  const body = await res.json();

  assert.strictEqual(res.status, 400);
  assert.strictEqual(body.error, 'Identifiants invalides.');
  assert.strictEqual(db.login_failures.length, 1);
  assert.strictEqual(db.login_failures[0].reason, 'unknown_or_inactive');
  assert.strictEqual(db.login_failures[0].email, 'inconnu@test.ci');
});

test('mot de passe faux : motif distinct, MEME message client', async () => {
  resetDb();
  const bcrypt = require(path.join(BACKEND, 'node_modules/bcryptjs'));
  db.users.push({
    id: 1, clinic_id: 1, email: 'admin@test.ci', active: 1,
    password_hash: bcrypt.hashSync('le-bon-mot-de-passe', 8), role: 'admin', name: 'Admin'
  });

  const res = await login('admin@test.ci', 'le-mauvais');
  const body = await res.json();

  assert.strictEqual(body.error, 'Identifiants invalides.', 'le message ne doit pas trahir le motif');
  assert.strictEqual(db.login_failures[0].reason, 'bad_password');
  assert.strictEqual(db.login_failures[0].clinic_id, 1, 'la clinique est connue dans ce cas');
});

test('l email est normalise avant enregistrement', async () => {
  resetDb();
  await login('  INCONNU@Test.CI  ', 'x');
  assert.strictEqual(db.login_failures[0].email, 'inconnu@test.ci');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/auth-login-failures.test.js`
Expected: FAIL — `db.login_failures.length` is 0, nothing records yet

- [ ] **Step 3: Wire the recorder into the login route**

In `backend/routes/auth.js`, add near the other requires:

```js
const { recordLoginFailure, REASONS } = require('../utils/loginFailures');
```

Replace the `!user` branch:

```js
    if (userError) throw userError;
    if (!user) {
      return res.status(400).json({ error: "Identifiants invalides." });
    }
```

with:

```js
    if (userError) throw userError;
    if (!user) {
      // Motif enregistré côté serveur uniquement — le message client reste
      // identique dans tous les cas, sinon il devient un oracle indiquant
      // quels emails existent.
      await recordLoginFailure({ email, reason: REASONS.UNKNOWN_OR_INACTIVE, ip: req.ip });
      return res.status(400).json({ error: "Identifiants invalides." });
    }
```

Replace the `!isMatch` branch:

```js
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: "Identifiants invalides." });
    }
```

with:

```js
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await recordLoginFailure({
        email, clinicId: user.clinic_id, reason: REASONS.BAD_PASSWORD, ip: req.ip
      });
      return res.status(400).json({ error: "Identifiants invalides." });
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/auth-login-failures.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Run the whole suite**

Run: `cd backend && npm test`
Expected: 0 fail. The existing PayPal and config tests must be untouched.

- [ ] **Step 6: Commit**

```bash
git add backend/routes/auth.js backend/tests/auth-login-failures.test.js
git commit -m "feat(security): record failed logins without changing the client response"
```

---

### Task 3: `GET /api/platform/security/logins`

**Files:**
- Create: `backend/routes/platform-security.js`
- Create: `backend/tests/platform-security.test.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `getRecentFailures` from Task 1
- Produces: `GET /api/platform/security/logins` returning
  `{ tableMissing: boolean, total24h: number, recent: Array<{id, email, clinicId, reason, ip, createdAt}>, topIps: Array<{ip: string, count: number, suspicious: boolean}>, topEmails: Array<{email: string, count: number}> }`

`suspicious` is `count > BRUTE_FORCE_THRESHOLD` within the last hour. `BRUTE_FORCE_THRESHOLD` is a module constant, value `10`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-security.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { db, resetDb, stubModule, makeSupabaseStub, authStub, startApp, BACKEND } = require('./helpers/harness');

stubModule('database.js', { supabase: makeSupabaseStub() });
stubModule('middleware/auth.js', authStub());
stubModule('middleware/superAdmin.js', {
  superAdminOnly: (_req, _res, next) => next(),
  SUPER_ADMIN_EMAILS: ['ops@test.ci']
});

let server;
let baseUrl;

test.before(async () => {
  server = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform-security.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const nowIso = (minutesAgo = 0) => new Date(Date.now() - minutesAgo * 60000).toISOString();

test('agrege les echecs par IP et signale le bourrage', async () => {
  resetDb();
  for (let i = 0; i < 12; i++) {
    db.login_failures.push({
      id: i + 1, email: `cible${i}@test.ci`, clinic_id: null,
      reason: 'unknown_or_inactive', ip_address: '203.0.113.9', created_at: nowIso(5)
    });
  }
  db.login_failures.push({
    id: 99, email: 'oubli@test.ci', clinic_id: 1,
    reason: 'bad_password', ip_address: '198.51.100.2', created_at: nowIso(5)
  });

  const body = await (await fetch(`${baseUrl}/api/platform/security/logins`)).json();

  const attacker = body.topIps.find((r) => r.ip === '203.0.113.9');
  const normal = body.topIps.find((r) => r.ip === '198.51.100.2');
  assert.strictEqual(attacker.count, 12);
  assert.strictEqual(attacker.suspicious, true, '12 echecs en une heure doit etre signale');
  assert.strictEqual(normal.suspicious, false, 'un seul echec ne doit pas etre signale');
});

test('un echec ancien ne declenche pas le signal de bourrage', async () => {
  resetDb();
  for (let i = 0; i < 12; i++) {
    db.login_failures.push({
      id: i + 1, email: 'x@test.ci', clinic_id: null,
      reason: 'bad_password', ip_address: '203.0.113.9', created_at: nowIso(180)
    });
  }
  const body = await (await fetch(`${baseUrl}/api/platform/security/logins`)).json();
  const row = body.topIps.find((r) => r.ip === '203.0.113.9');
  assert.strictEqual(row.suspicious, false, 'le seuil porte sur la derniere heure');
});

test('table absente : repond 200 avec tableMissing', async () => {
  resetDb();
  const { supabase } = require(path.join(BACKEND, 'database.js'));
  const original = supabase.from;
  supabase.from = () => ({
    select: () => ({ order: () => ({ limit: () => Promise.resolve({ data: null, error: { code: 'PGRST205' } }) }) })
  });
  try {
    const res = await fetch(`${baseUrl}/api/platform/security/logins`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.tableMissing, true);
    assert.deepStrictEqual(body.recent, []);
  } finally {
    supabase.from = original;
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-security.test.js`
Expected: FAIL with `Cannot find module ...routes/platform-security.js`

- [ ] **Step 3: Write the route module**

Create `backend/routes/platform-security.js`:

```js
// Section Sécurité du console Super Admin. Trois vues en lecture seule :
// journal d'audit inter-cliniques, échecs de connexion, posture de la
// plateforme. Monté sous /api/platform à côté de platform.js, qui n'est pas
// modifié.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly, SUPER_ADMIN_EMAILS } = require('../middleware/superAdmin');
const { getRecentFailures } = require('../utils/loginFailures');

router.use(auth, superAdminOnly);

// Au-delà de ce nombre d'échecs depuis une même IP en une heure, on parle de
// bourrage d'identifiants et non d'un mot de passe oublié.
const BRUTE_FORCE_THRESHOLD = 10;
const ONE_HOUR_MS = 3600 * 1000;

// GET /api/platform/security/logins
router.get('/security/logins', async (req, res) => {
  try {
    const { rows, tableMissing } = await getRecentFailures(500);

    if (tableMissing) {
      return res.json({ tableMissing: true, total24h: 0, recent: [], topIps: [], topEmails: [] });
    }

    const now = Date.now();
    const byIp = new Map();
    const byEmail = new Map();
    let total24h = 0;

    for (const row of rows) {
      const age = now - new Date(row.created_at).getTime();
      if (age <= 24 * ONE_HOUR_MS) total24h++;

      const ip = row.ip_address || 'inconnue';
      const ipEntry = byIp.get(ip) || { ip, count: 0, lastHour: 0 };
      ipEntry.count++;
      if (age <= ONE_HOUR_MS) ipEntry.lastHour++;
      byIp.set(ip, ipEntry);

      byEmail.set(row.email, (byEmail.get(row.email) || 0) + 1);
    }

    res.json({
      tableMissing: false,
      total24h,
      recent: rows.slice(0, 50).map((row) => ({
        id: row.id,
        email: row.email,
        clinicId: row.clinic_id,
        reason: row.reason,
        ip: row.ip_address,
        createdAt: row.created_at
      })),
      topIps: [...byIp.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map((entry) => ({
          ip: entry.ip,
          count: entry.count,
          suspicious: entry.lastHour > BRUTE_FORCE_THRESHOLD
        })),
      topEmails: [...byEmail.entries()]
        .map(([email, count]) => ({ email, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    });
  } catch (error) {
    console.error('[PLATFORM-SECURITY] Erreur de lecture des connexions:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture des échecs de connexion.' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-security.test.js`
Expected: PASS, 3 tests

- [ ] **Step 5: Mount the router**

In `backend/server.js`, after `const platformConfigRoutes = require('./routes/platform-config');` add:

```js
const platformSecurityRoutes = require('./routes/platform-security');
```

and after `app.use('/api/platform', platformConfigRoutes);` add:

```js
app.use('/api/platform', platformSecurityRoutes);
```

- [ ] **Step 6: Commit**

```bash
git add backend/routes/platform-security.js backend/tests/platform-security.test.js backend/server.js
git commit -m "feat(security): add the failed-login monitoring endpoint"
```

---

### Task 4: `GET /api/platform/security/audit`

**Files:**
- Modify: `backend/routes/platform-security.js`
- Modify: `backend/tests/platform-security.test.js`

**Interfaces:**
- Produces: `GET /api/platform/security/audit?clinicId=&action=&days=&page=` returning
  `{ rows: Array<{id, clinicId, clinicName, userId, userName, action, details, ip, createdAt, isPlatformAction: boolean}>, page: number, pageSize: number, hasMore: boolean, actions: string[] }`

`pageSize` is 50. `isPlatformAction` is true when `action` starts with `PLATFORM_`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/platform-security.test.js`:

```js
test('le journal d audit marque les actions Super Admin', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A' });
  db.users.push({ id: 7, clinic_id: 1, name: 'Ops', email: 'ops@test.ci' });
  db.activity_logs.push({
    id: 1, clinic_id: 1, user_id: 7, action: 'PLATFORM_SUSPEND',
    details: 'Clinique suspendue', ip_address: '1.1.1.1', created_at: nowIso(1)
  });
  db.activity_logs.push({
    id: 2, clinic_id: 1, user_id: 7, action: 'PATIENT_CREATE',
    details: 'Patient cree', ip_address: '1.1.1.1', created_at: nowIso(2)
  });

  const body = await (await fetch(`${baseUrl}/api/platform/security/audit`)).json();

  const platformRow = body.rows.find((r) => r.action === 'PLATFORM_SUSPEND');
  const clinicRow = body.rows.find((r) => r.action === 'PATIENT_CREATE');
  assert.strictEqual(platformRow.isPlatformAction, true);
  assert.strictEqual(clinicRow.isPlatformAction, false);
  assert.strictEqual(platformRow.clinicName, 'Clinique A');
  assert.strictEqual(platformRow.userName, 'Ops');
});

test('le journal d audit filtre par action', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A' });
  db.activity_logs.push({ id: 1, clinic_id: 1, user_id: null, action: 'LOGIN', details: '', created_at: nowIso(1) });
  db.activity_logs.push({ id: 2, clinic_id: 1, user_id: null, action: 'PATIENT_CREATE', details: '', created_at: nowIso(1) });

  const body = await (await fetch(`${baseUrl}/api/platform/security/audit?action=LOGIN`)).json();
  assert.strictEqual(body.rows.length, 1);
  assert.strictEqual(body.rows[0].action, 'LOGIN');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-security.test.js`
Expected: FAIL — the `/security/audit` route 404s

- [ ] **Step 3: Add the route**

In `backend/routes/platform-security.js`, before `module.exports`, add:

```js
const AUDIT_PAGE_SIZE = 50;

// GET /api/platform/security/audit
// Journal inter-cliniques. Volontairement hors du filtre clinic_id — c'est
// l'exception assumée de platform.js, voir CLAUDE.md.
router.get('/security/audit', async (req, res) => {
  try {
    const page = Math.max(0, parseInt(req.query.page, 10) || 0);
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

    let query = supabase
      .from('activity_logs')
      .select('id, clinic_id, user_id, action, details, ip_address, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (req.query.clinicId) query = query.eq('clinic_id', parseInt(req.query.clinicId, 10));
    if (req.query.action) query = query.eq('action', String(req.query.action));

    const { data: logs, error: logsError } = await query;
    if (logsError) throw logsError;

    const { data: clinics } = await supabase.from('clinics').select('id, name');
    const { data: users } = await supabase.from('users').select('id, name');
    const clinicNameById = new Map((clinics || []).map((c) => [c.id, c.name]));
    const userNameById = new Map((users || []).map((u) => [u.id, u.name]));

    const all = logs || [];
    const start = page * AUDIT_PAGE_SIZE;
    const slice = all.slice(start, start + AUDIT_PAGE_SIZE);

    res.json({
      rows: slice.map((row) => ({
        id: row.id,
        clinicId: row.clinic_id,
        clinicName: clinicNameById.get(row.clinic_id) || `Clinique ${row.clinic_id}`,
        userId: row.user_id,
        userName: userNameById.get(row.user_id) || null,
        action: row.action,
        details: row.details,
        ip: row.ip_address,
        // Sur ces lignes, la clinique du user_id et le clinic_id de la ligne
        // divergent volontairement : c'est un Super Admin agissant sur une
        // autre clinique. Sans ce marquage, ça se lit comme si la clinique
        // s'était modifiée elle-même.
        isPlatformAction: String(row.action || '').startsWith('PLATFORM_')
      })),
      page,
      pageSize: AUDIT_PAGE_SIZE,
      hasMore: start + AUDIT_PAGE_SIZE < all.length,
      actions: [...new Set(all.map((row) => row.action))].sort()
    });
  } catch (error) {
    console.error('[PLATFORM-SECURITY] Erreur de lecture du journal:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture du journal d\'audit.' });
  }
});
```

Note: the shared test harness's query builder ignores `gte` and `order`. Add a `gte()` passthrough to `backend/tests/helpers/harness.js` alongside `limit()` and `order()`:

```js
    gte() { return builder; },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-security.test.js`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add backend/routes/platform-security.js backend/tests/platform-security.test.js backend/tests/helpers/harness.js
git commit -m "feat(security): add the cross-clinic audit trail endpoint"
```

---

### Task 5: `GET /api/platform/security/posture`

**Files:**
- Modify: `backend/routes/platform-security.js`
- Modify: `backend/tests/platform-security.test.js`

**Interfaces:**
- Produces: `GET /api/platform/security/posture` returning
  `{ suspendedClinics: Array<{id, name}>, deactivatedUsers: number, clinicsWithoutActiveAdmin: Array<{id, name}>, googleOnlyAccounts: number, superAdminCount: number, rateLimitBackend: 'redis'|'memory' }`

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/platform-security.test.js`:

```js
test('la posture repere une clinique sans admin actif', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Avec admin', suspended_by_platform: false });
  db.clinics.push({ id: 2, name: 'Sans admin', suspended_by_platform: false });
  db.clinics.push({ id: 3, name: 'Suspendue', suspended_by_platform: true });
  db.users.push({ id: 1, clinic_id: 1, role: 'admin', active: 1, password_set: true });
  db.users.push({ id: 2, clinic_id: 2, role: 'doctor', active: 1, password_set: true });
  db.users.push({ id: 3, clinic_id: 2, role: 'admin', active: 0, password_set: true });
  db.users.push({ id: 4, clinic_id: 1, role: 'doctor', active: 1, password_set: false });

  const body = await (await fetch(`${baseUrl}/api/platform/security/posture`)).json();

  assert.deepStrictEqual(body.clinicsWithoutActiveAdmin.map((c) => c.id), [2, 3]);
  assert.deepStrictEqual(body.suspendedClinics.map((c) => c.id), [3]);
  assert.strictEqual(body.deactivatedUsers, 1);
  assert.strictEqual(body.googleOnlyAccounts, 1);
  assert.strictEqual(body.superAdminCount, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-security.test.js`
Expected: FAIL — the `/security/posture` route 404s

- [ ] **Step 3: Add the route**

In `backend/routes/platform-security.js`, before `module.exports`, add:

```js
const isSet = (name) => !!(process.env[name] || '').trim();

// GET /api/platform/security/posture
router.get('/security/posture', async (req, res) => {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, suspended_by_platform');
    if (clinicsError) throw clinicsError;

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, clinic_id, role, active, password_set');
    if (usersError) throw usersError;

    const activeAdminClinicIds = new Set(
      (users || []).filter((u) => u.role === 'admin' && u.active === 1).map((u) => u.clinic_id)
    );

    res.json({
      suspendedClinics: (clinics || [])
        .filter((c) => c.suspended_by_platform)
        .map((c) => ({ id: c.id, name: c.name })),
      // Une clinique sans admin actif ne peut plus gérer son propre personnel
      // ni son abonnement : elle est enfermée dehors.
      clinicsWithoutActiveAdmin: (clinics || [])
        .filter((c) => !activeAdminClinicIds.has(c.id))
        .map((c) => ({ id: c.id, name: c.name })),
      deactivatedUsers: (users || []).filter((u) => u.active === 0).length,
      // Comptes Google n'ayant jamais défini de mot de passe : ils dépendent
      // entièrement de Google, et deviennent inaccessibles si GOOGLE_CLIENT_ID
      // est retiré.
      googleOnlyAccounts: (users || []).filter((u) => u.password_set === false).length,
      superAdminCount: SUPER_ADMIN_EMAILS.length,
      // En mémoire sur Vercel, la limitation est par instance et remise à zéro
      // à chaque démarrage à froid — donc quasi inexistante.
      rateLimitBackend: isSet('UPSTASH_REDIS_REST_URL') && isSet('UPSTASH_REDIS_REST_TOKEN') ? 'redis' : 'memory'
    });
  } catch (error) {
    console.error('[PLATFORM-SECURITY] Erreur de lecture de la posture:', error);
    res.status(500).json({ error: 'Erreur lors de la lecture de la posture de sécurité.' });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-security.test.js`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add backend/routes/platform-security.js backend/tests/platform-security.test.js
git commit -m "feat(security): add the platform security posture endpoint"
```

---

### Task 6: 90-day purge of `login_failures`

**Files:**
- Modify: `backend/routes/cron.js`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `requireCronSecret` (already defined in `cron.js`)
- Produces: `GET /api/cron/purge-login-failures` returning `{ success: true, deleted: number }`

- [ ] **Step 1: Add the route**

In `backend/routes/cron.js`, before `module.exports`, add:

```js
// GET /api/cron/purge-login-failures
// Sans purge, login_failures grossit sans fin. 90 jours couvrent largement
// toute analyse d'incident rétrospective.
router.get('/purge-login-failures', requireCronSecret, async (req, res) => {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('login_failures')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      // Table absente : rien à purger, ce n'est pas un échec du cron.
      if (['PGRST205', '42P01'].includes(error.code)) {
        return res.json({ success: true, deleted: 0, tableMissing: true });
      }
      throw error;
    }

    res.json({ success: true, deleted: (data || []).length });
  } catch (error) {
    console.error('[CRON] Purge des échecs de connexion impossible:', error);
    res.status(500).json({ error: 'Erreur lors de la purge.' });
  }
});
```

Verify `supabase` is already required at the top of `cron.js`; if not, add `const { supabase } = require('../database');`.

- [ ] **Step 2: Schedule it**

In `vercel.json`, add to the existing `crons` array:

```json
    { "path": "/api/cron/purge-login-failures", "schedule": "30 3 * * *" }
```

- [ ] **Step 3: Verify the route responds**

Run: `cd backend && VERCEL=1 node -e "require('./server.js'); console.log('routes chargees')"`
Expected: `routes chargees`, no error

- [ ] **Step 4: Commit**

```bash
git add backend/routes/cron.js vercel.json
git commit -m "feat(security): purge login failures older than 90 days"
```

---

### Task 7: `SecuritySection.tsx` and sidebar wiring

**Files:**
- Create: `frontend/src/pages/PlatformAdmin/sections/SecuritySection.tsx`
- Modify: `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`

**Interfaces:**
- Consumes: the three endpoints from Tasks 3-5; `api` from `frontend/src/utils/api.ts`; `useNotifications` from `frontend/src/contexts/NotificationContext` (**plural** — the export is `useNotifications`, not `useNotification`)
- Produces: `SecuritySection` default-exported React component taking no props

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/PlatformAdmin/sections/SecuritySection.tsx` with three tabs — `Connexions`, `Journal d'audit`, `Posture` — following the card/Row/badge shape already used by `SystemConfigSection.tsx` in the same folder. Read that file first and reuse its `Row` and `Status` helpers by copying them; do not import across sections, since the two will diverge.

Required behaviours:

```tsx
// Onglet Connexions
// - `tableMissing` affiche « Migration à exécuter » avec le SQL, pas un vide.
// - Une IP `suspicious` est mise en évidence en rouge avec la mention
//   « bourrage d'identifiants probable ».
// - Le motif est traduit pour l'affichage :
const REASON_LABELS: Record<string, string> = {
  unknown_or_inactive: 'Email inconnu ou compte désactivé',
  bad_password: 'Mot de passe incorrect'
};

// Onglet Journal d'audit
// - Filtres : clinique (liste), action (liste renvoyée par l'API), période
//   (7 / 30 / 90 jours). Pagination via `page` et `hasMore`.
// - Une ligne `isPlatformAction` porte un badge « Super Admin » distinct.

// Onglet Posture
// - `rateLimitBackend === 'memory'` s'affiche en avertissement explicite :
//   « Par instance, remise à zéro à chaque démarrage à froid — protection
//   quasi inexistante en serverless. »
// - `clinicsWithoutActiveAdmin` non vide est un avertissement : ces cliniques
//   ne peuvent plus gérer leur personnel ni leur abonnement.
```

- [ ] **Step 2: Wire it into the sidebar**

In `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`:

Add the import:

```tsx
import SecuritySection from './sections/SecuritySection';
```

Add `'security'` to the `Section` union type at line 107.

Add to `navItems`, before the `system` entry:

```tsx
    { id: 'security', label: 'Sécurité', icon: Shield },
```

Remove the `Sécurité` line from `comingSoonItems`, leaving only `Rapports`.

Add to `sectionTitles`:

```tsx
    security: 'Sécurité de la plateforme',
```

Add to the section-rendering block:

```tsx
              {section === 'security' && <SecuritySection />}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: no output

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: no new warnings naming `SecuritySection` or `PlatformAdminPage`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PlatformAdmin/
git commit -m "feat(security): ship the Sécurité section"
```

---

### Task 8: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the architecture notes**

In the "Cross-clinic platform admin" section, move `Sécurité` out of the disabled list, leaving only `Rapports`. Add a subsection after "System configuration inspector" describing: the `login_failures` table and why it cannot live in `activity_logs`; the two-reason model and why the spec's three collapsed to two; the rule that the client error stays `"Identifiants invalides."` for every reason; the fire-and-forget write; and the 90-day cron purge.

Add `login_failures` to the table list in the "Data layer" section, and record it in the schema-drift section as a genuinely pending migration — **verified absent on the live database on 2026-08-06** (`PGRST205`).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the Sécurité section"
```

---

## Migration to run by hand

**Verified absent on the live database (`PGRST205`, 2026-08-06.)** Run in the Supabase SQL Editor before Task 2 ships, otherwise failures are silently not recorded — login keeps working, but the section stays empty:

```sql
CREATE TABLE login_failures (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  email TEXT NOT NULL,
  clinic_id BIGINT REFERENCES clinics(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_login_failures_created ON login_failures(created_at DESC);
CREATE INDEX idx_login_failures_ip ON login_failures(ip_address, created_at DESC);
```
