# Platform Admin Controls — Design

Date: 2026-07-26
Status: Approved by user, ready for implementation planning

## Context

Follow-up to the Support ticket system (shipped this session). The user flagged that the Platform Admin console (`frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`) has non-functional elements and is missing operator controls:
- The Cliniques/Utilisateurs/Abonnements tables are 100% read-only — no way to act on a specific clinic or user from the console.
- No way to grant a specific clinic an exception to its plan's staff limit without changing its billed plan.
- No way to lock a clinic out entirely (e.g. serious non-payment, abuse) short of leaving its subscription to expire naturally.
- No search/filter on any of the three tables.

## Decisions (confirmed with the user via AskUserQuestion)

1. **Unlimited-staff override**: a per-clinic manual override, independent of the clinic's billed plan (`clinics.plan` stays whatever it is) — a Super Admin action, not a plan change.
2. **Clinic suspension ("kill switch")**: blocks all write access for every user in that clinic, same enforcement point as `SUBSCRIPTION_EXPIRED` in `middleware/auth.js`, but with no self-service unlock — a clinic cannot pay its way out of a suspension, only a Super Admin reversing the toggle lifts it.
3. **Data model**: two separate boolean columns on `clinics` (`unlimited_staff`, `suspended_by_platform`), not a reused `subscription_status` value — keeps billing state (trial/active/expired, driven by payment webhooks) uncontaminated by manual platform actions.
4. **Cross-clinic user deactivation**: Platform Admin's Utilisateurs table gets a real Activer/Désactiver action per row (not just read-only), for emergency use (e.g. a compromised account) without needing to go through that clinic's own admin.
5. **Search/filter scope**: Cliniques and Utilisateurs get search + status filters; Abonnements gets a status filter on its clinics sub-table only. All client-side (data is already fetched in full in one call per section; no pagination needed at this SaaS's expected clinic count).

## Architecture

### Schema (`backend/supabase_schema.sql`)

```sql
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS unlimited_staff BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS suspended_by_platform BOOLEAN NOT NULL DEFAULT FALSE;
```

Same schema-drift constraint as every other change this session (see CLAUDE.md's "Known gotcha") — these need to be run by hand in the Supabase SQL Editor before the feature works against the live DB.

### Backend enforcement

**`backend/utils/plans.js`** — `isStaffLimitReached(planId, currentActiveStaffCount, unlimitedOverride)` gains a third parameter (default `false` for existing callers that don't pass it, though all call sites below are updated to pass it). Returns `false` immediately when `unlimitedOverride` is true, before consulting the plan's `staffLimit`.

Call sites that must now fetch `unlimited_staff` alongside `plan` and pass it through:
- `backend/routes/settings.js` — `POST /users` (staff add), `PUT /users/:id` (reactivation)
- `backend/routes/auth.js` — `POST /onboarding` (bulk staff add)

**`backend/middleware/auth.js`** — the clinic lookup query adds `suspended_by_platform` to its `select`. New check, evaluated alongside the existing expiry check:

```js
const isSuspended = clinic.suspended_by_platform === true;
```

If `isSuspended && !isReadRequest`, block with `403` and a **new** error code `ACCOUNT_SUSPENDED` — deliberately **not** allowlisting `/financials/subscription` or `/settings/plan` the way `SUBSCRIPTION_EXPIRED` does, since paying does not lift a platform-imposed suspension. If both `isSuspended` and the existing `isExpired` are true, the suspension message takes priority (it's the more specific, more severe state). `/auth/logout` stays allowed either way, matching the existing behavior.

Message: `"Ce compte a été suspendu par l'administrateur de la plateforme. Contactez le support pour plus d'informations."`

### New backend endpoints (`backend/routes/platform.js`)

All gated by the existing `router.use(auth, superAdminOnly)`. Each is the first mutation-writing-an-activity-log in this file (today it writes none) — the affected clinic's own activity feed should show what a platform operator did to it, for transparency to that clinic's staff.

- **`PUT /platform/clinics/:id/staff-override`** — body `{ unlimited: boolean }`. Updates `clinics.unlimited_staff`. Writes `activity_logs` (`clinic_id: <target>`, `action: 'PLATFORM_STAFF_OVERRIDE'`, `details` describing on/off).
- **`PUT /platform/clinics/:id/suspend`** — body `{ suspended: boolean }`. Updates `clinics.suspended_by_platform`. Writes `activity_logs` (`action: 'PLATFORM_CLINIC_SUSPENDED'` or `'PLATFORM_CLINIC_REACTIVATED'`).
- **`PUT /platform/users/:id`** — body `{ active: boolean }`. Looks up the target user's `clinic_id` first; `404` if not found; `400` if `req.user.userId === req.params.id` (a Super Admin cannot deactivate their own account through this endpoint — self-lockout guard). Updates `users.active`. Writes `activity_logs` against that user's own clinic (`action: 'PLATFORM_USER_DEACTIVATED'`/`'PLATFORM_USER_ACTIVATED'`).

### Extended existing responses

- `GET /platform/overview`'s `clinics` array (and thus the `ClinicOverview` shape used by the Cliniques table) gains `unlimitedStaff: boolean` and `suspended: boolean`, sourced from the same `clinics` select this endpoint already does.
- `GET /platform/users`'s rows already include `active`; no shape change needed, only a new mutation endpoint.

## Frontend (`frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`)

**Cliniques section:**
- Search input (filters by clinic name, client-side) + status filter pills (Tous/Actif/Expiré/Suspendu) above the table, same visual pattern as the `TicketsSection` filter pills built for support tickets.
- Status badge logic: `Suspendu` (new, e.g. a dark/red badge) takes priority over `Actif`/`Expiré` when `suspended` is true.
- New "Illimité" column: a green "Illimité" badge when `unlimitedStaff` is true, empty cell otherwise.
- New "Actions" column: a "Gérer" button expanding an inline row (same expand-in-place pattern as `TicketsSection`'s "Gérer" on tickets) containing two toggle buttons: "Rendre illimité" / "Retirer l'illimité" (calls the staff-override endpoint) and "Suspendre" / "Réactiver" (calls the suspend endpoint, ideally with a confirm step given its severity — a native `window.confirm` is enough, matching this app's lack of a custom confirm-dialog component elsewhere).

**Utilisateurs section:**
- Search input (name/email) + role filter (dropdown or pills) + status filter pills (Tous/Actif/Inactif), client-side.
- "Actions" column: Activer/Désactiver button per row, disabled (or hidden) on the row matching the logged-in Super Admin's own account.

**Abonnements section:**
- Status filter pills (Tous/Actif/Expiré) above the "Statut d'abonnement par clinique" sub-table only. Payment history sub-table unchanged.

## Error handling

- `PUT /platform/clinics/:id/staff-override` / `/suspend`: `404` if clinic doesn't exist; `400` if the body's boolean field is missing/not a boolean.
- `PUT /platform/users/:id`: `404` if user doesn't exist; `400` if targeting the caller's own account or if `active` isn't a boolean.
- All three follow this codebase's existing convention: French error messages, `500` with a generic message on unexpected Supabase errors, specific `400`/`404` for validation/not-found.

## Testing / verification plan

No automated test suite (per CLAUDE.md). Verification: `npm run build` + `npm run lint` (frontend), `node -c` on touched backend files, then manual `curl` smoke tests for each new endpoint (happy path + the two guard cases: self-deactivation rejected, missing/invalid body rejected), followed by a manual dev-server pass — toggle a test clinic's override and suspension from Platform Admin, confirm a suspended clinic's own login then gets blocked on a write (e.g. creating a patient) with the new `ACCOUNT_SUSPENDED` message, confirm reactivating clears it. Same verification bar as the support ticket system.

## Out of scope (explicitly deferred, not forgotten)

- Pagination on any of the three tables — deferred until clinic/user counts actually warrant it (client-side filtering is sufficient at today's scale).
- Filtering/search on the Abonnements payment-history sub-table.
- A dedicated confirm-dialog component — reusing `window.confirm` for the suspend action, consistent with this codebase having no existing custom confirm modal.
- Changing `GET /platform/overview`'s aggregate stats to account for suspended clinics (e.g. a "Cliniques suspendues" stat card) — not requested, can be added later if wanted.
