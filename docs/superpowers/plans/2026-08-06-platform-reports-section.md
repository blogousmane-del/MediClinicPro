# Platform Admin — Rapports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the disabled "Rapports" sidebar entry with a working section carrying two tabs — Revenus (default) and Adoption — built only from data that already exists.

**Architecture:** One new backend route module (`platform-reports.js`) mounted under `/api/platform` behind `auth` + `superAdminOnly`, two hand-rolled SVG chart components, and one frontend section with two tabs. Follows the shape established by `platform-config.js` and `platform-security.js`.

**Tech Stack:** Express 4, `@supabase/supabase-js` (PostgREST), React 19 + TypeScript, plain CSS, inline SVG, `node --test`.

Spec: `docs/superpowers/specs/2026-08-06-platform-admin-sections-design.md`

## Global Constraints

- All user-facing strings are in French.
- Gated by `router.use(auth, superAdminOnly)` at module top.
- **No fabricated figures.** Every number on screen traces to a real row. Where a number is a proxy rather than a measurement, the UI says so. This repo has a standing rule against invented stats (CLAUDE.md, Banani section).
- **No charting dependency.** Platform Admin ships in the bundle every clinic downloads, often over mobile connections in Côte d'Ivoire. Charts are inline SVG, theme-aware via the HSL custom properties in `index.css`.
- No new npm dependencies.
- Tests use `backend/tests/helpers/harness.js`.

## Verified data available

Checked against the live database on 2026-08-06 — no new table is needed for this plan:

| Table | Rows | Columns used |
|---|---|---|
| `subscription_payments` | 20 | `clinic_id`, `plan`, `months`, `amount`, `provider`, `status`, `created_at`, `paid_at` |
| `clinics` | 12 | `plan`, `subscription_status`, `subscription_expires_at`, `created_at` |
| `users` | 21 | `role`, `active`, `clinic_id` |
| `patients` | 7 | `clinic_id`, `archived` |
| `consultations` | 4 | `clinic_id`, **`date_time`** — this table has no `created_at` |
| `activity_logs` | 501 | `clinic_id`, `created_at` |
| `support_tickets` | 4 | `category`, `status` |

At this scale, fetching rows and aggregating in JS — the pattern already used by `GET /api/platform/overview` (`platform.js:60-68`) — is comfortable. Recorded as identified debt: past roughly ten thousand rows this needs a Postgres RPC.

## File Structure

| File | Responsibility |
|---|---|
| `frontend/src/pages/PlatformAdmin/components/BarChart.tsx` (create) | Vertical bar chart, inline SVG |
| `frontend/src/pages/PlatformAdmin/components/DonutChart.tsx` (create) | Donut chart with legend, inline SVG |
| `backend/routes/platform-reports.js` (create) | `GET /reports/revenue`, `GET /reports/adoption` |
| `backend/server.js` (modify) | Mount the new router |
| `backend/tests/platform-reports.test.js` (create) | Route tests |
| `frontend/src/pages/PlatformAdmin/sections/ReportsSection.tsx` (create) | Two-tab section UI |
| `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx` (modify) | Wire the section, empty `comingSoonItems` |
| `CLAUDE.md` (modify) | Documentation |

---

### Task 1: SVG chart components

**Files:**
- Create: `frontend/src/pages/PlatformAdmin/components/BarChart.tsx`
- Create: `frontend/src/pages/PlatformAdmin/components/DonutChart.tsx`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `BarChart` — props `{ data: Array<{label: string, value: number}>, height?: number, formatValue?: (n: number) => string }`, default export
  - `DonutChart` — props `{ data: Array<{label: string, value: number}>, size?: number, formatValue?: (n: number) => string }`, default export

- [ ] **Step 1: Create BarChart**

Create `frontend/src/pages/PlatformAdmin/components/BarChart.tsx`:

```tsx
import React from 'react';

interface BarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  formatValue?: (n: number) => string;
}

// Graphique en barres dessiné à la main en SVG inline. Pas de bibliothèque :
// Platform Admin voyage dans le même bundle que l'app des cliniques, souvent
// ouverte en mobile sur réseau ivoirien. Les couleurs viennent des variables
// CSS pour suivre le thème clair/sombre.
export const BarChart: React.FC<BarChartProps> = ({ data, height = 160, formatValue }) => {
  if (data.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucune donnée sur la période.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        role="img"
        aria-label="Graphique en barres"
      >
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (height - 24);
          return (
            <rect
              key={item.label}
              x={index * barWidth + barWidth * 0.15}
              y={height - 20 - barHeight}
              width={barWidth * 0.7}
              height={Math.max(barHeight, item.value > 0 ? 1 : 0)}
              fill="var(--primary, hsl(174 60% 35%))"
              rx="0.6"
            >
              <title>{`${item.label} : ${formatValue ? formatValue(item.value) : item.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div style={{ display: 'flex', width: '100%' }}>
        {data.map((item) => (
          <span
            key={item.label}
            style={{
              width: `${barWidth}%`,
              textAlign: 'center',
              fontSize: '0.62rem',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              whiteSpace: 'nowrap'
            }}
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default BarChart;
```

- [ ] **Step 2: Create DonutChart**

Create `frontend/src/pages/PlatformAdmin/components/DonutChart.tsx`:

```tsx
import React from 'react';

interface DonutChartProps {
  data: { label: string; value: number }[];
  size?: number;
  formatValue?: (n: number) => string;
}

// Palette fixe et distinguable, cohérente entre les graphiques de la section.
const COLORS = [
  'hsl(174 60% 35%)',
  'hsl(210 70% 50%)',
  'hsl(38 85% 55%)',
  'hsl(340 60% 55%)',
  'hsl(265 55% 58%)'
];

// Donut en SVG inline : un seul cercle par tranche, dessiné avec
// stroke-dasharray. Aucune bibliothèque, voir BarChart pour le pourquoi.
export const DonutChart: React.FC<DonutChartProps> = ({ data, size = 140, formatValue }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Aucune donnée.</p>;
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 160 160" style={{ width: size, height: size, flexShrink: 0 }} role="img" aria-label="Répartition">
        {data.map((item, index) => {
          const fraction = item.value / total;
          const dash = fraction * circumference;
          const circle = (
            <circle
              key={item.label}
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={COLORS[index % COLORS.length]}
              strokeWidth="22"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            >
              <title>{`${item.label} : ${formatValue ? formatValue(item.value) : item.value}`}</title>
            </circle>
          );
          offset += dash;
          return circle;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: 0 }}>
        {data.map((item, index) => (
          <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '0.78rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                backgroundColor: COLORS[index % COLORS.length],
                flexShrink: 0
              }}
            />
            {item.label} — {formatValue ? formatValue(item.value) : item.value}
          </span>
        ))}
      </div>
    </div>
  );
};

export default DonutChart;
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PlatformAdmin/components/
git commit -m "feat(reports): add dependency-free SVG bar and donut charts"
```

---

### Task 2: `GET /api/platform/reports/revenue`

**Files:**
- Create: `backend/routes/platform-reports.js`
- Create: `backend/tests/platform-reports.test.js`
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `getPlan` from `backend/utils/plans.js`
- Produces: `GET /api/platform/reports/revenue` returning
  `{ monthlyRevenue: Array<{label: string, value: number}>, mrr: number, collectedThisMonth: number, planDistribution: Array<{label: string, value: number}>, renewalsDue: Array<{clinicId, clinicName, plan, expiresAt}>, expiredNotRenewed: Array<{clinicId, clinicName, plan, expiresAt}>, stuckPayments: Array<{id, clinicId, clinicName, amount, provider, createdAt}>, failedThisMonth: number, providerMix: Array<{label: string, value: number}> }`

Amounts are FCFA. `stuckPayments` are `status='pending'` rows older than one hour.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/platform-reports.test.js`:

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
  server = await startApp([['/api/platform', require(path.join(BACKEND, 'routes/platform-reports.js'))]]);
  baseUrl = server.baseUrl;
});

test.after(() => server.close());

const isoAgo = (ms) => new Date(Date.now() - ms).toISOString();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

test('le recurrent ne se confond pas avec la somme encaissee', async () => {
  resetDb();
  // Une clinique Hopital active (14 500/mois) qui a payé 12 mois d'avance.
  db.clinics.push({
    id: 1, name: 'Clinique A', plan: 'hopital',
    subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 300 * DAY).toISOString(),
    created_at: isoAgo(400 * DAY)
  });
  db.subscription_payments.push({
    id: 1, clinic_id: 1, plan: 'hopital', months: 12, amount: 174000,
    provider: 'bictorys', status: 'paid', created_at: isoAgo(2 * DAY), paid_at: isoAgo(2 * DAY)
  });

  const body = await (await fetch(`${baseUrl}/api/platform/reports/revenue`)).json();

  assert.strictEqual(body.collectedThisMonth, 174000, 'encaissé ce mois-ci');
  assert.strictEqual(body.mrr, 14500, 'le récurrent est le prix du plan, pas les 12 mois encaissés');
});

test('remonte les paiements bloques de plus d une heure', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A', plan: 'hopital', subscription_status: 'expired' });
  db.subscription_payments.push({
    id: 1, clinic_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'paypal', status: 'pending', created_at: isoAgo(3 * HOUR)
  });
  db.subscription_payments.push({
    id: 2, clinic_id: 1, plan: 'hopital', months: 1, amount: 14500,
    provider: 'paypal', status: 'pending', created_at: isoAgo(10 * 60 * 1000)
  });

  const body = await (await fetch(`${baseUrl}/api/platform/reports/revenue`)).json();

  assert.strictEqual(body.stuckPayments.length, 1, 'seul le paiement de plus d une heure compte');
  assert.strictEqual(body.stuckPayments[0].id, 1);
  assert.strictEqual(body.stuckPayments[0].clinicName, 'Clinique A');
});

test('separe renouvellements a venir et cliniques expirees', async () => {
  resetDb();
  db.clinics.push({
    id: 1, name: 'Bientot', plan: 'clinique',
    subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 10 * DAY).toISOString()
  });
  db.clinics.push({
    id: 2, name: 'Expiree', plan: 'clinique',
    subscription_status: 'expired', subscription_expires_at: isoAgo(10 * DAY)
  });
  db.clinics.push({
    id: 3, name: 'Lointaine', plan: 'hopital',
    subscription_status: 'active', subscription_expires_at: new Date(Date.now() + 200 * DAY).toISOString()
  });

  const body = await (await fetch(`${baseUrl}/api/platform/reports/revenue`)).json();

  assert.deepStrictEqual(body.renewalsDue.map((r) => r.clinicId), [1]);
  assert.deepStrictEqual(body.expiredNotRenewed.map((r) => r.clinicId), [2]);
});

test('les cliniques Starter ne comptent pas dans le recurrent', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Gratuite', plan: 'starter', subscription_status: 'active' });
  const body = await (await fetch(`${baseUrl}/api/platform/reports/revenue`)).json();
  assert.strictEqual(body.mrr, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-reports.test.js`
Expected: FAIL with `Cannot find module ...routes/platform-reports.js`

- [ ] **Step 3: Write the route module**

Create `backend/routes/platform-reports.js`:

```js
// Section Rapports du console Super Admin. Deux vues en lecture seule :
// Revenus et Adoption. Aucune donnée inventée — chaque chiffre remonte à des
// lignes réelles, et tout ce qui est un indice plutôt qu'une mesure est
// libellé comme tel côté interface.
//
// Agrégation en JS à partir de select simples, comme /api/platform/overview.
// Voir le plan pour la limite d'échelle assumée.
const express = require('express');
const router = express.Router();
const { supabase } = require('../database');
const { auth } = require('../middleware/auth');
const { superAdminOnly } = require('../middleware/superAdmin');
const { getPlan } = require('../utils/plans');

router.use(auth, superAdminOnly);

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MONTH_LABELS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

// Douze compartiments mensuels, du plus ancien au mois courant.
function emptyMonthBuckets() {
  const buckets = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: MONTH_LABELS[date.getMonth()],
      value: 0
    });
  }
  return buckets;
}

function fillMonthBuckets(rows, dateField) {
  const buckets = emptyMonthBuckets();
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const row of rows) {
    const raw = row[dateField];
    if (!raw) continue;
    const date = new Date(raw);
    const bucket = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (bucket) bucket.value += row._weight === undefined ? 1 : row._weight;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

// GET /api/platform/reports/revenue
router.get('/reports/revenue', async (req, res) => {
  try {
    const { data: clinics, error: clinicsError } = await supabase
      .from('clinics')
      .select('id, name, plan, subscription_status, subscription_expires_at, created_at');
    if (clinicsError) throw clinicsError;

    const { data: payments, error: paymentsError } = await supabase
      .from('subscription_payments')
      .select('id, clinic_id, plan, months, amount, provider, status, created_at, paid_at');
    if (paymentsError) throw paymentsError;

    const clinicNameById = new Map((clinics || []).map((c) => [c.id, c.name]));
    const now = Date.now();
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const paid = (payments || []).filter((p) => p.status === 'paid');

    // Revenu mensuel : somme encaissée, datée du règlement et non de
    // l'initiation du checkout.
    const monthlyRevenue = fillMonthBuckets(
      paid.map((p) => ({ paid_at: p.paid_at, _weight: Number(p.amount) || 0 })),
      'paid_at'
    );

    // Récurrent : dérivé des cliniques actives et de leur plan, PAS de la somme
    // encaissée. Les abonnements se paient d'avance sur 1 à 12 mois ; encaisser
    // 12 mois en janvier ne fait pas un janvier à 174 000 FCFA de récurrent.
    const mrr = (clinics || [])
      .filter((c) => c.subscription_status === 'active')
      .reduce((sum, c) => sum + (getPlan(c.plan).price || 0), 0);

    const collectedThisMonth = paid
      .filter((p) => p.paid_at && new Date(p.paid_at).getTime() >= startOfMonth)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const planCounts = new Map();
    for (const clinic of clinics || []) {
      const name = getPlan(clinic.plan).name;
      planCounts.set(name, (planCounts.get(name) || 0) + 1);
    }

    const providerCounts = new Map();
    for (const payment of paid) {
      const name = payment.provider || 'inconnu';
      providerCounts.set(name, (providerCounts.get(name) || 0) + 1);
    }

    const toRow = (clinic) => ({
      clinicId: clinic.id,
      clinicName: clinic.name,
      plan: getPlan(clinic.plan).name,
      expiresAt: clinic.subscription_expires_at
    });

    res.json({
      monthlyRevenue,
      mrr,
      collectedThisMonth,
      planDistribution: [...planCounts.entries()].map(([label, value]) => ({ label, value })),
      renewalsDue: (clinics || [])
        .filter((c) => {
          if (!c.subscription_expires_at) return false;
          const expiry = new Date(c.subscription_expires_at).getTime();
          return expiry >= now && expiry <= now + 30 * DAY_MS;
        })
        .sort((a, b) => new Date(a.subscription_expires_at) - new Date(b.subscription_expires_at))
        .map(toRow),
      expiredNotRenewed: (clinics || [])
        .filter((c) => {
          if (!c.subscription_expires_at) return false;
          return new Date(c.subscription_expires_at).getTime() < now && c.subscription_status !== 'active';
        })
        .map(toRow),
      // Détecteur du scénario « argent pris, rien crédité » : une ligne pending
      // de plus d'une heure signifie qu'aucun webhook n'est jamais arrivé.
      stuckPayments: (payments || [])
        .filter((p) => p.status === 'pending' && now - new Date(p.created_at).getTime() > HOUR_MS)
        .map((p) => ({
          id: p.id,
          clinicId: p.clinic_id,
          clinicName: clinicNameById.get(p.clinic_id) || `Clinique ${p.clinic_id}`,
          amount: Number(p.amount) || 0,
          provider: p.provider,
          createdAt: p.created_at
        })),
      failedThisMonth: (payments || []).filter(
        (p) => p.status === 'failed' && new Date(p.created_at).getTime() >= startOfMonth
      ).length,
      providerMix: [...providerCounts.entries()].map(([label, value]) => ({ label, value }))
    });
  } catch (error) {
    console.error('[PLATFORM-REPORTS] Erreur de calcul des revenus:', error);
    res.status(500).json({ error: 'Erreur lors du calcul des revenus.' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-reports.test.js`
Expected: PASS, 4 tests

- [ ] **Step 5: Mount the router**

In `backend/server.js`, after the other platform requires add:

```js
const platformReportsRoutes = require('./routes/platform-reports');
```

and after the other platform mounts add:

```js
app.use('/api/platform', platformReportsRoutes);
```

- [ ] **Step 6: Commit**

```bash
git add backend/routes/platform-reports.js backend/tests/platform-reports.test.js backend/server.js
git commit -m "feat(reports): add the revenue report endpoint"
```

---

### Task 3: `GET /api/platform/reports/adoption`

**Files:**
- Modify: `backend/routes/platform-reports.js`
- Modify: `backend/tests/platform-reports.test.js`

**Interfaces:**
- Produces: `GET /api/platform/reports/adoption` returning
  `{ activeClinics: number, dormantClinics: number, perClinic: Array<{clinicId, clinicName, plan, patients, consultations, activeUsers, lastActivityAt}>, newClinicsPerMonth: Array<{label, value}>, rolesFilled: Array<{label, value}>, ticketsByCategory: Array<{label, value}>, ticketsByStatus: Array<{label, value}> }`

A clinic is *active* when it has at least one `activity_logs` row in the last 30 days.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/platform-reports.test.js`:

```js
test('classe les cliniques actives et dormantes sur 30 jours', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Active', plan: 'hopital', created_at: isoAgo(100 * DAY) });
  db.clinics.push({ id: 2, name: 'Dormante', plan: 'clinique', created_at: isoAgo(100 * DAY) });
  db.activity_logs.push({ id: 1, clinic_id: 1, action: 'PATIENT_CREATE', created_at: isoAgo(3 * DAY) });
  db.activity_logs.push({ id: 2, clinic_id: 2, action: 'PATIENT_CREATE', created_at: isoAgo(90 * DAY) });

  const body = await (await fetch(`${baseUrl}/api/platform/reports/adoption`)).json();

  assert.strictEqual(body.activeClinics, 1);
  assert.strictEqual(body.dormantClinics, 1);
});

test('compte patients, consultations et utilisateurs actifs par clinique', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'Clinique A', plan: 'hopital', created_at: isoAgo(50 * DAY) });
  db.patients.push({ id: 1, clinic_id: 1, archived: 0 });
  db.patients.push({ id: 2, clinic_id: 1, archived: 0 });
  db.consultations.push({ id: 1, clinic_id: 1, date_time: isoAgo(2 * DAY) });
  db.users.push({ id: 1, clinic_id: 1, role: 'admin', active: 1 });
  db.users.push({ id: 2, clinic_id: 1, role: 'doctor', active: 0 });

  const body = await (await fetch(`${baseUrl}/api/platform/reports/adoption`)).json();
  const row = body.perClinic.find((r) => r.clinicId === 1);

  assert.strictEqual(row.patients, 2);
  assert.strictEqual(row.consultations, 1);
  assert.strictEqual(row.activeUsers, 1, 'les comptes desactives ne comptent pas');
});

test('agrege les roles reellement pourvus', async () => {
  resetDb();
  db.clinics.push({ id: 1, name: 'A', plan: 'hopital' });
  db.users.push({ id: 1, clinic_id: 1, role: 'pharmacist', active: 1 });
  db.users.push({ id: 2, clinic_id: 1, role: 'pharmacist', active: 1 });
  db.users.push({ id: 3, clinic_id: 1, role: 'lab_tech', active: 1 });

  const body = await (await fetch(`${baseUrl}/api/platform/reports/adoption`)).json();
  const pharmacists = body.rolesFilled.find((r) => r.label === 'pharmacist');

  assert.strictEqual(pharmacists.value, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/platform-reports.test.js`
Expected: FAIL — the `/reports/adoption` route 404s

- [ ] **Step 3: Add the route**

In `backend/routes/platform-reports.js`, before `module.exports`, add:

```js
// GET /api/platform/reports/adoption
router.get('/reports/adoption', async (req, res) => {
  try {
    const [clinicsRes, usersRes, patientsRes, consultationsRes, logsRes, ticketsRes] = await Promise.all([
      supabase.from('clinics').select('id, name, plan, created_at'),
      supabase.from('users').select('id, clinic_id, role, active'),
      supabase.from('patients').select('id, clinic_id, archived'),
      // Cette table n'a PAS de created_at : la tendance repose sur date_time,
      // la date du rendez-vous, pas celle de la saisie.
      supabase.from('consultations').select('id, clinic_id, date_time'),
      supabase.from('activity_logs').select('clinic_id, created_at'),
      supabase.from('support_tickets').select('id, category, status')
    ]);

    for (const result of [clinicsRes, usersRes, patientsRes, consultationsRes, logsRes, ticketsRes]) {
      if (result.error) throw result.error;
    }

    const clinics = clinicsRes.data || [];
    const users = usersRes.data || [];
    const now = Date.now();
    const activeSince = now - 30 * DAY_MS;

    const lastActivityByClinic = new Map();
    for (const log of logsRes.data || []) {
      const at = new Date(log.created_at).getTime();
      const previous = lastActivityByClinic.get(log.clinic_id) || 0;
      if (at > previous) lastActivityByClinic.set(log.clinic_id, at);
    }

    const countBy = (rows, key) => {
      const map = new Map();
      for (const row of rows) map.set(row[key], (map.get(row[key]) || 0) + 1);
      return map;
    };

    const patientsByClinic = countBy(patientsRes.data || [], 'clinic_id');
    const consultationsByClinic = countBy(consultationsRes.data || [], 'clinic_id');
    const activeUsersByClinic = countBy(users.filter((u) => u.active === 1), 'clinic_id');

    const activeClinics = clinics.filter((c) => (lastActivityByClinic.get(c.id) || 0) >= activeSince);

    const roleCounts = countBy(users.filter((u) => u.active === 1), 'role');
    const ticketCategoryCounts = countBy(ticketsRes.data || [], 'category');
    const ticketStatusCounts = countBy(ticketsRes.data || [], 'status');
    const toPairs = (map) => [...map.entries()].map(([label, value]) => ({ label: String(label), value }));

    res.json({
      activeClinics: activeClinics.length,
      dormantClinics: clinics.length - activeClinics.length,
      perClinic: clinics.map((clinic) => ({
        clinicId: clinic.id,
        clinicName: clinic.name,
        plan: getPlan(clinic.plan).name,
        patients: patientsByClinic.get(clinic.id) || 0,
        consultations: consultationsByClinic.get(clinic.id) || 0,
        activeUsers: activeUsersByClinic.get(clinic.id) || 0,
        lastActivityAt: lastActivityByClinic.has(clinic.id)
          ? new Date(lastActivityByClinic.get(clinic.id)).toISOString()
          : null
      })),
      newClinicsPerMonth: fillMonthBuckets(clinics, 'created_at'),
      // Indice, pas mesure : rien dans ce dépôt ne trace l'usage par module.
      // L'interface doit le libeller comme tel.
      rolesFilled: toPairs(roleCounts),
      ticketsByCategory: toPairs(ticketCategoryCounts),
      ticketsByStatus: toPairs(ticketStatusCounts)
    });
  } catch (error) {
    console.error('[PLATFORM-REPORTS] Erreur de calcul de l\'adoption:', error);
    res.status(500).json({ error: 'Erreur lors du calcul de l\'adoption.' });
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/platform-reports.test.js`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add backend/routes/platform-reports.js backend/tests/platform-reports.test.js
git commit -m "feat(reports): add the adoption report endpoint"
```

---

### Task 4: `ReportsSection.tsx` and sidebar wiring

**Files:**
- Create: `frontend/src/pages/PlatformAdmin/sections/ReportsSection.tsx`
- Modify: `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`

**Interfaces:**
- Consumes: `BarChart`, `DonutChart` from Task 1; the two endpoints from Tasks 2-3; `api` from `frontend/src/utils/api.ts`; `useNotifications` from `frontend/src/contexts/NotificationContext` (**plural**)
- Produces: `ReportsSection` default-exported React component taking no props

- [ ] **Step 1: Create the component**

Create `frontend/src/pages/PlatformAdmin/sections/ReportsSection.tsx`. Two internal tabs held in local state, `'revenus'` shown first. Read `SystemConfigSection.tsx` in the same folder first and reuse its card/`Row` shape by copying it.

Required behaviours, each mandated by the spec:

```tsx
// Onglet Revenus
// - Deux grands chiffres COTE A COTE, avec cette phrase entre eux, obligatoire :
//   « Le récurrent est calculé depuis les cliniques actives et leur plan.
//     L'encaissé correspond aux règlements du mois : les abonnements se paient
//     d'avance sur 1 à 12 mois, les deux chiffres diffèrent donc normalement. »
// - monthlyRevenue -> <BarChart formatValue={(n) => `${n.toLocaleString()} FCFA`} />
// - planDistribution et providerMix -> <DonutChart />
// - stuckPayments : tableau mis en évidence si non vide, titré
//   « Paiements bloqués — webhook jamais reçu », avec la phrase
//   « L'argent a pu être débité sans que l'abonnement soit crédité.
//     Vérifiez chez le fournisseur avant de rembourser. »
// - renewalsDue et expiredNotRenewed : deux tableaux distincts.

// Onglet Adoption
// - activeClinics / dormantClinics avec la définition affichée :
//   « Active = au moins une action enregistrée sur les 30 derniers jours. »
// - perClinic : tableau triable par patients / consultations / dernière activité.
// - newClinicsPerMonth -> <BarChart />
// - rolesFilled : affiché SOUS un avertissement obligatoire —
//   « Indice, pas mesure : rien ne trace l'usage par module. Un compte
//     pharmacien actif suggère que la pharmacie sert, sans le prouver. »
// - Les tendances de consultations portent la mention
//   « datées du rendez-vous, pas de la saisie ».
```

- [ ] **Step 2: Wire it into the sidebar**

In `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`:

Add the import:

```tsx
import ReportsSection from './sections/ReportsSection';
```

Add `'reports'` to the `Section` union type at line 107.

Add to `navItems`, before the `security` entry:

```tsx
    { id: 'reports', label: 'Rapports', icon: BarChart2 },
```

`comingSoonItems` is now empty. Delete the array, its type annotation, its explanatory comment and the JSX block that maps over it, along with the now-unused `BarChart2`/`Shield`/`SettingsIcon` imports **only if** they are no longer referenced by `navItems` — all three are, so keep them.

Add to `sectionTitles`:

```tsx
    reports: 'Rapports',
```

Add to the section-rendering block:

```tsx
              {section === 'reports' && <ReportsSection />}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b --pretty false`
Expected: no output

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: no new warnings naming `ReportsSection` or `PlatformAdminPage`

- [ ] **Step 5: Run the whole backend suite**

Run: `cd backend && npm test`
Expected: 0 fail

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/PlatformAdmin/
git commit -m "feat(reports): ship the Rapports section and retire the last coming-soon item"
```

---

### Task 5: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the architecture notes**

In the "Cross-clinic platform admin" section, remove the sentence about disabled/"Bientôt disponible" nav items entirely — every section is now real. Add a subsection describing the two report tabs and, explicitly, the two accuracy rules that must survive future edits:

- MRR is derived from active clinics and their plan, never from the sum of prepaid collections.
- The role breakdown is a proxy, not telemetry, because no per-module usage tracking exists.

Also record the identified debt: JS-side aggregation over `patients`/`consultations` degrades past roughly ten thousand rows and will need a Postgres RPC.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document the Rapports section"
```

---

## Migrations

**None.** Every figure in this plan comes from tables that already exist on the live database, verified 2026-08-06.
