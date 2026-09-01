# Aperçu de l'interface (Nouveau Rendez-vous) — Banani → React 19 + CSS brut

## Source
- Banani screen IDs : `uh1OcdtphSFV/screens/new_screen11.jsx` (desktop) +
  `uh1OcdtphSFV/screens/NewAppointmentMobile.jsx` (mobile)
- Récupéré : 2026-08-11
- Flow : `MediClinic Gestion Clinique` (`uh1OcdtphSFV`)

## Contexte — ce que cette passe n'est pas
Ces deux écrans sont **déjà implémentés** comme vraie page applicative depuis le
2026-08-02 (`frontend/src/pages/Appointments/NewAppointmentPage.tsx`, plan
`nouveau-rendez-vous.md`, plus un addendum de correction pixel le même jour).
Cette passe-ci ne touche pas à cette page. Elle en fait une **reproduction
statique, non interactive**, insérée dans la landing page publique comme
vitrine produit.

Décision utilisateur (questions groupées, avant tout code) :
1. La sélection Banani pointant sur « Nouveau Rendez-vous » est bien voulue.
2. Forme retenue : **aperçu produit statique** — pas de démo cliquable, pas de
   formulaire public. Motif : la landing est déconnectée (ni patients, ni
   médecins, ni `POST /appointments` sans JWT) ; une maquette cliquable qui
   n'enregistre rien ferait croire à une vraie prise de rendez-vous.

## Réponses aux 8 questions système
1. **Route** : aucune nouvelle. `App.tsx` n'a pas de routeur ; la landing est
   l'état `loggedOutTab === 'landing'`. La section vit dans `LandingPage.tsx`,
   ancre `#apercu`.
2. **Public ou protégé** : public, état déconnecté.
3. **Données lues** : aucune. Zéro appel API — c'est le point de la décision 2.
   (`LandingPage.tsx` appelle déjà `GET /settings/public/plans` pour les tarifs ;
   cette section n'ajoute rien.)
4. **Données écrites** : aucune.
5. **Navigation** : la section n'est qu'un visuel. Les CTA existants de la page
   (hero, tarifs, bande finale) restent les seules sorties vers `register`.
6. **Réutilisation** : aucun composant existant ne convient — les cartes de
   `NewAppointmentPage.tsx` sont couplées à l'état du formulaire et aux données
   authentifiées. La maquette est du balisage inerte, écrit sur place.
7. **États vide / chargement / erreur** : sans objet, rien n'est chargé.
8. **Effets de bord** : aucun.

## Contraintes de stack retenues
- React 19 + TypeScript + Vite, **pas de Tailwind**. Le tableau de traduction
  Tailwind de la skill ne s'applique pas.
- `CLAUDE.md` : les pages mêlent classes partagées d'`index.css` et
  `style={{}}` en ligne pour la mise en page ponctuelle. `LandingPage.tsx` est
  intégralement écrit ainsi. La règle du projet l'emporte sur la règle
  « jamais de style en ligne » de la skill.
- Icônes : `lucide-react`, déjà en dépendance.
- Chaînes en français.

## Correspondance des jetons (Banani → projet)
Palette scopée sur `.app-preview`, préfixe `--ap-*` — même procédé que
`.terms-page` (`--tp-*`, `index.css:1237`) et `.platform-admin-shell`. La
landing est en thème clair figé, indépendante de `[data-theme]` ; la maquette
l'est aussi.

| Jeton Banani | Valeur | Variable projet |
|---|---|---|
| `--color-background` | `#F4F3F0` | `--ap-bg` |
| `--color-foreground` | `#1E2A2A` | `--ap-fg` |
| `--color-border` | `#D6D2CB` | `--ap-border` |
| `--color-input` | `#ECEAE5` | `--ap-input` |
| `--color-primary` | `#3D6B5E` | `--ap-primary` |
| `--color-primary-foreground` | `#FFFFFF` | `--ap-primary-fg` |
| `--color-secondary` | `#D4E0DC` | `--ap-secondary` |
| `--color-muted` | `#E5E2DB` | `--ap-muted` |
| `--color-muted-foreground` | `#7A8585` | `--ap-muted-fg` |
| `--color-card` | `#FFFFFF` | `--ap-card` |
| `--color-sidebar` | `#243333` | `--ap-sidebar` |
| `--color-sidebar-foreground` | `#E8EDEC` | `--ap-sidebar-fg` |
| `--color-sidebar-muted` | `#3A4D4D` | `--ap-sidebar-muted` |
| `--color-sidebar-accent` | `#4E8A79` | `--ap-sidebar-accent` |
| `--radius-md: 6px` | `6px` | `--ap-r-md` |
| `--radius-lg: 10px` | `10px` | `--ap-r-lg` |
| `--text-xs/sm/base/2xl` | `11/13/14/22px` | valeurs px directes |

**Écart assumé** : `--font-body: DM Sans` n'est pas importée. La maquette hérite
de `var(--font-primary)`. Ajouter une famille Google Fonts pour un seul bloc
décoratif alourdirait le bundle que chaque clinique télécharge, souvent en
mobile — même raisonnement que l'interdiction de librairie de graphiques dans
Platform Admin (`CLAUDE.md`, section Rapports).

## Carte de structure
Section insérée entre « Feature Showcase » (`#features`) et « Pricing »
(`#pricing`) dans `LandingPage.tsx`.

- **En-tête de section** (hors maquette, dans le thème de la landing) : chip
  œil + « Aperçu », titre `Voyez l'interface avant de vous inscrire`, sous-titre,
  et un badge explicite **« Données d'exemple »**.
- **Cadre `.app-preview`** — la maquette, `aria-hidden="true"` et
  `pointer-events: none`. Uniquement des `div`/`span`, **aucun `<button>` ni
  `<a>`** : garantit zéro arrêt de tabulation et zéro CTA mort.
  - `.ap-sidebar` (≥1024px) : logo, nav 7 entrées, Paramètres. Reprend les
    libellés réels du `Sidebar.tsx` du projet.
  - `.ap-topbar` (≥1024px) : titre + date, recherche, cloche.
  - `.ap-mobile-header` (<1024px) : flèche retour, « Nouveau RDV ».
  - `.ap-body` : 1 colonne sous 1024px, `1fr / 288px` au-dessus.
    - Colonne formulaire : carte Patient, carte Type & Médecin,
      carte Date & Heure (**mobile uniquement**, conforme au mock mobile),
      carte Notes & priorité.
    - Rail : mini-calendrier (**desktop uniquement**), créneaux, récapitulatif.
  - CTA bas de page en pile (**mobile uniquement**), paire Annuler/Confirmer en
    en-tête (**desktop uniquement**) — chaque mock est suivi à sa propre largeur.

## Plan responsive
Écrit en mobile-first : les règles de base ciblent 375px, les préfixes
`@media (min-width: …)` ajoutent le desktop.

- **Base (375px)** : structure du mock mobile. Barre latérale et barre du haut
  masquées, en-tête mobile visible, cartes empilées, médecins en 2 colonnes,
  créneaux en 4 colonnes, champ Date compact au lieu du calendrier, récap puis
  CTA empilés. Le cadre entier peut défiler horizontalement (`overflow-x: auto`)
  en dernier recours, mais la mise en page ne l'exige pas.
- **≥640px** : médecins passent à 4 colonnes, créneaux à 6.
- **≥1024px** : bascule desktop. `.ap-sidebar`/`.ap-topbar` apparaissent,
  `.ap-mobile-header` et les blocs `mobile only` disparaissent, `.ap-body`
  devient `1fr 288px`, calendrier visible, créneaux en 3 colonnes.
- **≥1280px** : le conteneur de section plafonne à 1200px, déjà le cas des
  autres sections de la page.

## Interactions / états
Aucune : bloc décoratif inerte. Pas de survol, pas de focus, pas de désactivé.
Un léger `box-shadow` + `border-radius` sur le cadre pour le lire comme une
capture encadrée, sans effet au survol (rien n'est cliquable, un effet de survol
suggérerait le contraire).

## Copy / i18n
Tout en français. Les noms propres de la maquette (patients, médecins) viennent
du mock Banani et sont **inventés** ; ils sont couverts par le badge
« Données d'exemple » affiché au-dessus du cadre, dans le flux du texte, pas
seulement en attribut. C'est la seule mesure qui empêche de les lire comme de
vrais dossiers — la règle anti-fabrication du dépôt (`CLAUDE.md`, section
Banani) porte sur les affirmations présentées comme vraies, pas sur un
échantillon d'illustration étiqueté comme tel.

## Checklist
- [x] Jetons `.app-preview` dans `index.css`
- [x] Section dans `LandingPage.tsx`
- [x] Vérif 375px — pas de défilement horizontal du corps de page
- [x] Vérif 768px
- [x] Vérif 1280px — conforme au mock desktop
- [x] Aucun élément focusable dans la maquette
- [x] `tsc -b`, `oxlint`, `npm run build` propres
- [x] Le reste de la landing inchangé (hero, marquee, stats, features, tarifs,
      bande finale, pied de page) — ordre des sections vérifié
      `features > apercu > pricing`

## Audit (2026-08-11, après implémentation)
Mesure sur 12 largeurs, pas trois : 320, 360, 375, 414, 640, 768, 1023, 1024,
1100, 1280, 1440, 1920. Trois assertions par largeur — débordement du document,
débordement interne de la maquette, et comptage des enfants sortant du cadre
(`overflow: hidden` les masquerait sans bruit).

Un défaut réel, invisible aux trois largeurs de contrôle habituelles :
**l'en-tête desktop s'écrasait entre 1024 et ~1150px**. À 1024px la colonne
formulaire ne fait que 374px et le groupe Annuler/Confirmer, en
`flexShrink: 0`, en prenait 285 — titre sur trois lignes, sous-titre sur un mot
par ligne. Corrigé par `.ap-page-head`. Deux corrections annexes : cartes
médecin à 2 colonnes entre 1024 et 1279px, et `flex: 1` explicite sur
`.ap-form-col` (elle remplissait par accident, pas par règle).

**Leçon de méthode** : 375/768/1280 saute la bande juste au-dessus du point de
bascule, qui est précisément l'endroit le plus contraint d'une mise en page à
barre latérale + rail fixes. Vérifier la largeur de bascule elle-même et la
centaine de pixels qui la suit.

## Questions ouvertes
- Faut-il ajouter « Aperçu » à la navigation d'en-tête (actuellement
  Fonctionnalités / Tarifs) ? Non fait : hors du périmètre demandé, et toucher à
  la barre de nav est le risque le plus direct de « casser » la page.
