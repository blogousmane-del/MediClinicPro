# Pharmacie — Ajouter un médicament — Banani → MediClinic (diff pass)

## Source
- Banani screen ID: `uh1OcdtphSFV/screens/AddMedicine.jsx`
- Fetched: 2026-07-25

## Context
This screen was already marked Done in `STATUS.md` ("Add Medicine modal already existed, not new" — light polish only, no rebuild). Re-fetched at the user's request; this pass is a targeted diff against the live modal in `PharmacyPage.tsx`, not a rebuild. Banani's mock is a full standalone page (duplicate Sidebar/TopBar) — per established precedent, the real Sidebar/Header are already more functional (role-gated, live data) than Banani's static chrome, so this stays a modal, not a new page.

## Diff findings
- **Real bug found via the diff, not just a styling gap**: the live modal hardcoded `dosage: '500mg'` on every submit regardless of the medication chosen (`handleReplenishSubmit`). Confirmed against live Supabase data that `name`/`dosage` are meant to be separate (seed rows: `name: "Paracétamol"`, `dosage: "500mg"`), but the modal's combined catalog dropdown (`"Amoxicilline 500mg"`) plus the hardcoded dosage corrupts new/edited records — matches Banani's separate "Dosage" field, which is what exposed the gap.
- Banani's "Stock minimum d'alerte" is editable; the live modal/backend hardcoded it to `10` on insert and never exposed or updated it, despite the column already existing and already driving the Faible/Critique badges elsewhere.
- Banani shows a live "Marge" (%) readout — frontend-only, no backend needed.
- Banani has "Fabricant" and "Unité" fields with no matching DB columns.
- Banani's footer has an extra "Sauvegarder" button beside "Ajouter au stock" with no distinct real action — skipped (would be a fake affordance; only one real submit action exists).

User decisions (confirmed via AskUserQuestion before coding):
1. Fix the dosage bug — yes.
2. Make Stock minimum d'alerte editable — yes.
3. Add Fabricant/Unité as real new columns (migration) — yes.
4. (Not asked, followed existing precedent) Skip the extra "Sauvegarder" button.

## Changes made
- `backend/supabase_schema.sql`: added `manufacturer TEXT` and `unit TEXT` to `medications`. **Requires a manual migration** (same constraint as every prior Banani-driven schema change this project — no DDL access from a session, only the service-role REST client):
  ```sql
  ALTER TABLE medications ADD COLUMN IF NOT EXISTS manufacturer TEXT;
  ALTER TABLE medications ADD COLUMN IF NOT EXISTS unit TEXT;
  ```
- `backend/routes/pharmacy.js` `POST /replenish`: accepts `manufacturer`, `unit`, `minStockThreshold`; both insert and update paths now persist them (previously `min_stock_threshold` was hardcoded to `10` and never updatable).
- `frontend/src/pages/Pharmacy/PharmacyPage.tsx`:
  - Added `parseNameAndDosage()` — splits a catalog string like `"Amoxicilline 500mg"` into name + trailing dosage token; used to auto-fill (and let the user correct) a new, real "Dosage" input instead of the hardcoded value.
  - Added `manufacturer`, `unit`, `minStockThreshold`, `dosage` form state, wired end-to-end (submit payload + edit-prefill in `handleOpenAddModal`).
  - Added a computed, read-only "Marge" display (same formula as Banani: `(vente - achat) / vente × 100`).
  - Reorganized the modal into Banani's labeled sections (`Informations générales`, `Dosage et forme`, `Stock initial`, `Tarification`, `Seuils d'alerte`, `Autres informations`) via a small new `FormSectionHeader` component — kept inline-style convention already used throughout this file (project uses plain CSS + inline styles, not Tailwind, per CLAUDE.md).
  - Kept `Numéro de lot/Réf.` and `Fournisseur` (not in Banani's mock but already real/wired) under "Autres informations".

## Verification
- `npm run build` (tsc -b + vite build): clean.
- `npm run lint` (oxlint): clean, no new warnings introduced.
- **Not verified visually in a browser** — no browser-driving tool available in this session. User should open the modal at 375px/768px/1280px before treating this as fully Done.

## Open follow-up
- Live Supabase DB does not yet have `manufacturer`/`unit` columns — `POST /replenish` will 500 until the `ALTER TABLE` above is run (same pattern as `work_schedule`, `appointments.room/notes`, `deposits` table).
