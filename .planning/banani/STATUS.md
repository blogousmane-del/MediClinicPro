# Banani implementation status

Last updated: 2026-07-22

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
- `Gestion des abonnements` (+ Mobile) — Settings already has a working billing/subscription tab; not compared in detail against Banani's dedicated subscription screens.
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
