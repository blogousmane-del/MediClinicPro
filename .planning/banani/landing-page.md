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
