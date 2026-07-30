# Notifications & Super Admin Broadcast — Design

## Context

The notification bell in `Header.tsx` is dead UI: it renders a static unread dot with no click handler, no dropdown, no data behind it. Separately, the Super Admin (Platform Admin console) has no way to communicate with clinic users — e.g. to announce maintenance, plan changes, or policy updates.

This design covers both, unified into a single feature: the bell becomes a real notification center showing two kinds of items —
1. **Super Admin broadcasts** — messages sent by the SaaS operator to one, several, or all clinics.
2. **System alerts** — the same low-stock / near-expiry pharmacy alerts already computed for the Dashboard's "Alertes" widget, surfaced additionally in the bell.

Both kinds support individual per-user read/unread state.

## Data model

Two new tables plus one join table, added to `backend/supabase_schema.sql` (proposal — requires manual `CREATE TABLE` in the live Supabase SQL Editor per this project's schema-drift convention, see `CLAUDE.md`):

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by INTEGER REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_all BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_clinics (
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  clinic_id INTEGER NOT NULL REFERENCES clinics(id),
  PRIMARY KEY (notification_id, clinic_id)
);

CREATE TABLE notification_reads (
  user_id INTEGER NOT NULL REFERENCES users(id),
  notification_id TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, notification_id)
);
```

- `notifications` holds one row per broadcast send. `target_all = true` means every clinic sees it and `notification_clinics` is left empty for that row; `target_all = false` means only clinics listed in `notification_clinics` see it.
- `notification_reads.notification_id` is **TEXT, not a foreign key**, because it must also track read state for system-generated alerts, which have no row in `notifications` — those use a synthetic id (`sys-lowstock-<medication_id>`, `sys-expiry-<medication_id>`) recomputed on every read, not persisted. A synthetic id becoming stale (e.g. the medication is restocked and the alert disappears) just leaves an orphaned, harmless row in `notification_reads` — no cleanup needed at this scale.

## Backend

### Super Admin: sending a broadcast (`backend/routes/platform.js`)

`POST /api/platform/notifications` — gated by the existing `superAdminOnly` middleware (same cross-clinic exception as the rest of `platform.js`).

Body: `{ title: string, body: string, targetAll: boolean, clinicIds?: number[] }`.

- Validates `title`/`body` non-empty.
- If `targetAll` is false, `clinicIds` must be a non-empty array of valid clinic ids (checked against `clinics` table) — 400 otherwise.
- Inserts one `notifications` row, plus one `notification_clinics` row per id in `clinicIds` when `targetAll` is false.
- Writes an `activity_logs` row per affected clinic with action `PLATFORM_NOTIFICATION_SENT` and `user_id` set to the acting Super Admin (same divergent-clinic pattern already used by the other platform-admin-controls mutations: `activity_logs.clinic_id` is the affected clinic, `user_id` is the Super Admin, not a user of that clinic).

No edit/delete/recipient-list endpoint in this iteration — a broadcast is fire-and-forget once sent, consistent with "single-message-plus-status" simplicity already used elsewhere in this codebase (e.g. support tickets). If the Super Admin needs a sent-history view later, that's a separate follow-up, not blocking this feature.

### Clinic side: reading notifications (new `backend/routes/notifications.js`, mounted at `/api/notifications`)

`GET /api/notifications` — any authenticated user (all roles; not role-gated beyond the standard `auth` middleware).

1. Query `notifications` where `target_all = true` OR `id` is in the caller's clinic's rows from `notification_clinics`, newest first.
2. Recompute the same low-stock / near-expiry medication query already used in `backend/routes/financials.js` (~line 266-293: `stock_quantity <= min_stock_threshold`; `expiry_date` within the existing near-expiry window), scoped to `req.user.clinicId` as always. Map each matching medication to a synthetic item: `sys-lowstock-<id>` / `sys-expiry-<id>`, with a French title/body derived from the medication name and quantity/expiry date.
3. Fetch the caller's rows from `notification_reads` for all ids present in the merged list (broadcast UUIDs + synthetic ids), building a `Set` of read ids.
4. Return `{ items: [...merged, sorted by date desc, each with { id, title, body, type: 'broadcast'|'system', createdAt, read: boolean }], unreadCount }`.

`POST /api/notifications/:id/read` — upserts `(req.user.userId, id, now())` into `notification_reads` (`ON CONFLICT DO NOTHING` — read_at of the first read is fine, no need to update).

`POST /api/notifications/read-all` — body `{ ids: string[] }` (the ids currently visible to the client, since system-alert ids aren't independently queryable server-side without recomputing them again); bulk-upserts all of them for the caller.

Mounted in `backend/server.js` next to the other route modules, standard `auth` middleware only (no role gate — every role can read their own notifications).

## Frontend

### `Header.tsx` — the bell becomes functional

- On mount (and on a light poll interval, e.g. every 60s, matching the existing pattern of periodic client-side refresh elsewhere in the app — no websocket infrastructure exists in this codebase, so polling is consistent with what's already there) call `GET /notifications`, store `items` + `unreadCount` in local state.
- Badge dot only renders when `unreadCount > 0` (currently it always renders — that's part of the dead-UI bug being fixed).
- Clicking the bell toggles a dropdown panel (same positioning pattern as the existing availability-status dropdown a few lines above it in the same file: `position: relative` wrapper, `position: fixed inset:0` click-away overlay, `position: absolute` panel).
- Panel lists items (title, body, relative timestamp, a small visual distinction between `broadcast` and `system` type — e.g. an icon), unread items visually bolded/highlighted.
- Clicking an item calls `POST /notifications/:id/read` and updates local state (marks that item read, decrements `unreadCount`).
- A "Tout marquer comme lu" action at the panel top calls `POST /notifications/read-all` with the currently-loaded ids.

### Platform Admin — composing a broadcast

New section in `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx`'s sidebar, alongside the existing Cliniques/Utilisateurs/Abonnements/Support nav items (not one of the disabled "Bientôt disponible" placeholders — this is a real functional section, so it's a new nav item, not repurposing one of those).

Form: title input, body textarea, a toggle/radio between "Toutes les cliniques" and "Cliniques spécifiques" (the latter reveals a multi-select reusing the clinic list already fetched for the Cliniques section), a submit button gated by a `window.confirm()` guard (consistent with the existing plan-change and suspend/unsuspend confirms already in this file). On success, clear the form and show a toast confirmation.

## Error handling / edge cases

- `POST /api/platform/notifications` with `targetAll: false` and empty/missing `clinicIds` → `400` French error, no insert.
- A suspended or subscription-expired clinic's users still see and read notifications normally — `GET /api/notifications` is a GET, already exempt from both the `SUBSCRIPTION_EXPIRED` and suspension blocks in `middleware/auth.js` (those only ever block non-GET requests).
- A system alert that resolves between one `GET /api/notifications` call and the next simply stops appearing in `items` — no explicit "dismiss" needed, and the corresponding `notification_reads` row (if any) is harmless dead weight, not cleaned up.
- Deleting a clinic (if that ever becomes a feature) would leave dangling `notification_clinics` rows pointing at a removed `clinic_id` — out of scope for this design since clinic deletion doesn't exist anywhere in the codebase today.

## Testing

No automated test suite in this repo (per `CLAUDE.md`). Manual verification plan:
- Send a broadcast to "Toutes les cliniques" as Super Admin, confirm it appears unread in the bell for a user in an unrelated clinic.
- Send a broadcast to one specific clinic, confirm a user in a *different* clinic does NOT see it (multi-tenancy check).
- Create a low-stock medication in a test clinic, confirm the synthetic system alert appears in that clinic's bell and NOT in another clinic's.
- Mark one item read, refresh the page, confirm it stays read (persisted via `notification_reads`, not just local state).
- Restock the medication so the low-stock condition clears, confirm the system alert disappears from the bell on next load.
- Confirm a user in a suspended/expired clinic can still open the bell and read notifications (GET-only, no write-block).
