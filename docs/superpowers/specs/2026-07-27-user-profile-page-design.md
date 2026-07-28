# Mon profil page — design

## Problem
Clicking the username/avatar in the Sidebar footer does nothing today. Non-admin/manager roles (secretary, doctor, pharmacist, lab_tech, nurse) have zero self-service way to change their own password, since `Paramètres` (where the only password-change UI lives, in its "Sécurité" tab) is gated to `admin`/`manager` only in `Sidebar.tsx`'s `menuItems`.

## Scope
- New page: profile info (read-only) + password-change form. Reachable by clicking the name/avatar in the Sidebar footer — no role gate, every authenticated user gets this entry point.
- Reuses existing data only: `GET /auth/me` (via `useAuth()`) already returns `user.{name,email,role}` and the full `clinic` row — no new backend endpoint for viewing.
- Reuses existing `PUT /auth/password` (via the extracted `PasswordChangeForm`) — no backend change.
- Out of scope (explicitly deferred, no user ask): editing name/email, avatar upload, "member since" date. None of these have backend support today and building them wasn't requested.
- `Paramètres > Sécurité` tab stays as-is, untouched — still admin/manager-only, still works exactly as before. This page is additive, not a replacement.

## Components
- **NEW** `frontend/src/components/PasswordChangeForm.tsx` — extracted from `SettingsPage.tsx`'s inline "Sécurité" tab JSX + its `handlePasswordSubmit`/`currentPasswordInput`/`newPasswordInput`/`confirmPasswordInput`/`isSavingPassword` state. Self-contained: owns its own state, calls `PUT /auth/password` directly, shows its own toast via `useNotifications()`. No props needed. Used by both `SettingsPage.tsx` (unchanged behavior) and the new `ProfilePage.tsx`.
- **NEW** `frontend/src/pages/Profile/ProfilePage.tsx` — renders an info card (avatar-initial circle, full name, role label, email, clinic name + address — same visual language as the Sidebar footer / other card-based pages) followed by `<PasswordChangeForm />`.
- **MODIFIED** `frontend/src/components/Sidebar.tsx` — the footer's name/avatar `<div>` (currently non-interactive) becomes a `role="button"` with `onClick={() => { setCurrentTab('profile'); onClose(); }}`, keyboard-accessible (Enter/Space), `cursor: pointer`, matching the existing pattern already used for the logo-click-to-close-sidebar above it. The separate logout icon button is untouched (still opens the existing confirm modal).
- **MODIFIED** `frontend/src/App.tsx` — add `'profile'` to wherever `currentTab` is typed/switched, render `<ProfilePage />` in the main content area (inside the normal `Sidebar`/`Header` shell, same as every other clinic-facing tab — unlike Platform Admin, this is not a separate console).

## Data flow
- Page mount: no fetch. Reads `user`/`clinic` already in `AuthContext` (hydrated at app load via `GET /auth/me`).
- Password submit: `PasswordChangeForm` calls `PUT /auth/password` with `{ currentPassword?, newPassword }`, same contract already used by `SettingsPage.tsx` — success/error toast, clears fields on success.

## Error/empty/loading states
- No loading state needed (data already in context by the time the page can be reached — a user must already be authenticated to see the Sidebar at all).
- Password form errors: existing toast pattern (`showToast('error', ...)`), same as today.

## Testing
- `tsc -b` + `npm run lint` clean.
- Manual: log in as a non-admin role (e.g. `aminata@mediclinic.com`, doctor), confirm the profile entry point is reachable and password change works — this is the concrete gap being closed (today that role can't reach any password-change UI at all).
- Confirm `Paramètres > Sécurité` still works unchanged for admin/manager.
