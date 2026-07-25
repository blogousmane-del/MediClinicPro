# Landing Page — Banani → MediClinicPro (React + vanilla CSS)

## Source
- Banani screen IDs: `uh1OcdtphSFV/screens/new_screen4.jsx` (desktop, screenName "MediClinic — Landing Page"), `uh1OcdtphSFV/screens/LandingPageMobile.jsx` (mobile)
- Fetched: 2026-07-21

## System context (Step 0 answers)
1. Route: no router in this app — `App.tsx` renders `LandingPage` directly when `!user` and `loggedOutTab === 'landing'`.
2. Public, unauthenticated only. No auth gate.
3. Reads no API data — fully static marketing content.
4. Writes nothing. Only calls `onNavigate('login' | 'register')` prop (existing signature in `LandingPage.tsx`).
5. Nav flow: "Connexion" → `onNavigate('login')` → `AuthPage` login tab. Primary CTAs → `onNavigate('register')` → `AuthPage` register tab (there is no separate "book a demo" backend flow — assumption, flagged below).
6. Reuse: `.btn` / `.btn-primary` / `.btn-secondary` / `.card` classes from `index.css`; `lucide-react` icons (already a dependency, used elsewhere in the app).
7. No loading/empty/error states — static page.
8. No side effects besides the two navigation callbacks.

## Structure map
- Nav bar: logo + in-page anchor links (Fonctionnalités / Témoignages / Tarifs) + Connexion + primary CTA
- Hero: eyebrow badge, H1, paragraph, 2 CTAs, social-proof line, hero visual with floating stat card
- Stats strip: 4-column stat band on dark background
- Feature split: visual + 6 feature chips (2-col grid) + CTA
- Testimonials: 3-card grid, star rating + quote + attribution
- Final CTA band on dark background
- Footer: logo + links + copyright

## Component breakdown
- **NEW** `LandingPage/FeatureChip` — icon + label, used in the feature grid (appears 6x — extract)
- **NEW** `LandingPage/StatBlock` — value + label, used in stats strip (4x) and could share shape with the floating hero stat card
- **NEW** `LandingPage/TestimonialCard` — stars + quote + initials avatar + name/role (3x)
- **REUSE** `.btn`, `.btn-primary`, `.btn-secondary` from `index.css` for all buttons
- Kept local to `pages/LandingPage.tsx` (or a `pages/Landing/` folder) — nothing here is needed by the authenticated app, so no promotion to `components/`

## Token mapping (Banani → project `index.css` variables)
| Banani token | Project value |
|---|---|
| `--color-primary` (#3D6B5E) | `var(--primary)` (teal, already the accent used across the app) |
| `--color-background` (#F4F3F0) | keep existing landing page's dark navy (`#0b0f19`) — see open question C |
| `--color-foreground` (#1E2A2A) | `var(--text-primary)` / white on dark sections |
| `--color-muted-foreground` | `var(--text-secondary)` / `#94a3b8` (current dark-mode muted tone) |
| `radius-md` 6px / `radius-lg` 10px / `radius-xl` 16px | `var(--radius-sm)` 8px / `var(--radius-md)` 14px / `var(--radius-lg)` 20px |
| font `DM Sans` | `var(--font-primary)` (Outfit, body) / `var(--font-secondary)` (Plus Jakarta Sans, headings) — already loaded in `index.css` |
| `@global/Icon i="..."` | `lucide-react` equivalent (calendar-check→Calendar, file-text→FileText, flask-conical→FlaskConical, pill→Pill, receipt→Receipt, bar-chart-2→BarChart2, arrow-right→ArrowRight, star→Star, activity→Activity) |
| `@global/UserAvatar` | initials-in-circle `<div>` (no photo asset pipeline in this project — see open question B) |
| `@global/Image` (AI photo prompts) | see open question B |

## Styling approach (assumption — flagged for veto)
This codebase does **not** use Tailwind or CSS Modules — every existing page/component (`LandingPage.tsx`, `Header.tsx`, `App.tsx`) styles via **inline `style={{}}` objects** plus a handful of shared utility classes defined once in `index.css` (`.btn`, `.card`, `.badge`, etc.). I'm following that existing convention for consistency rather than introducing a new CSS-class-per-component pattern, since the latter would be the only page in the app styled differently.

## Responsive plan
- **Base (375px)**: single column throughout — nav collapses to logo + Connexion + CTA (no anchor links visible, or a simple hamburger — TBD), hero stacks text above image, stats become a 2×2 grid (matches Banani's mobile spec), feature grid stays 2-col (chips are small), testimonials stack vertically, CTAs are full-width buttons.
- **sm/md (640–1024px)**: nav anchor links reappear; hero still stacks (image below text) until desktop width, since Banani's own breakpoint jump is mobile→desktop only (no tablet-specific spec provided) — I'll introduce a sensible tablet step (2-col stats, image beside text starting ~768px).
- **lg (1024px+)**: matches Banani desktop spec — hero side-by-side, stats 4-col single row, feature split side-by-side, testimonials 3-col grid.
- **xl (1280px+)**: max content width ~1200px centered (matches current landing page's existing `maxWidth: 1200px` convention).

## Interactions / state
- Buttons: existing `.btn` hover states (translateY + shadow) already defined in `index.css` — reused as-is.
- Nav anchor links: smooth-scroll to in-page section ids (assumption — see below).
- No forms, no focus-trap concerns beyond standard link/button focus rings (inherited from browser defaults + `.input-control` not applicable here).

## Copy / i18n
- All strings authored directly in French in JSX (matches current file's approach — no `constants.ts` exists in this project for landing copy; `LandingPage.tsx` currently inlines French strings directly).

## Implementation checklist
- [ ] Extract `FeatureChip`, `StatBlock`, `TestimonialCard` as local components in `pages/LandingPage.tsx`
- [ ] Rebuild page mobile-first (base styles = 375px, wider layout applied via a resize/media approach consistent with how `index.css` already does breakpoints — plain CSS media queries in `index.css`, not inline JS width checks)
- [ ] Wire nav/CTA buttons to existing `onNavigate` prop — no new API calls
- [ ] 375px check
- [ ] 768px check
- [ ] 1280px check — compare to Banani desktop screen
- [ ] Touch targets ≥ 48px on mobile
- [ ] Keyboard nav / focus rings OK
- [ ] `npm run lint` (oxlint) + `npm run build` in `frontend/`

## Open questions for user — RESOLVED 2026-07-21
- **A. Fabricated stats & testimonials** → **Drop both sections.** No stats strip, no testimonials grid. Revisit once real numbers/customers exist.
- **B. Photography** → **Rebuild without photography.** Hero visual is an icon-based "module preview" panel (Users/Calendar/Pill/Activity rows, no numbers), consistent with dropping unverifiable claims.
- **C. Visual theme** → **Fixed dark** (current behavior, `#0b0f19` navy always, ignores `[data-theme]`).
- Nav anchor links (`#features`, `#pricing`) and CTA copy mapped to in-page scroll + existing `onNavigate('register'|'login')` — assumption, not re-asked, low risk.
- Feature list copy: Banani's "Rapports BI" softened to "Statistiques & recettes" — the app has dashboard/accounting stats, not full BI reporting; avoids overclaiming.
- Pricing section: kept from the existing file as-is (real, accurate 15 000 FCFA/mois plan) — Banani's fetch didn't include a pricing screen to replace it.

## 2026-07-25 — Re-fetch, second rebuild (user flagged current page as "very different" from Banani)
Between 2026-07-21 and today the live page drifted from this plan (light theme instead of fixed-dark, real photography added back via `/doctor_hero.png` + `/lab_showcase.png` instead of the icon-panel hero, dark stat banner kept with real icon+text facts instead of being dropped, module marquee added) — consistent with the "external rewrite" drift pattern already logged multiple times in `STATUS.md`. Re-fetched both Banani screens (same IDs) and re-planned against the page as it actually ships today, not this file's original 07-21 version.

**Decisions this round (batched question, user answered):**
- **Stats bar**: keep, but real facts only — same 4 items already live (Données isolées par clinique / Tous les modules inclus / Paiement Mobile Money / Support en français), restyled to Banani's `divide-x`/`divide-y` grid look instead of individual cards.
- **Testimonials**: omit entirely (Banani's 3 testimonials cite fictional named doctors — "Dr. Aïssatou Koné" etc. — with fabricated quotes). Nav link for "Témoignages" not added.
- **Scope**: full structural rebuild of `LandingPage.tsx` on Banani's section order, mapped onto the project's existing tokens/images (not Tailwind, not AI photography).

**Additional fabricated content found in this fetch, handled by extension of the same principle (not re-asked — flagged here for veto):**
- Hero's floating badge in Banani reads "Précision 82%" (fake AI-triage accuracy stat) — replaced with the existing real subscription-fact badge ("Un seul abonnement — 15 000 FCFA/mois"), already live and kept.
- Hero's avatar trust-row "Approuvé par des hôpitaux, cliniques & équipes de santé" implies an unverified existing customer base — dropped, replaced with the existing real "Essai gratuit de 14 jours, sans engagement, sans carte bancaire" trust line (already live and kept).
- Final CTA band's Banani copy "Rejoignez les cliniques d'Abidjan qui ont choisi MediClinic" (implies existing adopters) — reworded to a forward-looking, non-claiming version.

**Structural changes made:**
- Nav: removed dead `#about` link (no "À propos" section ever existed on the page — pre-existing dead link, unrelated to Banani, fixed as part of this pass).
- Added the final CTA band section (missing from the live page, present in Banani) between Pricing and Footer, dark `#162a26` band matching the stats bar color for visual rhythm.
- Feature pills: added the small colored icon-box wrapper around each icon (Banani has `w-7 h-7 rounded-md bg-secondary`; live page had bare icons) for closer visual match, same treatment the marquee cards already use.
- Stats bar: added responsive divider borders (`divide-x` desktop single row, `divide-x`+`divide-y` 2×2 tablet, stacked top-dividers on narrow mobile) instead of plain ungrouped items.
- Footer: reordered to logo → links → copyright (Banani's order); kept only real links (Fonctionnalités, Tarifs, Conditions d'utilisation) — did not add Banani's "Contact"/"Confidentialité" since neither destination exists in the app.
- Hero primary CTA label changed from "Découvrir nos offres" to "Commencer l'essai gratuit" (matches the real 14-day-trial concept already used in the pricing section, more action-accurate than Banani's "Réserver une démo" which implies a sales-demo flow that doesn't exist).
- Icon swap: "Toutes les fonctionnalités" button now uses `ArrowRight` (was `Plus`) to match Banani's icon choice.
- Kept, not in Banani's fetch but real/valuable: module marquee ticker, pricing section with real 15 000 FCFA plan + payment provider badges.
