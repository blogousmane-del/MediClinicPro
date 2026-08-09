# Banani implementation status

Last updated: 2026-08-09 (Platform Admin pixel-parity pass — see the entry at the bottom)

Full import requested by user 2026-07-22 — all 25 pages + 16 shared components. After comparing Banani's mocks against the existing app, most existing pages turned out to already be more capable than Banani's static designs (theme-aware, role-gated, live-data-wired). User decision: light visual/icon polish on existing pages, keep all logic; full builds only for genuinely new/missing content.

## Done
- [x] `landing-page` — `frontend/src/pages/LandingPage.tsx` + `index.css` — full rebuild. Dropped Banani's fabricated stats/testimonials (user decision), rebuilt hero without AI photography (user decision), kept fixed-dark theme (user decision).
- [x] `Sidebar` (component) — icon polish only (Receipt for Comptabilité, added Ordonnances entry). Kept all real logic (role filtering, offline indicator, active state, mobile overlay).
- [x] `TopBar`/Header — reviewed against Banani's TopBar (search bar + notification count). Skipped both: search isn't wired to anything real, and the notification count would be fabricated data. Left `Header.tsx` unchanged.
- [x] `Dashboard`/StatCard/QuickAction — icon polish (Receipt for revenue card) + dead-import cleanup. Did NOT rebuild with Banani's flat StatCard/QuickAction primitives — existing cards are theme-aware, role-gated, and live-data-wired; Banani's aren't.
- [x] `AppointmentsPage`/AppointmentCard/AppointmentRow/MiniCalendar/FilterChips — reviewed; already has responsive desktop-table + mobile-card views. Dead-import cleanup only.
- [x] `PharmacyPage`/`AddMedicine`/PharmacyItem/MedicineInputRow — Add Medicine modal already existed (not new). Removed the "Prescriptions" sub-tab (promoted to standalone Ordonnances page, see below).
- [x] `AccountingPage`/FinancialSummaryCard/InvoiceItemRow/TransactionRow — reviewed; dead-import cleanup only. `NewInvoice` Banani screen not built as separate page — existing payment recording flow already covers this need (not re-verified in detail this pass).
- [x] `SettingsPage`/SettingToggle/AlertItem/AddPractitioner/PractitionerAdded — staff management and subscription billing already exist. Dead-import cleanup only.
- [x] **Ordonnances** (new) — `frontend/src/pages/Prescriptions/OrdonnancesPage.tsx`, wired via `Sidebar.tsx` + `App.tsx`. Promoted from Pharmacy's redundant "Prescriptions" sub-tab, expanded to show all statuses (pending/partial/dispensed) via existing `GET /pharmacy/prescriptions?status=` endpoint. **Also fixed a pre-existing bug**: the old dispense action sent `{ items: [{itemId, quantityDispensed}] }` but the backend expects `{ dispensations: [{itemId, qty}] }` — the button was silently broken before. Fixed in the new page.
- [x] **Terms of Service** (new) — `frontend/src/pages/TermsOfServicePage.tsx`, reachable from Landing Page footer. Built with placeholder legal content (`[Nom de l'entité légale]` etc.) instead of Banani's fabricated company name/SLA numbers/contact info — flagged in-page as a draft needing real legal review before going live.

- [x] `AuthPage` (Connexion + Mobile) — added Banani's split-panel branding layout (mobile: compact top bar; desktop 1024px+: full left panel with headline/feature chips/copyright) via new `.auth-*` classes in `index.css`. All existing functional logic untouched (login/register tabs, forgot-password view, password visibility toggle, loading states). Deliberately skipped 3 Banani elements: "OTP SMS" login button (no backend endpoint — would be a dead affordance), "Contacter l'administrateur" link (no destination), "Données hébergées en Côte d'Ivoire" claim (unverified — Supabase region not confirmed).

## In progress
(none)

## Pending / deferred
- `LabResults`, `PendingLabs`, `NotificationSent` (Laboratory sub-flows) — `LaboratoryPage` reviewed at a lint-warning level only (no unused-import issues found); not compared screen-by-screen against these three Banani mocks yet.
- Shared components not yet individually reviewed: FinancialSummaryCard, InvoiceItemRow, MedicineInputRow, MiniCalendar, PharmacyItem, PrescriptionCard, SettingToggle, AlertItem, TransactionRow, AppointmentCard, AppointmentRow, FilterChips — folded into their parent pages' light-polish pass rather than built as standalone primitives, since none of the parent pages were rebuilt from scratch.
- "New Screen" (empty Banani placeholder) — ignored, no content.

## Open design questions
- All raised so far have been resolved (see chat history 2026-07-21/22): Landing Page stats/testimonials/photography/theme, existing-page rebuild vs. polish scope, Ordonnances promotion, Terms of Service placeholder approach.

## 2026-07-22 bug audit (post external rewrite)
A separate/parallel session made commits `1fec7e7`..`e52bf9b` on top of this work (notably `e52bf9b "feat: complete UI wireframe alignment and full interactivity for all MediClinic modules"`), substantially rewriting `OrdonnancesPage.tsx`, `SettingsPage.tsx` billing tab, and `Sidebar.tsx` ordering. That rewrite broke the production build and reintroduced fake-data patterns already rejected earlier in this effort. Found and fixed:

1. **Build-breaking**: `OrdonnancesPage.tsx` mock data (`defaultMockPrescriptions`) was missing the required `frequency` field on 9 items — `tsc -b` failed, meaning every Vercel deploy since that commit has failed and Vercel was stuck serving an old build. This is why local (`vite dev`, no type-check gate) looked fine while the live site didn't reflect recent work. Fixed.
2. **`GET /api/pharmacy/prescriptions` (list) never returned `items`** — only the single-prescription detail endpoint did, so every real prescription showed an empty medications section. Fixed in `backend/routes/pharmacy.js` (added `items:prescription_items(*)` to the select).
3. **Dispense action was pure local state** — `handleConfirmDispense` never called the API; stock was never decremented, nothing persisted. Wired to real `POST /pharmacy/dispense/:id`.
4. **Settings billing tab was fully decorative** — 3 fabricated pricing tiers (25k/75k/180k FCFA) contradicting the real 15 000 FCFA/month plan shown everywhere else, fake hardcoded invoice history, "renew"/"export"/"edit payment" buttons that only showed toasts and never called the existing, working `renewSubscription()` (→ `POST /financials/subscription-pay`). User decision: revert to the single real plan. Rebuilt with one real plan card + a renewal form (provider/months/phone) wired to `renewSubscription()`.
5. **Not fixed / flagged only**: "Créer/Modifier/Dupliquer une ordonnance" in `OrdonnancesPage.tsx` still only mutates local React state — there is no backend endpoint to create a standalone prescription (prescriptions are currently only created as a side effect of `POST /consultations`). A pharmacist/doctor using "Nouvelle ordonnance" will see a success toast but nothing is saved. Needs either a new `POST /api/pharmacy/prescriptions` endpoint or a product decision to remove/relabel that button. Not attempted this pass — flagged for next session.

## 2026-07-22 full audit pass 2 — Dashboard, Pharmacy, Laboratory, Patients, Accounting
User asked for a broad "find bugs and fix" pass. Dispatched 2 background research agents (read-only) to audit Pharmacy+Laboratory and Patients+Accounting against their real backend routes, while auditing Dashboard.tsx directly. All findings below verified by reading code + confirmed via `npm run build`/`npm run lint` after each fix.

**Fixed:**
- **`PatientDetailPage.tsx` — actual runtime crash**: `JSON.parse(item.details.constants)` was called on a value the backend already sends as a parsed object (not a JSON string), throwing `SyntaxError` on render for *every* consultation with vitals recorded. This broke the whole patient timeline for any patient with real consultation history. Fixed by reading `item.details.constants.tension/.temp/.weight` directly.
- **`Dashboard.tsx` — worst fabrication found this session** (first screen every user sees post-login): hardcoded date stuck on "14 juillet 2025"; fake fallback numbers (27 patients/19 RDV/3 alerts) that silently replaced genuine zeros; `defaultMockAppts` using hotlinked Unsplash stock photos as fake patient avatars; a "TEMPS D'ATTENTE MOYEN" card hardcoded to "18 min" with zero data backing; an entire "Alertes" widget with 3 fully fabricated alerts (naming a fake patient "Kouamé Éric"); an entire "Occupation des salles" widget with fake room-occupancy percentages for a `rooms` concept that doesn't exist anywhere in the DB schema; fake calendar appointment-dots. All replaced with real `stats`-derived data or removed; added a proper loading state and error toast (previously silently swallowed fetch failures).
- **`PharmacyPage.tsx`**: (1) "Ajouter un médicament" always failed — payload sent `quantity`, backend destructures `qty` (`backend/routes/pharmacy.js`); renamed to match. (2) Editing an existing medication only showed a success toast with zero API call — now routes through the same real `/pharmacy/replenish` endpoint (which already upserts by name+form+dosage). (3) Removed `defaultMockMeds` (6 fake medications with fabricated suppliers/prices) shown whenever real inventory was empty. (4) `isLowStock`/`isNearExpiry`/`isExpired` were declared as expected API fields but the backend never returns them — replaced with real client-side computation from `expiry_date`/`stock_quantity`/`min_stock_threshold`. (5) "38% Marge moyenne" was a hardcoded literal — now a real computed average.
- **`LaboratoryPage.tsx`**: removed `defaultMockExams` (3 fake exams with fabricated patient/doctor names) shown whenever the real queue was empty; added empty states for both pending/completed views; wired the previously-dead "Filtrer" button to toggle the pending/completed tab (the `activeTab` state existed but had no UI control, so the completed-exams view was unreachable); wired the previously-dead "Voir détails" button to the existing results modal; disabled "Exporter" with a "Bientôt disponible" tooltip instead of leaving it a silent dead click (no export endpoint exists); removed unused `useAuth` import; added loading state.
- **`AccountingPage.tsx`**: falsy-zero bug — `stats?.totalRevenue ? ... : '40 600'` showed a fake 40 600 FCFA even when real data loaded and genuinely totalled 0 (hits **secretary** role hardest, since backend `GET /financials/stats` deliberately zeroes out revenue for non-admin/manager — flagged below); "Répartition par mode" (Espèces/Mobile Money) was two hardcoded literals ignoring the real `stats.distribution` array the backend already computes — now maps over real data; removed 2 fully fabricated transaction rows shown whenever real payments were empty.
- **`PatientsPage.tsx`**: removed `defaultMockPatients` (6 fake patients with Unsplash stock photos) shown when the real list was empty; removed fake "247 patients actifs" / "Nouveaux ce mois : 12" always-shown stats; removed fake "Patients récents" sidebar fallback (3 hardcoded names); removed a `last_visit` field hardcoded to "14 juil. 2025" for literally every real patient (no real data source exists for this without a new backend join — now shows "—" honestly instead of a fabricated date).

**Flagged, not fixed (need a product/scope decision, not a mechanical fix):**
- `AccountingPage.tsx` "Nouvelle facture" (Sauvegarder/Envoyer & imprimer) — no backend invoice endpoint exists at all; same category as the Ordonnances creation gap above.
- `AccountingPage.tsx` patient selector on the invoice screen is inert (`setSelectedPatient` never called) — always shows "Adjobi Kouassi" regardless of search input.
- `PatientsPage.tsx` "Modifier" button doesn't open an edit form — it's identical to "Consulter" (opens `PatientDetailPage`, which has no edit UI), even though the backend already implements `PUT /patients/:id`.
- `PatientsPage.tsx` "NUMÉRO DE DOSSIER (OPTIONNEL)" input is silently discarded — backend always auto-generates the folder number regardless of what's typed.
- **Role-permission question**: `backend/routes/financials.js` `GET /stats` excludes `secretary` from real revenue numbers (`hasFinancialsAccess = ['admin','manager']`), but `Sidebar.tsx` explicitly grants secretaries the Comptabilité tab — combined with the falsy-zero bug (now fixed to show "—" instead of fake data), a secretary will always see "—" for revenue. Worth a decision on whether secretaries should see real figures.
- Laboratory: unknown-doctor fallback silently substitutes a specific fabricated name ("Dr. Aminata Koné") — changed to "Médecin non renseigné" as part of the mock-removal, but worth confirming that's the desired behavior everywhere a doctor name is missing.
- `PatientsPage.tsx` patient-archive action has no role restriction on either frontend or backend (any authenticated role can archive a patient) — consistent front/back so not a bug, but possibly not intended.

## 2026-07-24 Banani import — Rendez-vous / AppointmentsList
Screen `AppointmentsList.jsx` fetched and implemented in `frontend/src/pages/Appointments/AppointmentsPage.tsx` (plan: `appointments-list.md`). Kept the project's real `Sidebar`/`Header` instead of Banani's mock chrome. Card-based list replaces the old separate desktop-table/mobile-card split. User decisions: "Consulter" opens the real patient record (new `onViewPatient` prop threaded through `App.tsx`); status chips use the real 3 statuses (`Tous/Planifiés/Terminés/Annulés`) with live counts instead of Banani's fictional 4-state mock; `room`/`notes` — user chose to add these as **real** new columns (`appointments.room`, `appointments.notes`) rather than dropping them, so `backend/routes/appointments.js` (GET/POST/PUT) and `supabase_schema.sql` were updated, and the booking modal got two new optional fields. Also added `patient_birth_date` to the appointments GET select to compute real ages (Banani's mock invented fake ages). Avatars use initials-in-a-circle, not AI stock photography. "Exporter" disabled with a tooltip (no export endpoint), matching the precedent set on `LaboratoryPage.tsx`. Requires the user to run an `ALTER TABLE appointments ADD COLUMN room TEXT; ADD COLUMN notes TEXT;` migration in Supabase (same constraint as the `password_set` migration earlier — no DDL access from this session).

## 2026-07-24 Banani import — Dépôt de garantie (new feature, new table)
Screen `new_screen6.jsx` ("Dépôt de garantie — Soins critiques") implemented as a new menu item + page (plan: `deposits.md`). User decisions: real deposit tracking (create → held → refunded/deducted) instead of Banani's fictional "admission blocking" mechanic (no admission/hospitalization concept exists in this schema, and building one was explicitly out of scope); free-form service line items instead of Banani's invented fixed-price catalog (Chirurgie 150k/Réanimation 80k/etc. were made up); role gate `admin/secretary/manager`, same as Comptabilité. New table `deposits` (clinic_id, patient_id, user_id, amount, payment_method, reference_number, reason, items JSONB, estimated_total, status held/refunded/deducted, resolved_at/resolved_by). New `backend/routes/deposits.js` (GET/POST/PUT), mounted at `/api/deposits`. New `frontend/src/pages/Deposits/DepositsPage.tsx` with a create form (patient search reusing the Accounting pattern, real allergy/antecedent badges from `patients.allergies`/`patients.antecedents`, line-item builder, 50/75/100%-of-total quick amount buttons, payment method, per-patient deposit history strip) and a registry tab (all deposits, resolve actions). New menu item "Dépôts de garantie" in `Sidebar.tsx` + `App.tsx` tab wiring. Requires a `CREATE TABLE deposits (...)` migration in Supabase (no DDL access from this session) before the feature is usable — booking will 500 until that's run.

## 2026-07-24 audit — fake OTP login flow found uncommitted in AuthPage.tsx/Sidebar.tsx
Same "external rewrite" pattern as 2026-07-22, this time surfacing as an *uncommitted* working-tree change (never made it into a commit) discovered mid-session while auditing after several feature additions (Resend email, Upstash rate limiting, password linking, micro-animations). User confirmed no other tool/session was intentionally running against this repo, so treated as unwanted drift and fixed directly:

1. **Fake OTP SMS login with hardcoded credential fallback (`AuthPage.tsx`)** — a full "Connexion avec OTP SMS" flow had been added: "Recevoir le code SMS" was a `setTimeout` fake with no backend call; "Valider le code" accepted *any* 4+ digit code and, regardless of what was entered, called `login('aminata.kone@clinique-cocody.ci', 'password123')` — hardcoded credentials embedded in client-side code. Verified that account does not exist in Supabase (so currently inert, not an active backdoor), but is a real risk if a matching account is ever created (test, seed, or accidental). Removed entirely — no real SMS/OTP backend infrastructure exists to make this genuine, so faking it was the wrong call.
2. **Login email field pre-filled with that same fake address** (`useState('aminata.kone@clinique-cocody.ci')` instead of `''`) — anyone opening the login page saw a specific stranger's email pre-populated. Fixed to empty string; placeholder text also de-fictionalized.
3. **Fabricated data-residency claim**: security badge read "100% Données hébergées en Côte d'Ivoire" — false (backend runs on Supabase, not CI-hosted infra) and exactly the kind of claim CLAUDE.md already calls out to avoid. Replaced with an accurate "Connexion chiffrée et données protégées".
4. **Dead-end fake support contact**: "Contacter l'administrateur" linked to `wa.me/2250700000000`, a placeholder WhatsApp number with no real owner. Removed the fake deep link, kept the text as plain (non-clickable) guidance.
5. **`Sidebar.tsx`**: empty-clinic fallback text had been changed from sensible defaults (`'Ma Clinique'` / `'Abidjan, CI'`) to placeholder-looking `'CLINICO'` / `'SAIOUA'`. Reverted. Also cleaned up several dead `/* Matches Image 1 */`-style comments left over from whatever produced this diff, since they refer to nothing in this codebase.

Build (`npm run build`) and lint verified clean after the fix (only pre-existing, unrelated unused-var warnings remain). **Takeaway for future sessions**: uncommitted working-tree drift can appear even without a new commit — worth diffing against HEAD when something looks "already done" but wasn't part of this session's own edits, not just after `git log` shows unfamiliar commits.

## 2026-07-24 audit pass 3 — payments, deposits, patient orientation
Dispatched 3 background read-only agents in parallel to independently audit the newest, least-battle-tested surfaces: (1) the Bictorys/PayTech payment integration end-to-end, (2) the just-committed patient orientation + doctor availability feature, (3) the Deposits feature and the Appointments `room`/`notes` Banani import. No critical findings; two real bugs fixed directly, the rest are UX/robustness polish logged for later.

**Fixed:**
- **`backend/routes/deposits.js` `PUT /:id` — resolve-before-payment-confirmed (HIGH)**: the resolve endpoint only checked `status === 'held'`, never `payment_status`. A deposit paid via Mobile Money (`payment_status: 'pending'` until the provider webhook confirms) could be marked `refunded`/`deducted` via a direct API call before any money was actually received — the frontend's button-hiding (`payment_status === 'paid'`) was client-side only, not enforced server-side. Added `if (deposit.payment_status !== 'paid') return res.status(400)...` before allowing resolution.
- **`backend/routes/deposits.js` `GET /` — missing role gate (LOW)**: any authenticated role (doctor, pharmacist, lab_tech) could list all clinic deposits; only POST/PUT were restricted to `DEPOSIT_ROLES` (`admin/secretary/manager`). Confirmed `Sidebar.tsx` already gates the Deposits menu item to exactly those three roles, so tightening `GET /` to match is not a regression. Added `checkRole(DEPOSIT_ROLES)`.
- **`backend/routes/webhooks.js` `amountMatches` — fail-open on missing amount (MEDIUM)**: returned `true` (verified) whenever a provider omitted the echoed amount, meaning a webhook forgery lacking that field would bypass tamper detection entirely. Confirmed both providers' `parseEvent`/`parseIPNEvent` only call `amountMatches` for `completed`/success events (failed events short-circuit earlier), where amount is always expected to be present in a genuine payload — so failing closed (`return false`) carries no legitimate-traffic risk. Fixed to fail closed; a missing amount on a claimed-success event now logs as a suspicious-amount rejection instead of silently passing.

**Flagged, not fixed (polish/UX, no data-integrity or security risk):**
- Payments: `PaymentCheckoutModal.tsx` doesn't detect a popup-blocked `window.open` (shows the generic "onglet ouvert" message regardless); raw provider error strings are forwarded to the failed-checkout toast instead of a curated French message; `amountMatches` never checks currency (only XOF exists today, so inert); `ONLINE_METHODS`/`SUBSCRIPTION_MONTHLY_PRICE` are duplicated between `financials.js` and `deposits.js` instead of shared from one module.
- Orientation: doctor-selection rows in the orientation modal (`PatientsPage.tsx`) are unstyled `<div onClick>`s with no keyboard support (no `tabIndex`/`onKeyDown`/`role`) — mouse/touch-only; `GET /settings/users` failure in the orientation fetch is silently swallowed (secretary just sees "aucun médecin disponible" whether the fetch failed or the list is genuinely empty); no loading spinner during that fetch, so the modal can flash an empty-state message before doctors load.
- Deposits: no server-side sanity bound relating `amount` (actually collected) to `estimated_total` (sum of line items) — likely intentional (a cashier can legitimately collect more/less than the itemized estimate) but worth a product confirmation.
- Schema drift check: `backend/supabase_schema.sql` now correctly defines `appointments.room`/`appointments.notes` (previously flagged as an unapplied manual migration) — file-level check only, live Supabase DB state not re-verified this pass.

All fixes verified with `node -c` on both changed files (clean). No live DB/API calls made this pass (static code audit only).

## 2026-07-26 Banani new screen — Administration plateforme (Super Admin)
Genuinely new capability, not a polish pass — fetched `new_screen9.jsx` (plan: `platform-admin.md`). First-ever cross-clinic view in MediClinic; every other route in the app deliberately scopes by `clinic_id`. Confirmed scope with the user before coding: access gated by a `SUPER_ADMIN_EMAILS` allowlist (not a new role), Banani's fake "Tickets support"/"Santé du système" sections dropped entirely (no backing infrastructure — would repeat prior fabrication mistakes), fake "Plan" tiers dropped (only one real plan exists). New: `backend/middleware/superAdmin.js`, `backend/routes/platform.js` (`GET /api/platform/overview`), `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`, new Sidebar entry (client-side hint only). Verified end-to-end against the running backend (allowlisted account gets real data, non-allowlisted gets 403) and `npm run build`/`npm run lint` clean. Not visually verified — no browser tool this session.

**Correction same day**: user flagged via screenshot comparison that reusing the real clinic `Sidebar`/`Header` was wrong for this specific screen (unlike every other Banani import) — a cross-clinic operator console shouldn't show Patients/Rendez-vous/Ordonnances tabs. Rebuilt `PlatformAdminPage.tsx` as a fully separate shell with its own dark sidebar (`Vue d'ensemble`/`Cliniques`/`Utilisateurs`/`Abonnements`); `App.tsx` now early-returns it entirely instead of nesting it in `<main>`. Added two more real sections while at it: `GET /api/platform/users` (every user across every clinic) and `GET /api/platform/subscriptions` (subscription status + payment history across all clinics). Re-verified: direct Supabase query checks (14 users, 5 clinics, 3 payments, no errors) and the auth/gating pipeline re-confirmed with a known seeded account (403 for non-allowlisted); `npm run build`/`npm run lint` clean.

## 2026-07-25 Banani re-fetch — Pharmacie / Ajouter un médicament (diff pass, not a rebuild)
Re-fetched `AddMedicine.jsx` (plan: `pharmacy-add-medicine.md`) at user request, even though already marked Done. The diff surfaced a real bug, not just styling: the live modal hardcoded `dosage: '500mg'` on every submit — confirmed against live DB rows that `name`/`dosage` are meant to be separate fields, corrupting records added through the modal. Fixed by adding a real "Dosage" field (auto-derived from the catalog string, user-editable). Also: made `min_stock_threshold` editable end-to-end (column existed, was hardcoded to 10 and never updatable via `POST /pharmacy/replenish`); added a live computed "Marge" readout; added new `manufacturer`/`unit` columns (user chose to add these — migration, not yet applied to live DB) and wired them into the form; reorganized the modal into Banani's labeled sections. Skipped Banani's extra "Sauvegarder" button (no distinct real action, same precedent as elsewhere) and its full-page Sidebar/TopBar chrome (real components already more functional). Verified via `npm run build`/`npm run lint` (clean); **not visually verified** — no browser-driving tool in this session.

Requires manual migration before `POST /pharmacy/replenish` works again:
```sql
ALTER TABLE medications ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS unit TEXT;
```

## 2026-07-26 Banani fetch — Abonnement / Choisir un plan (pixel-parity pass)
Fetched `new_screen10.jsx` ("Abonnement — Choisir un plan", plan: `abonnement-choisir-plan.md`). The underlying multi-tier plan feature (schema, backend enforcement, checkout, webhook plan-switch, cron renewal reminders) had already shipped this session from a screenshot + confirmed requirements, not an MCP fetch — this pass is a structural diff against the real Banani source, not a new feature build.

Rebuilt the 3-card picker in `SettingsPage.tsx`'s "Abonnez-vous" tab to match Banani's real layout: centered "Nos formules" eyebrow + H1 + subtitle header, badge chip per card (Gratuit/Populaire/Tout inclus) with a zap icon + permanent highlight on the top tier, stacked price block ("FCFA"/period next to the number), divider, 6 fixed comparison rows with check/x icons (excluded rows shown struck-through and muted, not omitted — new pattern vs. the previous pass which only listed included features), CTA + one-line note per card, and a softened "tous les plans incluent" divider bar below the grid.

Deliberate deviations from the raw Banani source (confirmed against prior decisions + established project precedent, not re-asked):
1. Kept tier names Starter/Clinique/Hôpital (not Banani's "Essai gratuit/Standard/Premium") — the user named these tiers explicitly earlier this session.
2. Comparison rows derived from real plan data (`staffLimit`/`allowedRoles`/`paymentMethods`) client-side, not copy-pasted from Banani's hardcoded feature strings — so the Mobile Money row can't drift from what's actually enforced.
3. Dropped Banani's WhatsApp/email contact card entirely — grepped the codebase, no real support channel exists; a fake WhatsApp number was already found and removed from `AuthPage.tsx` earlier this session (2026-07-24 audit entry above), so adding another one here would repeat the same mistake.
4. Softened the "all plans include" pill: dropped "support email" (unbacked), kept only verifiable claims.
5. Reworded the Hôpital card's CTA note away from Banani's "Support prioritaire inclus" (no priority-support infrastructure exists) to a true framing about unlimited staff.

Verified: `npm run build` and `npm run lint` clean, no new warnings. **Not visually verified in a live browser** — no browser-driving tool this session; recommend a manual check at 375/768/1280px before treating as fully pixel-verified (the existing `.plan-cards-grid` 3→1 column collapse below 850px is unchanged from the previous pass).

## 2026-07-25 Banani re-fetch — Landing Page structural rebuild
User flagged the live `LandingPage.tsx` as "very different" from Banani's landing page after selecting 2 screens (`new_screen4.jsx` desktop + `LandingPageMobile.jsx`). Re-fetched (plan: `landing-page.md`, 2026-07-25 addendum) and confirmed the page had drifted from the 07-21 plan (light theme + real photography instead of the originally-planned fixed-dark/icon-only hero — an earlier, undocumented in-session decision that superseded the old plan and was kept, since it's real and not fabricated).

User re-confirmed via batched questions: stats bar stays but real-facts-only (kept the 4 existing items), testimonials section omitted entirely (Banani's 3 testimonials cite fictional named doctors), full structural rebuild approved.

**Changes**: removed a pre-existing dead `#about` nav link; added the missing closing CTA band (dark `#162a26`, between Pricing and Footer) with honest copy (dropped Banani's "Rejoignez les cliniques d'Abidjan qui ont choisi MediClinic" implied-existing-customers claim); added icon-box wrappers to the 6 feature pills to match Banani's chip style; added responsive divider borders to the stats bar (divide-x desktop row / divide-x+divide-y tablet 2×2 / stacked dividers on narrow mobile); reordered footer to logo→links→copyright (Banani's order); swapped the "Toutes les fonctionnalités" button icon from `Plus` to `ArrowRight` to match Banani; changed hero primary CTA copy to "Commencer l'essai gratuit" (was "Découvrir nos offres") — more accurate than Banani's "Réserver une démo" since no demo-booking flow exists. Kept, not fabricated: module marquee, pricing section (real 15 000 FCFA plan — Banani's fetch had no pricing screen), hero's real subscription-fact badge and 14-day-trial trust line (already replacing Banani's fake "82% précision" stat and unverified "approuvé par des hôpitaux" claim from the original 07-21 pass). Verified with `tsc -b`, `oxlint`, and `npm run build` (all clean).

## 2026-07-27 Banani re-fetch — Abonnement/pricing screen applied to Landing Page

Same screen re-selected (`new_screen10.jsx`, "Abonnement — Choisir un plan") — already implemented once for `SettingsPage.tsx`'s billing tab (see 2026-07-26 entry above); this time applied to the **public, logged-out** Landing Page's stale single-card "Tarifs" section (`frontend/src/pages/LandingPage.tsx`, `#pricing`), which still showed a leftover 15 000 FCFA/mois "everything included" card from before the 3-tier model shipped (plan: `abonnement-choisir-plan.md`, 2026-07-27 addendum).

Replaced with the real 3-card Starter/Clinique/Hôpital grid, matching Banani's header copy exactly ("Nos formules" eyebrow / "Choisissez votre plan" / subtitle). Reused every decision already confirmed for this same screen's Settings-page pass (tier names, real-data-derived 6-row comparison, dropped "support email" claim, dropped the WhatsApp/email FAQ card — fabricated `wa.me/...` contact links have now been caught and removed 3 times this session). New for this location: since the landing page is logged-out (no `GET /settings/plans`, auth-gated), plan data is a hardcoded snapshot of `backend/utils/plans.js`'s real `PLANS` values rather than fetched — flagged in the plan file to keep in sync manually if pricing changes; all 3 CTAs route to `onNavigate('register')` (no unauthenticated checkout path exists anywhere in this app); added a new shared `.pricing-cards-grid` class to `index.css` rather than reusing `SettingsPage.tsx`'s page-local `.plan-cards-grid`, to avoid touching that already-shipped page. Kept the existing real Mobile Money payment-badge row unchanged below the grid.

Verified: `npm run build` / `npm run lint` clean, no new warnings. **Not visually verified in a live browser** — no browser-driving tool available this session; recommend a manual check at 375/850/1280px before treating as fully pixel-verified.

## 2026-07-27 Banani re-fetch — Platform Admin pixel-parity token pass (all 5 sections + mobile)
Re-selected screen was still `new_screen9.jsx` (no dedicated Abonnements screen exists in the Banani flow — confirmed with user via AskUserQuestion, who chose to apply the Banani design system to the whole console rather than just the Abonnements tab). Full details in `platform-admin.md`'s 2026-07-27 entry. Summary: applied Banani's real token set as a `.platform-admin-shell`-scoped fixed light palette (independent of the app's dark/light toggle, same reasoning as the Landing Page's fixed theme), fixed a real pre-existing gap (Platform Admin's tables are bare `<table>` elements with zero styling beyond the wrapper), recolored the sidebar to Banani's exact hex tokens, and built a mobile-first horizontal-scroll nav strip below 900px (Banani's mock is desktop-only, no mobile design to copy). First real browser-verified Banani pass in this project this session — Playwright+Chromium installed in the scratch dir, screenshotted 375/768/1280px, one real mobile bug caught and fixed (nav accidentally hidden alongside the branding block). `tsc -b`/`lint` clean. Also fixed an unrelated, separately-reported bug in the same page: all non-overview sections (Utilisateurs/Abonnements/Support) were gated behind a single `!overview` check even though they fetch their own data independently — a `/platform/overview` failure (most likely `clinics.unlimited_staff`/`suspended_by_platform` schema drift, see CLAUDE.md's known gotcha) was blanking every tab, not just Vue d'ensemble/Cliniques.

## 2026-07-27 — Sidebar footer overflow fix, "Mon profil" page, Conditions d'utilisation re-fetch, Dashboard trial banner
Several smaller items in one session, not all MCP-driven:
- **`Sidebar.tsx` real bug**: the fixed `height:100vh` aside had no internal scroll, so a long nav list (worse for admin, who also sees the "Administration plateforme" entry) could push the profile/logout footer off-screen with no way to reach it. Fixed by making `<nav>` its own `flex:1; overflow-y:auto` region between a fixed-size header and a `flexShrink:0` footer. Verified with Playwright at a deliberately short 480px-tall viewport — footer stays pinned, nav scrolls independently.
- **New "Mon profil" page** (spec: `docs/superpowers/specs/2026-07-27-user-profile-page-design.md`) — clicking the name/avatar in the Sidebar footer (previously dead) now opens `frontend/src/pages/Profile/ProfilePage.tsx`, no role gate. Closes a real gap: `Paramètres` (the only place password-change UI existed) is admin/manager-only, so secretary/doctor/pharmacist/lab_tech/nurse had zero self-service password change before this. Extracted the password form into a shared `frontend/src/components/PasswordChangeForm.tsx`, used by both the new page and `SettingsPage.tsx`'s unchanged "Sécurité" tab. Verified logged in as a secretary account — reaches the page and the form renders correctly.
- **`OrdonnancesPage.tsx` bug fixes** (not a re-fetch, a live-bug report): removed a fully duplicate page-local header (hardcoded "Lundi 14 juillet 2025" date, an unwired second search box, a second non-functional notification bell — the real `Header.tsx` above already has both, also non-functional) that was pure leftover Banani-mockup chrome; removed fake `|| 1`/`|| 2`/`|| 1` fallback counts on the filter pills that fabricated a minimum count even when the real count was 0; made the "Juillet 2025" month label real (`toLocaleDateString`) instead of hardcoded.
- **Conditions d'utilisation re-fetch** (plan: `terms-of-service.md`) — fetched `TermsOfServiceMobile.jsx` + `TermsOfServiceDesktop.jsx` (the existing page had been built from a screenshot earlier, not an MCP fetch). User chose to switch this one page from the shared fixed-dark Landing/Auth shell to Banani's actual light theme (deliberate one-page exception, confirmed via AskUserQuestion) — new `.terms-page` scoped token block in `index.css`, mirrors the `.platform-admin-shell` pattern. Content stays placeholder-bracketed (no fabricated "MediClinic SARL"/SLA numbers/version string) per user's explicit choice, **except** contact email/phone which are now real (`blog.ousmane@gmail.com` / `+225 07 88 81 81 18`, supplied by the user). Dropped Banani's fake "Accepter et continuer"/"Refuser" buttons (no ToS-acceptance tracking exists) and 2 of its 3 footer links (no Privacy/Contact pages exist). Verified visually at 375/768/1280px.
- **Dashboard trial-countdown banner** (from a user-supplied screenshot, not an MCP fetch) — new amber gradient card on `Dashboard.tsx`, shown only to `admin` role on `clinic.plan === 'starter'` with `subscription_expires_at` still in the future (Starter's 7-day trial, see `backend/utils/plans.js`), same day-diff formula already used by `Header.tsx`'s expiry chip. Copy adapted from Banani's generic "Pro"/"premium" wording to this app's real tier language (no such tier exists) — CTA routes to `Paramètres`'s billing tab. Gated to admin since non-admin roles can't reach the billing tab to act on it anyway. Visually verified by temporarily forcing the condition true, then reverted before considering the change done.

All of the above: `tsc -b` and `npm run lint` clean, no new warnings.

## 2026-08-02 Banani fetch — Nouveau Rendez-vous (full-page rebuild, not a modal restyle)
Fetched `new_screen11.jsx` ("Nouveau Rendez-vous", desktop) + `NewAppointmentMobile.jsx` (plan: `nouveau-rendez-vous.md`). Genuinely new UX, not a polish pass on the existing small booking modal in `AppointmentsPage.tsx` — user explicitly chose (batched question, before any code) to turn "Ajouter un RDV" into a dedicated full view instead of enriching the modal, same `PatientDetailPage`-style local view-toggle pattern (no new Sidebar entry, no new `App.tsx` tab).

New: `frontend/src/pages/Appointments/NewAppointmentPage.tsx` (single file, mobile-first CSS, 2-col ≥1024px). `AppointmentsPage.tsx`'s old modal (state + JSX) removed entirely; "Ajouter un RDV" now flips a local `view: 'list'|'new'` state.

User decisions (all bigger-scope options chosen over the no-fabrication defaults):
1. **`appointments.priority`** (`normal|urgent|critical`) added as a real column — wired end-to-end (`GET/POST/PUT /api/appointments`).
2. **`users.specialty`** (free text) added as a real column — wired into `GET/POST/PUT /api/settings/users` and a new input in `SettingsPage.tsx`'s staff-add form (doctor role only).
3. Banani's fixed "Type de consultation" dropdown → quick-fill suggestion chips writing into the existing real `motif` field (no new schema, no fake taxonomy).
4. "Salle / Espace" kept as free text (already real) rather than becoming Banani's fixed-option dropdown — a fixed room list would reintroduce the fabricated "rooms" concept already rejected on `Dashboard.tsx` (2026-07-22 audit).
5. Mini-calendar (off-days greyed) + time-slot grid (taken/free) are **real**, derived from the selected doctor's `work_schedule` and existing `GET /appointments?practitionerId=&date=` — not hardcoded like Banani's mock.
6. "Patients récents" strip = 3 most-recently-created active patients (`created_at desc`), an interpretation flagged in the plan file, not literally "recently seen."
7. Doctor `UserAvatar` (AI photography) → initials-in-a-circle, established pattern. Banani's mock `Sidebar`/`TopBar` dropped, real components reused.

**Requires 2 manual migrations before this works against live Supabase** (same schema-drift pattern as every prior column addition):
```sql
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'critical'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT;
```
(Already run by the user this session against the shared dev Supabase project — confirmed via a live `GET /settings/users` call returning the new `specialty` field with no error.)

**Incidental fixes made while testing (unrelated to Banani, pre-existing data drift)**: seeded `admin@mediclinic.com` and all 6 other seeded staff accounts were found with `active: 0` in the live DB, contradicting CLAUDE.md's "Test accounts (seeded)" table — reactivated all 7 directly via the service-role client to restore the documented baseline. Root cause not investigated (out of scope), flagged here in case it recurs.

Verified end-to-end against the running local backend + dev-server Playwright session: real doctors (with null `specialty`, correctly hidden rather than showing a placeholder), real recent patients, calendar/slot generation from `work_schedule` (falls back to 08:00–18:00 in 30-min steps when no schedule configured, per the existing "no schedule = always available" convention), a full booking submitted and confirmed present in the DB with `priority: 'normal'` persisted, then cleaned up. Screenshotted at 375/768/1280px, no console errors at any width. `tsc -b`, `npm run lint`, and `npm run build` all clean.

### 2026-08-02 addendum — pixel-parity correction pass (user screenshot feedback)
User compared 2 Banani source screenshots against 2 of the shipped implementation and flagged 3 concrete deltas: missing header-level Annuler/Confirmer button pair, a stray/wrongly-styled Annuler button inside the bottom dark recap box (doesn't exist in Banani's source), and the Priorité selector's selected state missing a background-color fill (unlike doctor-card/patient-chip selected states elsewhere on the same page).

Fixed all 3 in `NewAppointmentPage.tsx`: restructured so `<form>` now wraps a new header row (back-button + title on the left, "Annuler" + "Confirmer le rendez-vous" pair on the right, `justifyContent: 'space-between'`); removed the recap box's stray Annuler button and shortened its remaining button label to just "Confirmer" (matching Banani's distinct copy for the two CTAs); added a `bgLight` field to each `PRIORITIES` entry (`var(--primary-light)`/`var(--warning-light)`/`var(--danger-light)`) wired into the selected button's `backgroundColor`.

Re-verified with a fresh Playwright pass at 375/768/1280px (screenshots regenerated, all 3 widths viewed) — header buttons wrap sensibly on narrow mobile, recap box shows only "Confirmer", Normal priority shows the teal-tinted fill when selected. `tsc -b`, `npm run lint` (only pre-existing unrelated warnings elsewhere in the codebase), and `npm run build` all clean.

## 2026-08-09 Banani re-fetch — Platform Admin, passe de parité pixel
Plan : `platform-admin-pixel-parity-2026-08-09.md`.

**Piège de départ, à retenir.** L'utilisateur a demandé cette passe avec une
capture de la Vue d'ensemble, mais la sélection Banani pointait encore sur
`new_screen11.jsx` (Nouveau Rendez-vous), restée de la session du 02-08 et déjà
implémentée. L'écran voulu, `new_screen9.jsx`, a été récupéré par `screenIds`
explicite — l'identifiant était noté dans `platform-admin.md`. **Avant de
construire à partir d'une sélection Banani, vérifier qu'elle correspond bien à
ce que l'utilisateur décrit** : les deux avaient déjà été livrés, et rien dans
la réponse du MCP ne signale qu'une sélection est périmée.

**Rappel structurel, troisième fois que la question se pose** (2026-07-26,
2026-07-27, aujourd'hui) : le flux Banani n'a **qu'un seul écran** pour toute la
console, `new_screen9.jsx`. Cliniques, Utilisateurs, Abonnements, Support,
Notifications, Rapports, Sécurité et Config. système n'ont aucune maquette.
« Pixel-parfait » ne peut porter que sur la Vue d'ensemble.

Backend : `GET /platform/overview` gagne les variations mensuelles
(`clinicsNewThisMonth`, `usersNewThisMonth`, `lastMonthRevenue`,
`revenueDeltaPct`, ce dernier `null` quand le mois précédent est à zéro) ;
`POST /api/platform/clinics` est nouveau — création d'une clinique et de son
admin par l'opérateur, aux règles exactes de `POST /auth/register`, avec
suppression de rattrapage si l'insertion de l'admin échoue. 12 tests
(`platform-clinic-create.test.js`), total du dépôt à **190**.

Frontend : cartes de stats calées sur les 4 de Banani avec ligne de variation
(choix utilisateur : « Cliniques expirées » quitte la rangée) ; nouveau
`SystemHealthPanel` alimenté par `GET /platform/config`, où le mode e-mail
`console` et la limitation de débit en mémoire s'affichent « Dégradé » parce
qu'ils le sont ; bandeau haut avec sous-titre daté et bouton « Nouvelle
clinique » ouvrant un `NewClinicForm` ; lien « Voir toutes (n) → » au-delà de
5 cliniques. Écartés faute de source réelle : la cloche à compteur et la ligne
« Sauvegardes » du panneau santé — mêmes motifs que les suppressions de
2026-07-26.

Trois défauts de mise en page corrigés en chemin, dont un préexistant : dans le
journal d'activité, `flexShrink: 0` sur le nom de clinique poussait le libellé
hors de la carte, coupé net à 375px sans défilement pour le lire.

Vérifié : 190 tests, `tsc -b`/lint/build propres, captures Playwright à
375/768/1280px. **Méthode de capture à réutiliser** : routes `/api/**`
interceptées et servies depuis des fixtures, donc le vrai composant React est
rendu sans qu'aucune requête ne touche la base de production. Deux pièges
rencontrés — des fixtures incomplètes font planter le Dashboard traversé avant
la console et emportent tout l'arbre React (page blanche, barre latérale
comprise), et le lien d'entrée s'atteint via le bouton `aria-label="Menu
principal"` sous 900px.
