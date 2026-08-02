# Nouveau Rendez-vous (full page) — Banani → MediClinic (React + plain CSS)

## Source
- Banani flow: MediClinic Gestion Clinique (`uh1OcdtphSFV`)
- Screens: `new_screen11.jsx` ("Nouveau Rendez-vous", desktop) + `NewAppointmentMobile.jsx` ("Nouveau Rendez-vous — Mobile")
- Fetched: 2026-08-02

## System context (Step 0 answers)
1. Route: no router — `App.tsx` manual tab state. Existing `AppointmentsPage` currently opens a small booking modal via `isModalOpen`. Per user decision (this session), this becomes a **dedicated full view** instead of a modal: `AppointmentsPage` gets a local `view: 'list' | 'new'` state (same pattern as `PatientDetailPage`'s `selectedPatientId` toggle inside the `patients` tab — no new Sidebar entry, no new `App.tsx` tab).
2. Auth-gated: yes, same as the rest of `AppointmentsPage`.
3. Reads: `GET /api/patients?q=` (search + "recent" — interpreted as most-recently-created patients, real `created_at` ordering, no new endpoint), `GET /api/settings/users` (real doctors, now including `specialty`/`work_schedule`), `GET /api/appointments?date=&practitionerId=` (existing, used to compute taken time slots for the selected doctor+day).
4. Writes: `POST /api/appointments` (unchanged endpoint, now also sends `priority`).
5. Nav: "Ajouter un RDV" button switches `AppointmentsPage`'s local view to `'new'` instead of opening the modal. "Annuler"/back arrow returns to `'list'`. Successful booking returns to `'list'` and re-fetches (existing SMS-simulation popup unchanged).
6. Reuse: real `Sidebar`/`Header` (already wrapping `AppointmentsPage` in `App.tsx`, unchanged) — drop Banani's mock `Sidebar.jsx`/`TopBar.jsx` entirely, per established project precedent.
7. Empty/loading/error: doctor list empty → real message (matches `OrdonnancesPage`/`PatientsPage` precedent); no doctors' work_schedule configured → all slots shown open (existing `computeEffectiveAvailability` "no schedule = always available" convention).
8. Side effects: booking still triggers the existing simulated-SMS popup (`smsSimulated` from `POST /appointments`) — unchanged.

## User decisions (batched question, answered before this plan was written)
1. **Architecture**: dedicated full view (not an enriched modal) — bigger structural change, confirmed.
2. **Priorité** (Normal/Urgent/Critique): add as a **real column** — `appointments.priority TEXT DEFAULT 'normal' CHECK (IN normal/urgent/critical)`. Already added to `supabase_schema.sql` + `CLAUDE.md` pending-migration list; wired into `GET/POST/PUT /api/appointments`. **Requires manual `ALTER TABLE` on live Supabase before priority actually persists** (same schema-drift pattern as every other column added this project).
3. **Spécialité** per doctor: add as a **real column** — `users.specialty TEXT`, free text (no fabricated fixed taxonomy). Wired into `GET/POST/PUT /api/settings/users`. Also requires a manual migration.
4. **Type de consultation** (Banani's fixed dropdown): becomes **quick-fill suggestion chips** that write into the existing real free-text `motif` field — no new schema, no dropdown-shaped fake taxonomy.

## Data gaps vs. Banani mock (fabricated fields, and this pass's resolution)
- Doctor names ("Dr. Yao Bernard" etc.) → real doctors from `GET /settings/users` filtered `role==='doctor' && active===1` (same as `OrdonnancesPage`'s prescriber picker, fixed 2026-07-31).
- Doctor `specialty` subtitle → now real (`users.specialty`, optional — shows nothing if unset, not a placeholder string).
- `UserAvatar` (AI stock photography) → initials-in-a-circle, established project pattern.
- "Patients récents" strip → real, interpreted as the 3 most-recently-created active patients (`GET /patients`, client-sorted by `created_at desc`, sliced to 3) — not a fabricated list. Flagged as an interpretation, not literally "recently seen."
- Mini calendar available/unavailable days + "Créneaux disponibles" taken/free grid → **real**, computed from the selected doctor's `work_schedule` (off-days greyed on the calendar, hours outside the window excluded from the slot grid) and existing appointments for that doctor+day (`GET /appointments?date=&practitionerId=`) marking exact taken slots. Slot grid step: 30 minutes, matching the existing `bookingDuration` default.
- "Salle / Espace" as a fixed-option dropdown ("Salle 1/2/3") → kept as the existing **free-text** input (already a real column) — a fixed enumerated room list would reintroduce the fabricated "rooms" concept already rejected once on `Dashboard.tsx` (2026-07-22 audit).
- "Type de consultation" fixed dropdown → quick-fill chips over common French motifs (see decision 4 above), writing into the real `motif` field.
- HTA-style allergy/condition badge on the selected-patient card → real, reuses `patients.allergies` (already surfaced elsewhere, e.g. Deposits' patient strip).

## Component breakdown
- **REUSE** real `Sidebar`, `Header` (unchanged, already wrapping the tab in `App.tsx`)
- **NEW** `frontend/src/pages/Appointments/NewAppointmentPage.tsx` — the full view, rendered in place of the list when `AppointmentsPage`'s local `view === 'new'`
- **NEW (small, inline)** mini-calendar + time-slot grid blocks inside `NewAppointmentPage.tsx` (not worth a standalone primitive yet — single call site)
- Booking modal in `AppointmentsPage.tsx`: **removed**, replaced by the view switch

## Token mapping (Banani → project)
| Banani | Project |
|---|---|
| `--color-primary #3D6B5E` | `var(--primary)` |
| `--color-card #FFFFFF` | `var(--bg-secondary)` |
| `--color-border #D6D2CB` | `var(--border)` |
| `--color-input #ECEAE5` | `var(--bg-tertiary)` |
| `--color-danger` / `warning` / `success` | `var(--danger)` / `var(--warning)` / `var(--success)` |
| `radius-md 6px` / `radius-lg 10px` | `8px` / `var(--radius-md)` (existing scale) |
| `font-body/headings: DM Sans` | project's existing `var(--font-primary)`/`var(--font-secondary)` — not swapping fonts for one page |

## Responsive plan
- **Base (375px)**: single column, sections stacked exactly as `NewAppointmentMobile.jsx` (Patient → Consultation/Médecin → Date & Heure → Notes → Récapitulatif → CTAs), full-width buttons, compact mobile header with back arrow (reuses the real `Header`, so no duplicate mobile top bar — Banani's mobile mock has its own header, dropped per the no-duplicate-chrome precedent already applied to `OrdonnancesPage`).
- **md/lg (≥1024px)**: two-column layout — left form column + right 288px-ish sticky column (mini calendar, time slots, summary box), matching `new_screen11.jsx`.
- Doctor picker: 2-col grid on mobile, 4-col on desktop. Time-slot grid: 3-col mobile (matches mock's `grid-cols-3`)... actually mobile mock uses `grid-cols-4` for slots and `grid-cols-2` for doctors — will follow mobile mock exactly, desktop mock's own grids (`grid-cols-4` doctors, `grid-cols-3` slots) for ≥1024px.

## Interactions / state
- Selecting a recent-patient chip or a search result fills the "selected patient" card (existing search dropdown logic reused, just relaid out).
- Selecting a doctor updates the mini-calendar's off-days and the time-slot grid's taken/open state (re-fetches `GET /appointments?practitionerId=&date=` for the visible month/day as needed).
- Quick-fill motif chips: clicking sets/overwrites the `motif` text input; input stays freely editable after.
- Priority: 3-way selector (Normal/Urgent/Critique), defaults to Normal.
- Empty states: no doctors → real message + link-style hint to add one in Paramètres; no patients found in search → "Aucun patient trouvé."; all slots taken for the day → message, calendar still lets picking another day.

## Copy / i18n
All strings in French, matching Banani's copy where sensible (`Nouveau rendez-vous`, `Confirmer le rendez-vous`, `Rechercher un patient existant`, `Créneaux disponibles`, `Récapitulatif`, etc). No English.

## Implementation checklist
- [x] Backend: `appointments.priority`, `users.specialty` added to schema + CLAUDE.md pending migrations
- [x] Backend: `GET/POST/PUT /api/appointments` read/write `priority`
- [x] Backend: `GET/POST/PUT /api/settings/users` read/write `specialty`
- [ ] Frontend: `specialty` input in `SettingsPage.tsx`'s staff add/edit form (doctor/nurse only, same gate as `work_schedule`)
- [ ] Frontend: `NewAppointmentPage.tsx` (desktop layout ≥1024px + mobile layout <1024px, one component, CSS-driven)
- [ ] Frontend: real doctor grid w/ specialty, real recent-patients strip, real mini-calendar + slot grid from `work_schedule` + existing appointments
- [ ] Wire `AppointmentsPage.tsx`'s "Ajouter un RDV" to the new view instead of the modal; remove old modal JSX
- [ ] 375px / 768px / 1280px visual check (Playwright, scratch dir)
- [ ] `tsc -b` / lint clean
- [ ] Update `STATUS.md`

## Open questions for user
None outstanding — all four blocking decisions were answered before this plan was written. Two follow-on migrations (`appointments.priority`, `users.specialty`) still need to be run by hand on the live Supabase DB before those fields persist, per this project's standing schema-drift constraint.
