# Administration — Super Admin — Banani → MediClinic

## Source
- Banani screen ID: `uh1OcdtphSFV/screens/new_screen9.jsx`
- Fetched: 2026-07-26

## Context
Genuinely new capability — no cross-clinic concept existed anywhere in MediClinic before this. Every route in the app filters `.eq('clinic_id', req.user.clinicId)`; this is the one deliberate exception. Confirmed with the user before writing any code (this doc records the decisions, not just the diff).

## User decisions (confirmed via AskUserQuestion before coding)
1. **Access model**: single allowlisted account (`blog.ousmane@gmail.com`), not a new `role` value. Simplest option, no schema change, no new role concept to thread through `checkRole` everywhere.
2. **Fabricated sections dropped entirely**: Banani's "Tickets support" and "Santé du système" (API/DB/SMS/Backups status) have zero backing infrastructure in this app (no ticket table, no health-check mechanism) — building fake versions would repeat the exact fabrication problem this project has fixed elsewhere (see STATUS.md's 2026-07-22 audit entries). Not built.
3. (Flagged, not formally asked) Replaced the emptied right-column space with a **real** widget instead of leaving it blank: "Abonnements arrivant à expiration" (clinics whose subscription expires within 7 days) — genuinely useful, built from real `subscription_expires_at` data.
4. (Flagged, not formally asked) Dropped Banani's fake "Plan" tiers (Starter/Clinique/Hôpital) — MediClinic has exactly one real 15 000 FCFA/month plan; showing invented pricing tiers is the same fabrication pattern already rejected in the Settings billing tab rebuild (STATUS.md, 2026-07-22 bug audit, item 4).

## Backend
- `backend/middleware/superAdmin.js` (new) — `superAdminOnly`, runs after `auth`. Checks the caller's email (looked up by `req.user.userId`, since the JWT payload doesn't carry email) against `SUPER_ADMIN_EMAILS` (comma-separated env var, defaults effectively to "nobody" if blank — same degrade-gracefully pattern as every other optional feature in this app).
- `backend/routes/platform.js` (new), mounted at `/api/platform` in `server.js`. One endpoint: `GET /overview` — real aggregate data only:
  - `stats`: active/expired clinic counts, total users across all clinics, **this month's real subscription revenue** (summed from `subscription_payments` where `status='paid'`, `paid_at` in current month — this is MediClinic's own SaaS revenue, not clinics' patient revenue, which would be a different and much larger number).
  - `clinics`: every clinic with computed status (`active`/`expired`, derived the same way `middleware/auth.js` already computes expiry) and real per-clinic practitioner/patient counts (aggregated in JS from full `users`/`patients` selects — fine at current scale of a handful of clinics; would need a real GROUP BY query if this grows to hundreds).
  - `expiringSoon`: clinics expiring within 7 days.
  - `recentActivity`: last 10 `activity_logs` rows across all clinics, joined to clinic name in JS.
- `backend/.env` / `.env.example`: added `SUPER_ADMIN_EMAILS`.

## Frontend
- **Correction after first pass**: the user flagged (screenshot comparison) that this screen must be a **wholly separate admin console**, not a tab inside the normal clinic app — unlike every other Banani screen so far, reusing the real `Sidebar`/`Header` was wrong here, since Patients/Rendez-vous/Ordonnances/Pharmacie make no sense in a cross-clinic operator context. Corrected: `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx` is now a self-contained shell with its own dark sidebar (`Vue d'ensemble` / `Cliniques` / `Utilisateurs` / `Abonnements` — dropped `Support`/`Rapports`/`Sécurité`/`Config. système` from Banani's nav since none have any backing functionality, same reasoning as the dropped ticket/health widgets) and its own top bar. `App.tsx` now early-returns `<PlatformAdminPage onExit={...} />` when `currentTab === 'platform-admin'`, bypassing the normal `Sidebar`/`Header`/`app-container` entirely, instead of rendering it as one more tab inside `<main>`.
- Added two real, data-backed sections beyond the original overview: **Utilisateurs** (every user account across every clinic — name, email, role, clinic, active status; new `GET /api/platform/users`) and **Abonnements** (per-clinic subscription status + full `subscription_payments` history across all clinics; new `GET /api/platform/subscriptions`). Both real, no fabrication.
- Still uses the app's existing shared classes (`.card`, `.table-container`, `.badge-*`, `.grid-cols-4`) inside the new shell rather than introducing new one-off CSS.
- `frontend/src/components/Sidebar.tsx`: "Administration plateforme" nav entry (in the *normal* clinic sidebar) is the entry point into the separate console — shown only when `user.email` matches a client-side allowlist constant. UX hint only; the real boundary is the backend middleware.
- The new shell includes "Retour à mon espace clinique" and "Se déconnecter" — since the allowlisted account is also a normal clinic-1 admin, there needs to be a way back into the regular app. Called this on my own judgment since Banani's mock only shows a logout icon; flagged for veto if unwanted.

## Verification
- Backend: restarted, smoke-tested directly —
  - Allowlisted account (`blog.ousmane@gmail.com`) → `200` with real data (5 real clinics existed in the dev DB at test time, not fabricated).
  - Non-allowlisted account (`admin@mediclinic.com`, a normal clinic-scoped admin) → `403`.
- Frontend: `npm run build` and `npm run lint` both clean, no new warnings.
- **Not visually verified in a browser** — no browser-driving tool available this session. Recommend checking the new "Administration plateforme" sidebar entry and page at 375/768/1280px before treating this as fully Done.

## 2026-07-26 — restored full visual layout with honest placeholders
User pushed back ("je veux que ça soit identique, il y'a beaucoup de choses qui manquent") after comparing screenshots — wanted pixel-perfect structural parity with Banani, not a scoped-down version. Clarified via AskUserQuestion: pixel-perfect layout now (using real data where it exists), placeholder/"Bientôt disponible" for sections with no backend — real multi-tier billing/tickets/health-monitoring systems to be built as separate, larger follow-up projects (user picked multi-tier plans first, but hasn't yet supplied real tier prices/limits/feature-gating needed to build it).

Restored to match Banani's full structure:
- **"Plan" column** back on the clinics table — shows an honest `Standard` badge for every clinic (single real plan today) rather than fabricated per-clinic tier variety.
- **"Tickets en cours" and "Santé du système" panels** restored in the overview's right column (alongside the real "Abonnements arrivant à expiration" widget already there) — both explicitly labeled "bientôt disponible", no fake ticket/uptime data.
- **Sidebar**: `Support`/`Rapports`/`Sécurité`/`Config. système` added back as disabled, non-clickable entries with a "Bientôt" badge — visible for structural parity, not fake functional links.

Verified: `npm run build`/`npm run lint` clean.

## Follow-ups not attempted (out of scope for this pass)
- No "view clinic detail" or "suspend/edit clinic" actions — read-only dashboard only, matching what was actually asked.
- `expiringSoon`/`clinics` aggregation is O(n) in JS across full `users`/`patients` tables; fine now, would need a real SQL aggregate if the platform grows well beyond its current handful of clinics.
