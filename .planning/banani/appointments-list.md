# Rendez-vous — Liste complète — Banani → MediClinic (React + plain CSS)

## Source
- Banani flow: MediClinic Gestion Clinique (`uh1OcdtphSFV`)
- Screen: `AppointmentsList.jsx` ("Rendez-vous — Liste complète")
- Fetched: 2026-07-24

## System context (Step 0 answers)
1. Route: no router — tab `'appointments'` in `App.tsx`, renders `AppointmentsPage`.
2. Auth-gated: yes, inside the authenticated shell (`MainAppContent`), behind the real `Sidebar`/`Header`.
3. Reads: `GET /api/appointments?date=&practitionerId=&status=` (real, already wired). `GET /api/settings/users` for practitioner list. `GET /api/patients?q=` for the booking modal's patient search.
4. Writes: `POST /api/appointments` (book), `PUT /api/appointments/:id` (status/reschedule) — both already wired and working.
5. Nav: arrives from Sidebar or Dashboard quick action; booking modal can be triggered from Dashboard's "Prendre un RDV" too (`triggerOpenModal` prop). No existing "view appointment detail" destination.
6. Reuse: project's real `Sidebar`/`Header` (NOT Banani's mock ones — those have no real auth/session wiring). Reuse `.modal-backdrop`/`.modal-content`/`.card`/`.badge` project classes and `var(--*)` CSS tokens instead of Banani's separate `@theme` palette (the project's greens already match Banani's teal-green closely — no need for a second token system).
7. Empty/loading/error: already implemented (loading text, "Aucun rendez-vous..." empty state) — will restyle to match new card look, keep the logic.
8. Side effects: booking already triggers a simulated SMS popup (unrelated to this restyle, left as-is).

## Data gaps vs. Banani mock (fabricated fields that don't exist in the real schema)
Banani's mock `appointments` array invents: `age`, `room` ("Salle 1/2/3"), `type` (medical specialty like "Cardiologie", "Pédiatrie"), `notes`, a 4th status `"En consultation"`, and photographic avatars (`UserAvatar` with gender/heritage/index — AI-generated diverse stock photography).

Real schema (`appointments`, `patients`, `users`) has: `date_time`, `duration`, `motif` (free-text reason), `status` (`scheduled|completed|cancelled` — no in-progress state), patient `first_name/last_name/phone/birth_date`, practitioner `name`. No `room`/exam-room concept, no categorized visit "type", no separate `notes` field.

**My plan (flagging per project's established no-fabrication policy — same rule already applied to Dashboard/Pharmacy/Patients this session):**
- `age` → real, computed from `patients.birth_date` (need to add `birth_date` to the backend's `patients:patients(...)` select in `GET /appointments` — trivial, already-real field, just not currently selected).
- `room` → **dropped**, no backing data.
- `type` badge → repurposed to show the real `motif` (reason for visit) instead of inventing a specialty taxonomy.
- `notes` footer → **dropped**, no backing data (motif already covers this slot).
- Status → keep the real 3 states, restyled with Banani's badge treatment (`scheduled`→"Planifié" muted, `completed`→"Terminé" success, `cancelled`→"Annulé" danger). No fake "En consultation" state added.
- Avatars → initials-in-a-circle (already the pattern used on `Dashboard.tsx`'s appointment rows), not AI stock photography.
- Filter chip counts (Banani: hardcoded "Tous 27 / En attente 8 / En cours 1 / Terminés 18") → computed live from the actually-fetched appointment list for the selected date/practitioner, and made functional (clicking a chip filters the visible list by status client-side — currently no status filter exists on this page).
- "Exporter" button → disabled with a "Bientôt disponible" tooltip, same treatment already given to `LaboratoryPage.tsx`'s Exporter (no export endpoint exists).
- "Aujourd'hui" button → wired for real: resets the existing `filterDate` state to today.
- "Ajouter un RDV" → opens the existing (already-functional) booking modal, unchanged.
- Card's "Consulter" action → **open question, see below**.

## Component breakdown
- **REUSE** real `Sidebar`, `Header` (project components, already imported by `App.tsx`)
- **NEW** `AppointmentStatusChips` — small local component/inline block in `AppointmentsPage.tsx` (not worth extracting to `ui/` yet, only used once)
- **REWORK** the existing card markup (currently only used for the mobile view) into the single responsive list layout, replacing the desktop `<table>` — Banani's design is card-based at every width, which is simpler and already mobile-first; retiring the separate `desktop-table-container`/`mobile-cards-container` split.
- Booking modal: **unchanged**, not part of the fetched Banani screen.

## Token mapping (Banani → project)
| Banani | Project |
|---|---|
| `--color-primary #3D6B5E` | `var(--primary)` |
| `--color-card #FFFFFF` | `var(--bg-secondary)` |
| `--color-border #D6D2CB` | `var(--border)` |
| `--color-muted` (badge bg) | `var(--bg-tertiary)` / `.badge` |
| `--color-success` | `var(--success)` / `.badge-success` |
| `--color-danger` | `var(--danger)` / `.badge-danger` |
| `radius-lg 10px` | `var(--radius-md)` |
| `font-headings/body: DM Sans` | project's existing `var(--font-primary)`/`var(--font-secondary)` (not swapping fonts app-wide for one page) |

## Responsive plan
- **Base (375px)**: single-column card list (this is already how Banani designed it — no desktop/mobile fork needed). Header stacks title above the "Ajouter un RDV" button; filter chips wrap; date/practitioner selects go full-width stacked.
- **md (768px+)**: header row becomes side-by-side (title left, button right); filter chips + Aujourd'hui/Exporter share one row.
- Card internals: avatar+name+phone+badges stack tightly on mobile; time/status/actions move under the main content block instead of floating right (Banani's right-aligned time/actions column only works ≥ ~480px).

## Open questions for user
1. **"Consulter" button** — Banani shows it on every card with no defined destination. The app already has a working patient record page (`PatientDetailPage`, reached via `Patients` tab). Proposal: wire "Consulter" to open that patient's record (adds a small prop chain: `AppointmentsPage` gets an `onViewPatient(patientId)` callback from `App.tsx`, same pattern already used by `PatientsPage`). Confirm, or tell me what it should do instead.
2. **Status filter chips**: OK to replace Banani's 4 states (`Tous/En attente/En cours/Terminés`) with the real 3 (`Tous/Planifiés/Terminés/Annulés`) — i.e. add "Annulés" (real, currently has no chip) and drop the fictional "En cours"?
3. Fine with dropping `room`/`notes` entirely (no schema change) rather than adding new backend columns to support them? (Bigger option: add `room` + `notes` as real columns — happy to do this instead if you actually want per-visit exam-room assignment and free notes as a feature, but that's a separate scope from "restyle to match Banani.")

Proceeding with the stated defaults for everything else; will hold on implementation only for these three answers.
