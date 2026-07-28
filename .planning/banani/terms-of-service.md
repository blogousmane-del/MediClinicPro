# Conditions d'utilisation — Banani → MediClinic

## Source
- Banani screen IDs: `uh1OcdtphSFV/screens/TermsOfServiceMobile.jsx`, `uh1OcdtphSFV/screens/TermsOfServiceDesktop.jsx`
- Fetched: 2026-07-27

## Context
`frontend/src/pages/TermsOfServicePage.tsx` already existed (built earlier this project from a screenshot, not an MCP fetch) with real placeholder-bracket legal content and a fixed-dark shell reusing `.landing-page`. This pass re-fetches the actual Banani mockups (mobile + desktop) and reworks the page to match them structurally and visually, confirmed via user Q&A before coding.

## User decisions (confirmed via AskUserQuestion before coding)
1. **Theme**: switch from the shared fixed-dark `.landing-page` shell to Banani's actual light palette (`--color-background:#F4F3F0`, `--color-foreground:#1E2A2A`, `--color-border:#D6D2CB`, `--color-input:#ECEAE5`, `--color-secondary:#D4E0DC`, `--color-primary:#3D6B5E`, `--color-muted-foreground:#7A8585`) for this page only — a deliberate one-page exception to the Landing/Auth dark-shell consistency established earlier, per explicit user choice this pass.
2. **Legal content**: keep the placeholder-bracket approach (`[Nom de l'entité légale]`, `[date de dernière mise à jour]`, etc.) and the "document provisoire" draft banner — none of Banani's specific fabricated details (MediClinic SARL, 99% SLA, 5-day grace period, "Version 2.1", 1 July 2025 date) are real/confirmed. **Exception**: contact email/phone are now real, supplied by the user — `blog.ousmane@gmail.com` / `+225 07 88 81 81 18` — replacing the old `[email de support]`/`[téléphone de support]` placeholders.
3. **Dropped the false data-residency claim** — Banani's mock doesn't actually include this (it was in the old placeholder-content pass, already fixed here since option 1 doesn't reintroduce it) — the section 3 content already says "[Préciser ici le lieu d'hébergement des données...]" and stays that way, not "hébergées en Côte d'Ivoire" (already proven false once for `AuthPage.tsx` — Supabase, not CI-hosted).
4. **Dropped "Accepter et continuer" / "Refuser" CTA buttons** — no ToS-acceptance tracking exists anywhere in the backend (registration doesn't record consent to a specific version); adding these would be dead/fake affordances, same category of mistake already fixed elsewhere (fake OTP button, fake WhatsApp link).
5. **Footer**: Banani shows "Confidentialité" / "CGU" / "Contact" links — only this CGU page is real (no Privacy or Contact page exists in the app). Kept just the logo + copyright, dropped the two dead links, consistent with precedent of not adding nav to pages that don't exist.

## Implementation
- New light-theme CSS block in `index.css` (`.terms-page` scope, mirrors the `.platform-admin-shell` token-override pattern used for Platform Admin) replacing the old `.terms-header`/`.terms-layout`/`.terms-toc`/`.terms-content`/`.terms-section` rules (previously dark, coupled to `.landing-page`).
- `TermsOfServicePage.tsx`: new dedicated light nav (not `.landing-nav`), dark `bg-foreground` header band (mobile: compact "Accueil" button; desktop: "Retour au site" + "Démarrer gratuitement"), intro info box (`bg-secondary`/primary border), TOC sidebar (desktop ≥768px, sticky, matches current breakpoint already used), sections, real-contact box, light footer (logo + copyright only).
- Mobile-first: unprefixed styles = mobile layout (compact nav, no TOC, stacked sections), `min-width: 768px` layers in the TOC sidebar + wider nav/header padding — same breakpoint the page already used, now just re-themed.

## Verification
- `tsc -b` / `npm run lint` clean.
- Visual check at 375/768/1280px via Playwright (dev server already running this session).
