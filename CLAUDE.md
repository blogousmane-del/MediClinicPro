# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MediClinic is a multi-tenant clinic management SaaS for small/medium clinics in Côte d'Ivoire (subscription: 15 000 FCFA/month). UI, error messages, and domain terms are in French — keep new user-facing strings in French to match the existing app.

Monorepo with three parts:
- `backend/` — Express REST API
- `frontend/` — React 19 + TypeScript + Vite SPA
- `api/index.js` — thin Vercel serverless wrapper that re-exports `backend/server.js` for `/api/*` requests in production

## Commands

Run from the repo root (`package.json` orchestrates both apps):
```bash
npm run backend         # node backend/server.js (port 5000)
npm run frontend        # vite dev server for frontend/ (port 5173)
npm run dev              # starts both concurrently (Windows/PowerShell only)
npm run build:frontend  # tsc -b && vite build for frontend/
```

Or per-package:
```bash
cd backend && npm start        # node server.js
cd frontend && npm run dev     # vite
cd frontend && npm run build   # tsc -b && vite build
cd frontend && npm run lint    # oxlint
```

There is no automated test suite (backend `npm test` points at a nonexistent `test-db.js`). Verify backend changes by hitting endpoints manually (e.g. via the health check `GET /health`) and verify frontend changes by running the dev server and exercising the flow in a browser.

Backend requires `backend/.env` (see `backend/.env.example`): `SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, `PORT`, optional SMTP vars for email (falls back to console logging if unset).

## Architecture

### Data layer: Supabase, not SQLite
Despite `README.md` describing SQLite, the backend now runs entirely on **Supabase (PostgreSQL)** via `@supabase/supabase-js` — `backend/database.js` exports a single `supabase` client (service-role key, RLS bypassed on the backend) used directly in every route file. `backend/supabase_schema.sql` is the source of truth for the schema: `clinics`, `users`, `patients`, `appointments`, `consultations`, `medications`, `stock_entries`, `prescriptions`, `prescription_items`, `lab_exams`, `payments`, `activity_logs`. `backend/migrate-data.js` was a one-off SQLite→Supabase migration script. `backend/mediclinic.db` is legacy/unused.

### Multi-tenancy
Every table carries `clinic_id`. Every query in every route **must** filter `.eq('clinic_id', req.user.clinicId)` — there is no database-level tenant isolation (RLS is bypassed by the service-role key), so this filter is the only thing preventing cross-clinic data leaks. When adding new routes or queries, follow the existing pattern in `backend/routes/*.js` exactly.

### Auth & subscription gating
`backend/middleware/auth.js` exports `auth` and `checkRole(roles)`:
- `auth` verifies the JWT, attaches `req.user` (`{ userId, clinicId, role, ... }`), and also loads the clinic's subscription status. If the subscription is expired, all non-GET requests are blocked with `403 SUBSCRIPTION_EXPIRED` except billing (`/settings/subscription`) and logout — this is the paywall enforcement point.
- `checkRole([...roles])` gates by role; `admin` always passes.
- Roles: `admin`, `doctor`, `secretary`, `pharmacist`, `lab_tech`, `manager` (see `frontend/src/contexts/AuthContext.tsx` for the canonical list).

### Route modules (`backend/routes/`)
One file per domain, each mounted in `backend/server.js` under `/api/<domain>`: `auth`, `patients`, `appointments`, `consultations`, `pharmacy`, `laboratory`, `financials`, `settings`. Each handler follows the same shape: `auth` middleware → Supabase query scoped by `clinic_id` → write an `activity_logs` row for mutations → JSON response with French error/success messages. Note: prescriptions are **not** their own route domain — `GET/POST /api/pharmacy/prescriptions[/:id]` lives inside `pharmacy.js` since dispensing is a pharmacy stock operation; the frontend's `pages/Prescriptions/OrdonnancesPage.tsx` calls this same endpoint.

### Frontend structure
- `App.tsx` is a manual tab router (no react-router) — auth state, onboarding gating, and the sidebar tab switch all live here as local state. Logged-out state is a separate `loggedOutTab` union (`'landing' | 'login' | 'register' | 'terms'`) from the authenticated `currentTab` string.
- Auth flow: unauthenticated → `LandingPage`/`AuthPage`/`TermsOfServicePage`; authenticated admin with no `clinic.address` → forced into `OnboardingPage`; otherwise the main tabbed dashboard renders.
- `contexts/AuthContext.tsx` — user/clinic session, token stored in `localStorage` as `mediclinic_token`, calls `GET /auth/me` on mount to hydrate.
- `contexts/OfflineContext.tsx` — tracks `navigator.onLine`, queues actions to `localStorage` while offline, replays on reconnect (currently a simulated sync, not wired to real API calls).
- `utils/api.ts` — typed fetch wrapper (`api.get/post/put/delete`) that attaches the JWT bearer token and normalizes errors to `{ status, error, code, message }`. `VITE_API_URL` env var overrides the API base; defaults to `http://localhost:5000/api` on localhost and `/api` otherwise (matches the Vercel rewrite).
- `pages/` mostly mirrors the backend route domains (`Patients/`, `Appointments/`, `Pharmacy/`, `Laboratory/`, `Accounting/`, `Settings/`, plus `Auth/`, `Dashboard.tsx`, `LandingPage.tsx`, `OnboardingPage.tsx`, `TermsOfServicePage.tsx`) — except `Prescriptions/OrdonnancesPage.tsx`, which is its own tab/page but has no matching backend domain (see above).
- Styling is plain CSS, not Tailwind: shared tokens/utility classes (`.btn`, `.card`, `.badge`, `.grid-cols-*`, `.landing-*`, `.auth-*`, HSL custom properties, light/dark via `[data-theme]`) live in `index.css`; individual pages mix those classes with inline `style={{}}` for one-off layout. Follow this pattern for new UI rather than introducing Tailwind or CSS modules.

### Banani design imports
`.mcp.json` (gitignored) can hold a Banani MCP server for pulling designs via `mcp__banani__banani_get_selected_designs`. `.planning/banani/STATUS.md` tracks per-screen import status and decisions — check it before redoing work. Established pattern from that effort: prefer restyling/light polish over wholesale replacement when an existing page is already more functional than Banani's static mock (real data, role gating, working handlers), and never introduce fabricated stats, testimonials, or claims (e.g. data-residency claims) that Banani's placeholder content includes.

### Deployment (Vercel)
`vercel.json` builds the frontend to `frontend/dist` and rewrites `/api/*` to the serverless function at `api/index.js`, everything else to `index.html` (SPA fallback). `framework` is forced to `null` to stop Vercel's autodetection from misidentifying the repo as Next.js. In the Vercel serverless environment (`process.env.VERCEL` set), `backend/server.js` skips `app.listen` and only calls `initDb()` — see the bottom of that file. Environment variables (`SUPABASE_URL`, `SUPABASE_KEY`, `JWT_SECRET`, etc.) must be set in Vercel Project Settings, not read from `.env`. `.env` must be loaded (`require('dotenv').config(...)`) before any other require in `server.js`, since route/middleware modules read `process.env` at import time.

### CORS and rate limiting
`server.js` allows any origin containing `vercel.app` plus `localhost:5173`/`127.0.0.1:5173`, and — quietly — allows all origins whenever `NODE_ENV !== 'production'`. `/api/auth/login` and `/api/auth/register` share a 100-requests-per-15-minutes-per-IP limiter. Keep both in mind when debugging cross-origin or "too many requests" issues in French-language error responses.

## Test accounts (seeded)
| Rôle | Email | Password |
|---|---|---|
| admin | admin@mediclinic.com | adminpassword |
| doctor | aminata@mediclinic.com | doctorpassword |
| secretary | bernard@mediclinic.com | secretarypassword |
| pharmacist | moussa@mediclinic.com | pharmacistpassword |
| lab_tech | fatou@mediclinic.com | labpassword |
