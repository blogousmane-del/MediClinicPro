# Abonnement — Choisir un plan — Banani → MediClinic

## Source
- Banani screen ID: `uh1OcdtphSFV/screens/new_screen10.jsx` ("Abonnement — Choisir un plan")
- Fetched: 2026-07-26

## Context
This screen was already partially built in an earlier pass this session (screenshot-driven, not MCP-fetched): the 3-tier plan system exists end-to-end (`backend/utils/plans.js`, `GET/PUT /settings/plan`, `POST /financials/subscription/checkout` priced by tier, Mobile Money gated by tier, plan switch on webhook confirmation) and a first-pass 3-card picker already lives in `SettingsPage.tsx`'s "Abonnez-vous" tab. This pass is a **pixel-parity diff against the real Banani source**, not a rebuild of the underlying feature.

## Structure map (Banani)
- Centered header: small "star" icon + uppercase "Nos formules" eyebrow, H1 "Choisissez votre plan", subtitle.
- 3-card grid (`grid-cols-3`, `max-w-4xl`): each card = badge row (badge chip + zap icon if highlighted) → plan name + big price + "FCFA"/period → divider → 6 fixed comparison rows (check/x icon + label, x-rows shown struck-through and muted, not omitted) → CTA button + one-line note.
- Premium (highest tier) card is visually highlighted regardless of what's actually subscribed: primary border, light-green bg, zap icon.
- Below the grid: a divider bar with a centered "all plans include..." pill.
- Below that: a contact/FAQ card with WhatsApp + email CTAs.

## Decisions (no need to re-ask — consistent with prior confirmed decisions + established project precedent)
1. **Tier names kept as Starter/Clinique/Hôpital**, not Banani's "Essai gratuit/Standard/Premium" — the user explicitly named these tiers earlier this session (AskUserQuestion answer). Banani's copy is a naming suggestion from the mock, not a new instruction overriding a confirmed decision.
2. **Comparison rows made real, not copy-pasted from Banani's fictional list**: derived client-side from actual plan data (`staffLimit`, `allowedRoles`, `paymentMethods`) instead of hardcoding Banani's exact 6 strings, so the struck-through "Mobile Money" row for Starter/Clinique and the checked one for Hôpital can never drift from what the backend actually enforces.
3. **Dropped the WhatsApp/email contact card entirely.** Same fabrication problem already found and fixed earlier this session (2026-07-24 audit, `STATUS.md`): a fake WhatsApp number (`wa.me/2250700000000`) was previously removed from `AuthPage.tsx` for being a dead placeholder. Grepped the codebase — there is still no real support email/WhatsApp channel anywhere. Adding one here would repeat the exact same mistake.
4. **Softened the "all plans include" pill** to drop "support email" (no support channel exists) — kept only verifiable claims: web/mobile access (true, responsive design) and included updates (true, SaaS model), added "changement de plan à tout moment" (true — the picker itself proves this).
5. Premium/Hôpital card keeps Banani's permanent visual highlight (border + tint + zap icon) regardless of current plan — layered with the existing real "Plan actuel" corner tag so both the marketing highlight and the functional state are visible without conflict.
6. CTA notes rewritten to avoid an unbacked "support prioritaire" claim on the top tier (no priority-support infra exists) — replaced with a true framing about unlimited staff instead.

## Token mapping
| Banani token | MediClinic value |
|---|---|
| `--color-primary: #3D6B5E` | `#1e4d40` (existing brand green used everywhere else in this app — not swapped for Banani's slightly different shade) |
| `--color-secondary: #D4E0DC` (highlighted card bg) | `#e6f4ea` (existing light-green tint already used for "current plan" cards) |
| `--color-input: #ECEAE5` (neutral badge/button bg) | `var(--bg-secondary)` |
| `--color-muted: #E5E2DB` (excluded-feature icon bg) | `var(--bg-secondary)` / `var(--text-muted)` |
| `radius-xl: 16px` | `16px` (already used) |
| `radius-md: 6px` | `10px` (matches existing button radius convention in this file) |
| Lucide icons: star, zap, check, x, info | `lucide-react`: `Star`, `Zap`, `Check`, `X`, `Info` |

## Implementation
- `frontend/src/pages/Settings/SettingsPage.tsx`, "Abonnez-vous" tab (`activeSubTab === 'billing'`):
  - Added centered header (star + eyebrow + H1 + subtitle).
  - Rebuilt each plan card: badge chip (Gratuit/Populaire/Tout inclus) + zap icon on the Hôpital card, price block matching Banani's stacked "FCFA"/period layout, divider, 6 fixed comparison rows (check/x, struck-through when excluded) derived from real plan data, CTA + note line.
  - Hôpital card keeps the permanent highlight treatment; "Plan actuel" tag still layers on top of whichever card is actually active.
  - Added the softened "tous les plans incluent" divider bar.
  - Did NOT add the WhatsApp/email contact card (see decision 3).
- No backend changes needed — this pass is purely visual/structural, the underlying plan/checkout/enforcement logic already shipped in the previous pass.

## Verification
- `npm run build` / `npm run lint` — clean, no new warnings.
- Not visually verified in a live browser at 375/768/1280px — no browser-driving tool available this session. Recommend a manual check before treating as fully pixel-verified, especially the 3-column grid's collapse to 1 column below 850px (existing `.plan-cards-grid` media query, unchanged).

---

## 2026-07-27 re-application — Landing Page "Tarifs" section

Same Banani screen (`new_screen10.jsx`), re-selected by the user and re-fetched, this time to replace the **public, logged-out** Landing Page's stale single-card pricing section (`frontend/src/pages/LandingPage.tsx`, `<section id="pricing">`) — still showing a "15 000 FCFA/mois, tout inclus" card left over from before the 3-tier model shipped.

### Key difference from the Settings implementation
No `req.user.clinicId`, no "current plan" state, no `GET /settings/plans` call (auth-gated, unreachable from a public page). This is pure marketing content funneling into registration.

### Reused decisions (not re-litigated — same screen, same prior confirmations)
1. Tier names Starter/Clinique/Hôpital (not Banani's Essai gratuit/Standard/Premium).
2. Feature rows/prices hardcoded to match `backend/utils/plans.js`'s real `PLANS` values (same reasoning: this page can't hit an authenticated endpoint, and the existing single-card version already hardcodes its own numbers today).
3. Dropped the "support email" claim from the "tous les plans incluent" bar.
4. Dropped the WhatsApp/email FAQ contact card entirely (fabricated `wa.me/...` pattern already removed twice this session).
5. Hôpital card keeps its permanent visual highlight (no "Plan actuel" tag here — nothing is actually subscribed on a public page).
6. CTA note on Hôpital avoids the unbacked "support prioritaire" claim, same as the Settings version.

### New for this location
- All 3 CTA buttons route to `onNavigate('register')` — there's no unauthenticated checkout path in this app; every tier (including paid ones) is chosen *after* registering. Matches what the current single-card CTA already does.
- New shared class `.pricing-cards-grid` added to `index.css` (1 col → 3 cols at 850px+) rather than reusing `SettingsPage.tsx`'s local `.plan-cards-grid` (which lives in that page's own embedded `<style>` block, not a shared file) — avoids touching an already-shipped, unrelated page for this task.
- Updated the section header copy to match Banani's actual text for pixel parity: eyebrow "Nos formules" (was "TARIFS TRANSPARENTS"), title "Choisissez votre plan" (was "Un seul abonnement, tous les modules inclus"), subtitle "Commencez gratuitement, évoluez selon vos besoins. Sans engagement."
- Kept the existing real "Accepté en Côte d'Ivoire via Mobile Money" payment-badge row (Wave/Orange Money/MTN MoMo) below the grid — real, already-shipped, not part of Banani's fetch but not being removed.

### Verification
- `npm run build` / `npm run lint` — clean, no new warnings.
- Not visually verified in a live browser — no browser-driving tool available this session.
