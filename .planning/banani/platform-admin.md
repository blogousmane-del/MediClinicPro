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

## 2026-07-27 — Banani pixel-parity token pass (all 5 sections + mobile)
User flagged the live Abonnements tab (screenshot) as not matching Banani and asked for a pixel-perfect pass "en tenant compte de tout" (including responsive). Re-fetched the Banani selection: still `new_screen9.jsx` ("Administration — Super Admin") — the same overall admin-shell screen already implemented above, not a screen dedicated to the Abonnements tab specifically (Banani's flow has no such screen; the sidebar nav item exists but its content view was never designed in Banani). Confirmed with the user via AskUserQuestion how to proceed given that gap — chose "apply the Banani design system everywhere" rather than scoping to just Abonnements or waiting for a dedicated screen.

**Approach**: rather than a one-off visual patch, applied Banani's actual token set (`style.css` from the MCP fetch — background/foreground/border/input/primary/secondary/muted/success/warning/danger hex values, DM Sans font, 6px `rounded-md` radius) as a **fixed light palette scoped to this console only**, independent of the app-wide dark/light toggle — same reasoning as the Landing Page's earlier fixed-theme decision: this is an operator console, not a themed clinic-facing page, so it shouldn't re-skin itself to whatever theme the logged-in visitor happens to have picked.

**Implementation**:
- `frontend/src/index.css`: added `DM Sans` to the Google Fonts `@import`; added a `.platform-admin-shell` scoped block that overrides `--bg-primary/--bg-secondary/--text-primary/--text-secondary/--text-muted/--border/--success/--warning/--danger/--info(-light)/--font-secondary` to Banani's exact hex values (shared `.card`/`.badge`/`.table-container`/`.btn`/`.input-control` classes automatically re-skin through these vars, no per-component rewrite needed); a `.badge` radius override (6px, not the app-wide full-pill shape); real `<table>`/`<th>`/`<td>` styling (these tables use a bare `<table>`, no `.custom-table` class, so previously had zero styling beyond the `.table-container` wrapper — a real gap, not just a token mismatch); a `.stat-icon-box` (Banani's tinted-square icon treatment for the 4 overview stat cards).
- `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`: sidebar recolored to Banani's exact `sidebar`/`sidebar-foreground` tokens (`#243333`/`#E8EDEC`, was an approximate `#14201d`/`#a9b8b4` before); "Super Admin" badge switched from an amber/ocre pill to Banani's actual teal-tinted one; all 5 filter-pill blocks (Clinics/Users/Subscriptions/Tickets) and the old ad-hoc `#1e4d40` teal replaced with Banani's real primary `#3D6B5E`; stat cards wrapped in `.stat-icon-box`.
- **Deliberately not added**: Banani's fake growth deltas ("+3 ce mois" etc., no real month-over-month computation exists), global topbar search/notification bell/"Nouvelle clinique" button (no backend for any of them) — same anti-fabrication precedent as every prior Banani pass (STATUS.md's 2026-07-22 audit and this file's own "restored full visual layout with honest placeholders" entry above).
- **Mobile-first responsive** (Banani's mockup is desktop-only, `screenSize: 'desktop'`): below 900px the fixed 240px sidebar column collapses into a horizontal scrollable icon+label strip pinned to the top (own design decision, no Banani mobile mock to match), main content stacks full-width below. Implemented via `!important` media-query overrides on top of the existing inline-style layout (the same technique already used elsewhere in `index.css`, e.g. `.dashboard-legend` — author `!important` beats a plain inline `style=""` per the CSS cascade, so no need to refactor the inline styles into classes first). Hit and fixed one real bug during this pass: the first attempt wrapped *both* the branding block *and* the `<nav>` in the same "header" class and hid all of it on mobile, which also hid the nav — caught via an actual Playwright screenshot at 375px (empty-looking dark strip), fixed by scoping the hide to the branding block only.

**Verification**: `npx tsc -b` and `npm run lint` clean (no new warnings). Actually visually verified this time (previous passes in this file/STATUS.md repeatedly noted "no browser-driving tool available") — installed Playwright + Chromium in the scratch dir, logged in via the real login form, temporarily added the local seeded `admin@mediclinic.com` account to both `SUPER_ADMIN_EMAILS` (backend `.env`) and `PLATFORM_ADMIN_EMAILS` (`Sidebar.tsx`) to get super-admin access locally (the real allowlisted account's password isn't known in this environment), screenshotted Vue d'ensemble + Abonnements at 375/768/1280px, then reverted both temporary allowlist edits and restarted the backend to confirm the revert took. All three breakpoints confirmed clean: no page-level horizontal overflow, badges render as Banani's rounded-md pills, table header rows shaded, stat-card icon boxes render, mobile nav strip scrolls horizontally with no dead-end (footer Retour/Déconnexion reachable via the same horizontal scroll, not hidden).

**Flagged, not fixed (pre-existing, unrelated to this pass)**: the Landing Page's public pricing section (`#pricing`) rendered empty in the same Playwright session's landing-page screenshot — the 3-card grid didn't show, likely a plan-data fetch issue on the logged-out page. Not investigated further (out of scope for this Platform Admin pass); worth a follow-up session.
