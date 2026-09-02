# Audit UI/UX anti-slop + plan d'implémentation

Date : 2026-09-01
Périmètre audité : `LandingPage.tsx`, `AuthPage.tsx`, `TermsOfServicePage.tsx`, `Dashboard.tsx`,
`Sidebar.tsx` / `Header.tsx`, `index.css` (2 630 lignes), pages métier (passe légère).
Méthode : skill `design-taste-frontend` (mode « redesign — préserver »).

**Lecture de design.** Landing B2B pour un gérant de clinique en Côte d'Ivoire (pas un patient),
plus une application métier utilisée 8 h/jour par des secrétaires et des soignants. La priorité
est la confiance et la lisibilité, pas l'effet. Cadrans retenus :
`DESIGN_VARIANCE 5 / MOTION_INTENSITY 4 / VISUAL_DENSITY 4`.

**Verdict.** Le produit n'est pas « moche » : il est **incohérent**. Six palettes, trois polices,
quatre systèmes de rayons et 149 couleurs codées en dur rien que sur la landing. C'est la
signature exacte d'une interface générée écran par écran : chaque page est plausible seule,
l'ensemble ne tient pas. À cela s'ajoutent des textes qui promettent des fonctions inexistantes
et deux compteurs du tableau de bord qui affichent autre chose que leur libellé.

---

## A. Contenu qui ment (à corriger en premier, avant toute esthétique)

| # | Fichier | Constat | Correction |
|---|---|---|---|
| A1 | `Dashboard.tsx:372` + `:388` | Carte « PATIENTS AUJOURD'HUI » affiche `stats.patientsTotal`, soit le total historique, pas le jour. Le sous-titre le contredit déjà : « Dossiers actifs configurés ». | Renommer en « PATIENTS AU TOTAL », ou exposer un vrai compteur du jour côté `/financials/stats`. |
| A2 | `Dashboard.tsx:414` + `:430` | Carte « RDV CONFIRMÉS » affiche `todayAppts.length` : tous les RDV du jour, **annulés compris**. | Compter `status !== 'cancelled'`, ou renommer « RDV DU JOUR ». |
| A3 | `Dashboard.tsx:90` + `:588` | Le mapping ne produit que `completed` / `cancelled` / `waiting`. La branche `in_progress` (badge « En consultation ») est donc **morte**, et un RDV **annulé tombe dans le `else` et s'affiche « En attente »**. | Ajouter une branche `cancelled` (badge barré/gris) et brancher `in_progress` sur le vrai statut. |
| A4 | `Dashboard.tsx:555` | La légende annonce « En cours » — état jamais rendu (cf. A3). | Aligner légende et états réellement possibles. |
| A5 | `LandingPage.tsx:747` | Bouton « Toutes les fonctionnalités » → `onNavigate('register')`. Le libellé promet une page, le clic ouvre un formulaire. | Soit ancrer vers `#features`, soit renommer « Créer mon compte ». |
| A6 | `LandingPage.tsx:312` et `:385` | CTA principal du header : « Prendre un rendez-vous ». Le visiteur est le **gérant** de la clinique, pas un patient. C'est le CTA d'un cabinet médical, pas d'un SaaS. | « Essai gratuit 7 jours ». |
| A7 | `LandingPage.tsx:52` | Pastille « Rapports BI » : aucun module de reporting clinique n'existe (`Sidebar.tsx:42-50` : Comptabilité est le seul écran chiffré ; les rapports sont réservés à la console opérateur). | Remplacer par « Comptabilité & recettes ». |
| A8 | `LandingPage.tsx:448` | « insights de santé avancés » : capacité inexistante + anglicisme. | Décrire ce que fait réellement le produit. |
| A9 | `LandingPage.tsx:707` | « Réduisez les attentes […] réduisez les erreurs » : promesse clinique non mesurée, verbe répété deux fois dans la même phrase. | Formuler en fonctions, pas en résultats médicaux. |
| A10 | `LandingPage.tsx:1318` | « accès web & mobile » : il n'existe pas d'application mobile, seulement du responsive. | « utilisable sur mobile et ordinateur ». |
| A11 | `LandingPage.tsx:1330-1345` | Quatre pastilles opérateurs (Orange Money, MTN, Wave, carte) : promesse de paiement invérifiable dans le code — elle dépend des moyens réellement activés sur la boutique Chariow de l'exploitant. | Confirmer côté Chariow, sinon retirer les logos non actifs. Même remarque pour le bandeau `:643`. |
| A12 | `TermsOfServicePage.tsx:173` | Contact légal des CGU = `blog.ousmane@gmail.com`, une adresse Gmail personnelle, sous « Notre équipe est disponible ». Sur un logiciel de santé vendu à des cliniques, c'est le point qui tue la confiance. | Adresse au domaine (`contact@…`), ou le formulaire Support existant. |
| A13 | `Dashboard.tsx:155` | Emoji 👋 dans le `<h1>`. | Retirer. |
| A14 | `LandingPage.tsx:643-652` | Bandeau de 4 colonnes « Tous les modules inclus » / « Support en français » : du remplissage à valeur nulle pour un acheteur. | Remplacer par 3 faits vérifiables (isolation des données par clinique, essai 7 jours sans carte, prix en FCFA sans conversion). |

## B. Le plus gros signal « généré par IA » : six palettes concurrentes

Aucune de ces familles n'est fausse ; c'est leur coexistence qui trahit la génération écran par écran.

| Zone | Couleurs | Fichier |
|---|---|---|
| Tokens applicatifs | teal `#0d9488` (`hsl(171 77% 40%)`), fond menthe `#f2f8f6` | `index.css:5-24` |
| Landing | vert profond `#1e4d40`, bandeau `#162a26`, menthe `#e6f4ea`, accent `#0d9488`, neutres slate | `LandingPage.tsx` (149 hex en dur) |
| Authentification | dégradé `#132a24 → #1a3c33`, accent émeraude `#34d399`, neutres verdâtres `#a3c2b8` / `#688077` / `#d8e2dc` | `AuthPage.tsx:185-603` (50 hex) |
| Barre latérale | `#162a26`, actif `#1c4436`, carte `#1f3a33`, texte `#9bb0a9`, point `#10b981` | `Sidebar.tsx:96-337` |
| Aperçu produit (import Banani) | `#3D6B5E` / `#4E8A79` sur papier chaud `#F4F3F0`, sidebar `#243333` | `index.css:1649-1665` |
| Console plateforme | palette propre + police `DM Sans` | `PlatformAdminPage.tsx`, `index.css:2325` |

Conséquences concrètes :

- **B1.** La section « Voyez l'interface avant de vous inscrire » (`LandingPage.tsx:754`) montre une
  maquette dont la palette (vert-gris sur papier chaud) **n'existe nulle part dans l'application
  réelle** (teal sur menthe froide). L'aperçu ne montre pas le produit vendu.
- **B2.** Quatre pastilles de paiement de quatre familles différentes, dont un violet `#7c3aed` sur
  `#f5f3ff` — le violet-IA typique, seul violet de tout le produit (`LandingPage.tsx:1341`).
- **B3.** Pastilles claires codées en dur (`#e6f4ea`, `#f1f5f9`, `#fef2f2`, `#fff7ed`, `#ffedd5`)
  dans `Dashboard.tsx` : elles **survivent au thème sombre** et posent des taches claires sur les
  cartes sombres (`:379`, `:428`, `:501`, `:823`, `:847`).
- **B4.** Fond applicatif teinté menthe `#f2f8f6` face à un fond landing slate `#f8fafc` : deux
  neutres de températures opposées à un clic d'intervalle.

## C. Contraste et accessibilité (échecs mesurés)

- **C1.** `--text-muted: #8a99ad` sur blanc = **2,9:1**. Échec WCAG AA (4,5:1 requis). Ce token porte
  les libellés de cartes, les sous-titres, les métadonnées : c'est le texte le plus répandu de l'app.
  Cible : ≈ `#6b7a90`.
- **C2.** En sombre, `--text-muted: #64748b` sur `--bg-secondary: #0b111e` = **3,95:1**. Échec aussi.
  Cible : ≈ `#94a3b8`.
- **C3.** Aucun `:focus-visible` global dans 2 630 lignes de CSS : une seule règle de focus existe
  (`index.css:583`, `.input-control`), tandis que `outline: none` est posé 3 fois en CSS et
  **18 fois en inline** dans les `.tsx`. Navigation clavier partiellement invisible.
- **C4.** 7 `aria-label` dans toute l'application ; les icônes-boutons (cloche, menus, actions de
  ligne) n'ont pas de nom accessible.
- **C5.** La cloche du tableau de bord (`Dashboard.tsx:191-224`) est un `<div>` cliquable : ni
  focusable, ni activable au clavier.

## D. Typographie

- **D1.** Trois familles chargées : `Outfit` (corps), `Plus Jakarta Sans` (titres), plus `DM Sans`
  qui écrase `--font-secondary` dans la console plateforme (`index.css:2325`, `:2360`). Deux suffisent.
- **D2.** `@import` Google Fonts en **première ligne** de `index.css` (`index.css:1`) : requête
  sérialisée et bloquante, sans `preconnect`. À déplacer en `<link rel="preconnect">` +
  `<link rel="stylesheet">` dans `index.html`, ou à auto-héberger.
- **D3.** Aucune échelle typographique : les tailles sont improvisées en inline
  (0,7 / 0,72 / 0,75 / 0,78 / 0,8 / 0,82 / 0,85 / 0,9 / 0,925 / 0,975 / 1,05 rem…). À remplacer par
  6 paliers en tokens.
- **D4.** Titre héros en `3.25rem` fixe avec des `<br />` manuels (`LandingPage.tsx:423-434`) : la
  césure casse dès qu'on change la largeur ou la taille de police du navigateur. `clamp()` + pas de `<br />`.
- **D5.** Rayons mélangés sans règle : 6, 8, 9, 10, 12, 14, 16, 20, 28 px et `9999px` cohabitent.
  Trois paliers suffisent (contrôle 10 px, carte 16 px, pastille pleine).

## E. Structure et composition

- **E1.** 180 objets `style={{}}` dans `LandingPage.tsx`, 90 dans `Dashboard.tsx`, 157 dans
  `PlatformAdminPage.tsx` : aucune réutilisation possible, la dérive visuelle est mécanique.
- **E2.** Le héros empile 5 blocs de texte (pastille, titre, paragraphe, CTA, ligne de réassurance
  `:483-490`) au lieu de 4 maximum, plus **un badge posé sur la photo** (`:496-540`). Le badge porte
  une information réelle (le prix) : le sortir sous l'image, pas le supprimer.
- **E3.** Le carrousel infini de modules (`:566-616`) n'apporte aucune information : ce sont les mêmes
  sept mots que la barre latérale de l'aperçu, en mouvement.
- **E4.** Bandeau de 4 colonnes icône + libellé (`:624-651`) : motif générique par excellence.
- **E5.** La grille tarifaire affiche **4 lignes identiques sur 5** pour les trois plans
  (`LandingPage.tsx:174-186`) : elle ne différencie rien et n'aide pas à choisir. Ajouter les
  vraies différences (limite d'utilisateurs, rôles autorisés, durée) et retirer le bruit.
- **E6.** ~700 lignes de maquette statique de l'aperçu vivent dans `LandingPage.tsx` (`:800-1190`) :
  à extraire dans `components/AppPreview.tsx`, ou à remplacer par une capture réelle de
  `NewAppointmentPage.tsx`, ce qui règle aussi B1.

## F. Performance

- **F1.** `public/doctor_hero.png` 620 Ko, `lab_showcase.png` 535 Ko, `clinic_hero.png` 695 Ko (utilisé
  uniquement en image Open Graph). Aucun WebP/AVIF. Sur une connexion mobile ivoirienne, le héros seul
  coûte plusieurs secondes de LCP.
- **F2.** Aucune balise `width`/`height` sur les `<img>` de la landing → décalage de mise en page (CLS).
- **F3.** Pas de `fetchpriority="high"` sur l'image du héros, pas de `loading="lazy"` sur
  `lab_showcase.png` qui est sous la ligne de flottaison.
- **F4.** `@import` de polices bloquant (cf. D2).

## G. Ce qui est déjà bon — à ne pas casser

- `prefers-reduced-motion` est traité sérieusement (`index.css:298`, `:336`, `:1459`, `:2106`).
- États vides / squelettes / erreurs présents sur toutes les pages métier.
- Les prix viennent du backend (`GET /settings/public/plans`), avec repli hors ligne documenté.
- Le badge « Données d'exemple — patients et médecins fictifs » de l'aperçu est honnête : à garder.
- L'aperçu est inerte et `aria-hidden` : correct.
- Le vert profond `#1e4d40` est une couleur de marque solide et non générique. C'est elle qu'il faut
  généraliser, pas la remplacer.

---

# Plan d'implémentation

Ordre imposé par le risque : on corrige d'abord ce qui est faux, ensuite on unifie, enfin on redessine.
Aucune étape ne touche aux URL, aux libellés de navigation, aux noms de champs de formulaire ni aux
métadonnées SEO (`index.html`) — hors correction du contenu faux.

## Phase 0 — Vérité du contenu (≈ 1 jour, aucun risque visuel)

- **T0.1** `Dashboard.tsx` : corriger A1, A2, A3, A4 (libellés des deux cartes, branche `cancelled`,
  légende alignée). Retirer l'emoji `:155`.
- **T0.2** `LandingPage.tsx` : corriger A5 à A11 et A14 (CTA header, bouton « Toutes les
  fonctionnalités », pastille « Rapports BI », trois formulations marketing, mention « web & mobile »,
  bandeau des 4 colonnes).
- **T0.3** `TermsOfServicePage.tsx:173` : adresse de contact au domaine (A12).
- **T0.4** Vérifier auprès de la boutique Chariow quels opérateurs sont actifs, puis n'afficher que
  ceux-là (A11).
- *Recette :* aucun libellé de l'interface ne décrit un chiffre ou une fonction qui n'existe pas ;
  un RDV annulé s'affiche « Annulé ».

## Phase 1 — Système de design unique (≈ 2 à 3 jours)

- **T1.1** Écrire dans `index.css` un jeu de tokens complet et unique :
  - marque : échelle `--brand-50 … --brand-900` dérivée de `#1e4d40` (le teal `#0d9488` devient
    `--brand-400`, réservé aux graphiques et aux liens) ;
  - neutres : **une seule** famille froide (slate), fin du fond menthe `#f2f8f6` ;
  - sémantiques : succès / alerte / danger / info, chacun avec une variante fond **définie en clair
    et en sombre** ;
  - typographie : 6 paliers (`--text-xs … --text-3xl`) + `clamp()` pour les titres vitrine ;
  - rayons : 3 paliers ; ombres : 3 paliers teintés marque.
- **T1.2** Corriger `--text-muted` en clair et en sombre (C1, C2) et vérifier au contrastomètre.
- **T1.3** Ajouter un `:focus-visible` global (anneau 2 px marque + décalage 2 px), retirer les
  18 `outline: 'none'` inline non compensés (C3).
- **T1.4** Supprimer `DM Sans` (D1) et déplacer le chargement des polices dans `index.html` avec
  `preconnect` (D2).
- **T1.5** Créer `components/ui/` : `Button`, `Card`, `StatCard`, `Badge`, `Field`. Trois variantes de
  bouton maximum. Aucun nouveau composant ne doit contenir de couleur en dur.
- *Recette :* `grep -rE "#[0-9a-fA-F]{6}" src --include=*.tsx | wc -l` passe sous 40 (contre ≈ 500
  aujourd'hui) ; l'application est lisible en clair **et** en sombre sur chaque page.

## Phase 2 — Migration des écrans applicatifs (≈ 2 jours)

- **T2.1** `Dashboard.tsx` : cartes statistiques et lignes d'alerte sur les nouveaux tokens (règle B3
  levée), cloche transformée en `<button aria-label>` (C5).
- **T2.2** `Sidebar.tsx` / `Header.tsx` / `AuthPage.tsx` : suppression des palettes locales, reprise
  des tokens de marque. `AuthPage` garde son panneau sombre, mais dans la famille de marque.
- **T2.3** Passe sur les pages métier (Patients, Pharmacie, Laboratoire, Comptabilité, Dépôts,
  Ordonnances) : remplacement des hex par tokens, sans toucher à la logique.
- **T2.4** Console plateforme alignée sur les mêmes tokens (elle en a déjà sa propre variante).
- *Recette :* capture d'écran de chaque page en clair et en sombre ; une seule famille de vert visible.

## Phase 3 — Landing : évolution ciblée (≈ 2 à 3 jours)

Mode « préserver » : mêmes sections, mêmes ancres (`#features`, `#pricing`, `#apercu`), même voix.

- **T3.1** Héros : titre en `clamp(2.25rem, 5vw, 3.5rem)` sans `<br />`, réassurance déplacée sous les
  CTA en dehors du bloc héros, badge prix sorti de la photo (E2, D4).
- **T3.2** Carrousel de modules (E3) et bandeau 4 colonnes (E4, A14) fusionnés en **une** section :
  trois faits vérifiables, mise en page asymétrique, pas d'icône décorative par colonne.
- **T3.3** Aperçu produit : extraction dans `components/AppPreview.tsx`, palette réalignée sur les
  tokens de l'application (B1, E6). Option retenue si le temps manque : capture réelle de
  `NewAppointmentPage.tsx` avec un jeu de données de démonstration, ce qui supprime 700 lignes.
- **T3.4** Tarifs : lignes de comparaison réellement différenciantes (E5), pastilles de paiement
  ramenées à une seule famille neutre + logos monochromes (B2).
- **T3.5** Section finale : titre concret à la place de « Prêt à transformer votre clinique ? »,
  surtitre « COMMENCER » supprimé.
- **T3.6** Extraire les styles répétés de la landing vers des classes `.landing-*` déjà existantes
  (E1) : cible ≤ 60 objets `style={{}}` dans le fichier.
- *Recette :* un lecteur qui ne connaît pas le produit peut citer trois fonctions réelles après un
  seul défilement ; aucune promesse invérifiable ne subsiste.

## Phase 4 — Performance et accessibilité (≈ 1 à 2 jours)

- **T4.1** Convertir les trois PNG en AVIF + WebP avec repli, en deux largeurs (`srcset`), cible
  ≤ 120 Ko pour le héros (F1).
- **T4.2** Ajouter `width`/`height` sur toutes les images de la landing (F2), `fetchpriority="high"`
  sur le héros et `loading="lazy"` sur `lab_showcase` (F3).
- **T4.3** Passe `aria-label` sur les boutons-icônes de l'application (C4).
- **T4.4** Lighthouse mobile sur la landing : LCP < 2,5 s, CLS < 0,1, accessibilité ≥ 95.
- *Recette :* rapport Lighthouse joint à la PR.

## Ce que ce plan ne fait volontairement pas

- Pas d'introduction de Tailwind, de bibliothèque de composants ni de moteur d'animation : le CSS
  natif du dépôt suffit et la landing doit rester légère pour les connexions mobiles ivoiriennes
  (règle déjà posée dans `CLAUDE.md` pour la console plateforme).
- Pas de refonte de l'arborescence, des ancres ni des métadonnées : le SEO existant est préservé.
- Pas de réécriture de la voix éditoriale française : seules les phrases fausses ou creuses changent.

## Séquencement conseillé

Phase 0 est indépendante et peut partir seule en production. Phases 1 et 2 doivent voyager ensemble
(les tokens sans la migration laissent l'application à moitié convertie). Phase 3 dépend de la
phase 1. Phase 4 est indépendante et peut être menée en parallèle.

---

## État d'avancement (2026-09-01)

**Phase 0 — faite.** A1 à A12 corrigés. Contact des CGU passé à `contact@mediclinicpro.com` sur
décision de l'utilisateur, puis **ramené à `blog.ousmane@gmail.com` le 2026-09-02** : la boîte au
domaine n'était pas exploitable. Quelle qu'elle soit, **cette adresse doit être relevée** — une
adresse morte dans des conditions générales vaut moins que pas d'adresse du tout. Les quatre opérateurs Chariow sont confirmés actifs par
l'utilisateur, les pastilles restent (leurs couleurs seront reprises en phase 3).

**Phase 1 — faite.** Échelle de marque `--brand-50…900` dérivée de `#1e4d40`, séparation
remplissage / encre (`--brand-fill` / `--primary`), neutres unifiés en slate, quatre couleurs
sémantiques avec surface et encre définies **dans les deux thèmes**, échelle typographique,
tokens de barre latérale. `--text-muted` corrigé dans les deux thèmes (2,9:1 → 4,8:1 en clair,
3,95:1 → 7,4:1 en sombre). `:focus-visible` global plus suppression des 18 `outline: 'none'`
inline. DM Sans supprimé, polices chargées depuis `index.html` avec `preconnect`.
`components/ui/` : `StatCard`, `StatusBadge`, `Button`.

**Phase 2 — faite.** Tableau de bord (quatre cartes passées par `StatCard`, pastilles par
`StatusBadge`, cloche transformée en `<button aria-label>`, badge d'essai sorti du dégradé orange),
barre latérale, en-tête, authentification, pages métier, console plateforme et page CGU.

Deux exceptions assumées, documentées dans le CSS :
- la **console plateforme** garde son fond papier `#F4F3F0` (parité Banani, outil de l'exploitant),
  mais plus son vert ni sa police propres ;
- la **page d'onboarding** et la **page CGU** gardent une palette fixe : elles s'affichent hors
  session, où `data-theme` peut être resté sur « dark » sans utilisateur connecté. Brancher
  `--tp-fg` sur `--text-primary` rendait d'ailleurs le bandeau de titre des CGU blanc sur blanc.

Reste en couleurs écrites en dur : 149 dans `LandingPage.tsx` (phase 3), 39 dans
`OnboardingPage.tsx` (écran volontairement sombre, accents réalignés sur la marque), et des
`#ffffff` posés sur des aplats de couleur, qui sont corrects dans les deux thèmes.

**Phase 3 — faite.** Tokens `--lp-*` scopés sur `.landing-page` (palette claire fixe, même raison
que les CGU). Héros : titre en `clamp()` sans césure manuelle, ligne de réassurance sortie du
héros, badge de prix sorti de la photo. Carrousel infini et bandeau de quatre colonnes fusionnés
en une seule section « Sept modules, un seul dossier patient » plus les quatre faits, en
composition asymétrique ; le CSS mort du carrousel est supprimé. Maquette d'aperçu extraite dans
`components/AppPreview.tsx` (521 lignes sorties de `LandingPage.tsx`) et repeinte avec la palette
claire réelle de l'application. Tarifs : les cartes ne gardent que les trois lignes qui
**diffèrent** (comptes, rôles, durée), le commun est écrit une fois sous la grille ; pastilles de
paiement ramenées à une seule famille neutre. Section finale réécrite. Boutons, cartes de tarifs
et bandeaux extraits en classes : `LandingPage.tsx` passe de 180 à 74 objets `style={{}}` et de
149 couleurs en dur à 2 (deux `#ffffff` sur aplat sombre).

**Phase 4 — faite, avec une limite structurelle.** `npm run images` (script `sharp`, dépendance de
développement) produit AVIF et WebP en deux largeurs : la photo du héros passe de **606 Ko à 16 Ko**
en AVIF, celle du laboratoire de 523 Ko à 18 Ko. `<picture>` avec `srcset`/`sizes`, `width`/`height`
réels, `fetchpriority="high"` sur le héros, `loading="lazy"` sous la ligne de flottaison. Feuille
des polices sortie du chemin critique. Pagination factice retirée de la liste des patients (deux
boutons sans gestionnaire), lien CGU du pied de page passé de `<span onClick>` à `<button>`,
`aria-label` ajoutés aux boutons-icônes. `AuthPage` et les CGU passées en chargement différé :
`AuthPage` tirait `libphonenumber-js`, téléchargé par tout visiteur de la vitrine.

Mesures Lighthouse sur la page construite (`vite preview`) :

| | avant | après |
|---|---|---|
| Performance (bureau) | 74 | **87** |
| Accessibilité | 93 | **100** |
| First Contentful Paint | 1,4 s | **0,8 s** |
| Speed Index | 3,2 s | **1,9 s** |
| Total Blocking Time | 190 ms | **80 ms** |
| LCP / CLS | 1,9 s / 0 | **1,9 s / 0** |

**Limite restante, à décider.** Au préréglage *mobile* de Lighthouse (4G bridée, processeur ×4),
la vitrine reste à 46 de performance, LCP 6,4 s, FCP 3,6 s. Le découpage a fait tomber le blocage
du fil principal de 1 200 ms à 880 ms, mais le plafond est structurel : la page vitrine est rendue
par une application React côté client, donc le visiteur télécharge et exécute 386 Ko de JavaScript
avant de voir le moindre texte. Aucun réglage d'image ou de police ne corrige cela. La sortie est
un **prérendu HTML de la vitrine** (SSG au build, ou fonction de rendu côté serveur), ce qui touche
l'architecture du routage (`App.tsx` n'a pas de vraies routes) et sort du cadre de cet audit.
