# Refonte de la vitrine (chantier 1) — conception

**Date :** 2026-10-05
**État :** direction et maquette validées par le propriétaire du produit le 2026-10-05
**Maquette de référence :** `docs/superpowers/specs/assets/2026-10-05-vitrine/maquette-direction-a.html`
(HTML et CSS complets. Les images `/files/*.png` qu'elle cite sont produites par le script de captures décrit plus bas.)

## Problème

Des visiteurs arrivent sur la vitrine, certains s'inscrivent, puis repartent. Le propriétaire estime que le
site « ne fait pas pro ». L'audit du 2026-10-05 (captures de la production, de l'inscription, de
l'onboarding et d'un compte neuf, API simulée en local) confirme le diagnostic et en précise les causes :

1. **Le héros est générique.** On y voit une photo de médecin générée par IA, et ça se voit : badge
   illisible « DR. S. ADEBAYO », panneau « AFRICA CARE CLINIC ». S'y ajoutent une pastille « Solution fiable
   pour votre clinique » et un titre abstrait (« Une plateforme, une meilleure prise en charge »). Le
   logiciel lui-même n'apparaît qu'en quatrième section.
2. **Personne n'est joignable.** Pas de WhatsApp, pas de téléphone, aucune indication de qui est derrière le
   produit. Pour un acheteur B2B ivoirien, c'est le premier critère de confiance.
3. **L'aperçu de lien est cassé.** `canonical`, `og:url` et `og:image` pointent vers `mediclinicpro.example`.
   Un lien partagé sur WhatsApp ou Facebook s'affiche sans image.
4. **La page a l'allure d'un gabarit.** Une pastille avec icône au-dessus de chaque section, trois bandeaux
   vert foncé, trois cartes de tarifs identiques dont une marquée « Populaire » (badge non fondé : aucun
   client payant), une maquette d'interface construite en `div` (`AppPreview.tsx`).
5. **Le parcours change quatre fois d'ambiance.** Vitrine claire, inscription claire, onboarding bleu nuit,
   application verte.

L'audit a aussi relevé trois défauts hors vitrine, mais que la vitrine rendrait visibles ou qui touchent les
mêmes fichiers :

6. **L'ordonnance imprimée porte le nom d'une autre clinique.** `PatientDetailPage.tsx:316` et
   `OrdonnancesPage.tsx:336` écrivent en dur « CLINIQUE MÉDICALE DE L'AVENIR, Cocody Boulevard de France,
   Tél: +225 0707080910 ». Le reçu de caisse, lui, est correct depuis `a6396d7`.
7. **Les modèles d'impression ne sont pas échappés (faille de sécurité).** Les trois modèles (reçu et journal
   dans `AccountingPage.tsx`, dossier dans `PatientDetailPage.tsx`, ordonnance dans `OrdonnancesPage.tsx`)
   insèrent noms de patients, motifs, diagnostics, notes et noms de caissiers dans du HTML écrit par
   `document.write`. La fenêtre ouverte par `window.open('')` partage l'origine de l'application. Un membre
   de l'équipe qui enregistre un patient nommé `<img src=x onerror=…>` exécute donc du script chez la
   personne qui imprime ensuite ce dossier : il peut lire `window.opener.localStorage.mediclinic_token` et
   s'emparer de sa session, administrateur compris.
8. **La durée d'essai annoncée peut mentir.** La durée réelle vient du réglage `starter_trial_days`
   (modifiable de 1 à 90 jours dans Platform Admin, lu par `auth.js` à l'inscription). Mais
   `GET /settings/public/plans` renvoie `PLANS` tel quel, donc `trialDays: 7` en dur. Si l'exploitant passe
   l'essai à 14 jours, la vitrine continue d'annoncer 7.

## Objectif

Une vitrine qui inspire confiance dès le premier écran et qui ne promet rien que le code ne tienne :

- montrer **le vrai logiciel** dès le héros (captures réelles, données d'exemple signalées comme telles) ;
- mettre **une personne joignable** à portée de clic (WhatsApp) ;
- dire **concrètement** ce que fait chaque poste de la clinique, en français, en FCFA ;
- garder **une seule ambiance** de la vitrine à l'inscription ;
- corriger les défauts 3, 6, 7 et 8.

**Hors périmètre** (chantiers suivants, chacun avec sa propre spec) :
- **Chantier 2, premiers pas :** onboarding aligné sur ce langage visuel, tableau de bord « compte neuf » avec
  liste de premières actions, correction de « Bonjour, Dr » (le prénom affiché est le premier mot du nom,
  qui peut être un titre).
- **Chantier 3, application :** refonte visuelle de l'ossature et des modules, adoption de Geist dans
  l'application, retrait d'Outfit et de Plus Jakarta Sans.

## Lecture de design

Landing B2B pour gérants et médecins-chefs de petites et moyennes cliniques ivoiriennes, souvent consultée
sur téléphone. Langage de confiance et de précision : le produit est montré tel qu'il est. Implémentation en
CSS natif (convention du dépôt), police Geist, captures réelles, mouvement retenu.

Cadrans (skill `design-taste-frontend`) : `DESIGN_VARIANCE 6 / MOTION_INTENSITY 4 / VISUAL_DENSITY 4`.
Il s'agit d'une refonte en profondeur du visuel. Le contenu, les ancres et les parcours sont conservés.

## Direction retenue : A, « Clair et précis »

Trois directions ont été présentées en maquette : A (clair et précis), B (vert profond, sombre), C (humain,
photo en grand). A a été retenue pour trois raisons :
- elle montre le vrai produit dès le premier écran ;
- elle garde la même ambiance claire que l'application, donc pas de rupture après l'inscription ;
- elle reste lisible en plein soleil sur téléphone.

L'aspect humain de C est repris plus bas, dans le bloc fondateur et une éventuelle photo réelle.

### Système visuel

Les jetons sont déclarés une seule fois dans `frontend/src/styles/site.css`, sous la classe racine `.site`.
Ils ne fuient pas dans l'application.

| Jeton | Valeur | Usage |
|---|---|---|
| `--bg` | `#f5f7f6` | fond de page |
| `--surface` | `#ffffff` | bandes et cartes |
| `--surface-2` | `#eef2f0` | barre d'URL des captures, onglets inactifs |
| `--ink` | `#0f1a17` | titres et texte fort |
| `--ink-2` | `#3a4743` | texte courant |
| `--muted` | `#5b6762` | texte secondaire (5,4:1 sur `--bg`, AA) |
| `--line` / `--line-2` | `#e0e6e3` / `#ccd6d1` | filets, bordures de contrôles |
| `--brand` | `#1e4d40` | **seule couleur d'accent** (= `--brand-700` de `index.css`) |
| `--brand-hover` | `#163a30` | survol du bouton principal |
| `--brand-soft` / `--brand-soft-2` | `#e4eee9` / `#d3e5dc` | fonds teintés, bandeau d'essai |

- **Typographie :** Geist (variable) pour tout le texte, Geist Mono pour l'URL des captures et les numéros
  (`FAC-2026-00042`). Les polices sont auto-hébergées via `@fontsource-variable/geist` et
  `@fontsource-variable/geist-mono` (5.3.0), importées par la vitrine seulement. Échelle :
  - H1 : 56 px sur ordinateur, 48 px sur tablette, 38 px sur téléphone ; graisse 600, interlettrage
    −0,042 em, interligne 1,02.
  - H2 : 44, 38 puis 30 px.
  - Texte courant : 17 px sur ordinateur, 16 px sur téléphone, interligne 1,6.
  - Les chiffres de prix utilisent `font-variant-numeric: tabular-nums`.
- **Formes, règle unique :**
  - 10 px pour les contrôles (boutons, champs) ;
  - 16 px pour les panneaux (cartes, bandeaux) ;
  - 12 px pour les captures ;
  - 20 px pour le panneau d'appel final ;
  - aucun bouton en pilule.
- **Ombres :** réservées aux captures et aux documents imprimés, teintées vert (`rgba(20, 62, 50, …)`), jamais
  noires.
- **Icônes :** `lucide-react`, déjà dépendance du projet, épaisseur 1,75. Le logo WhatsApp est le tracé
  officiel issu de `simple-icons`, copié en `frontend/public/brand/whatsapp.svg`. Il n'est pas redessiné.
- **Thème :** vitrine **en clair uniquement** (décision validée). Les captures et l'application sont claires,
  et un thème sombre doublerait la vérification pour un gain nul ici. Les panneaux vert marque (cellule
  téléphone, appel final) sont des blocs contenus, pas des inversions de section.
- **Mouvement :** CSS seulement, aucune bibliothèque ajoutée.
  - Entrée du héros échelonnée : opacité et translation de 10 px, 70 ms d'écart.
  - Apparition au défilement : le motif `IntersectionObserver` existant.
  - Fondu au changement d'onglet.
  - Bouton enfoncé d'un pixel au clic.
  - Tout est désactivé sous `prefers-reduced-motion: reduce`.
- **Points de rupture :** `max-width: 1080px` (tablette, une colonne) et `max-width: 640px` (téléphone,
  marges de 20 px, boutons pleine largeur). La maquette les exprime en requêtes de conteneur pour son
  bouton d'aperçu ; l'implémentation utilise des requêtes média.

### Structure de la page

Textes définitifs ci-dessous. Toute valeur entre accolades vient de l'API ou de la configuration, jamais
d'une constante recopiée.
Les textes exacts des réponses de la FAQ et des légendes sont ceux de la maquette de référence ; en cas
d'écart, cette spec prévaut.

0. **Navigation** collante, 68 px, fond translucide flouté. À gauche le logo, au centre « Fonctionnalités »,
   « Tarifs », « Questions » (ancres `#fonctionnalites`, `#tarifs`, `#questions`), à droite « Connexion » et
   le bouton « Essayer gratuitement ». Sur téléphone : logo, bouton « Essayer gratuitement » et bouton menu.
   Le menu ouvre un panneau avec les trois ancres, « Connexion » et « Écrire sur WhatsApp ».
1. **Héros** (deux colonnes, la capture déborde à droite) :
   - surtitre « Logiciel de gestion de clinique » ;
   - H1 « Toute votre clinique, de l'accueil à la caisse. » ;
   - texte « Dossiers patients, rendez-vous, ordonnances, pharmacie, laboratoire et encaissements, pensés
     pour les cliniques de Côte d'Ivoire. » ;
   - boutons « Essayer gratuitement » (principal) et « Écrire sur WhatsApp » (secondaire) ;
   - visuel : capture du tableau de bord dans un cadre portant l'URL `mediclinicpro.com`. Sur téléphone, la
     capture mobile réelle dans un cadre de téléphone. L'image du héros est l'élément LCP : `<picture>`
     AVIF/WebP, `fetchpriority="high"`, dimensions déclarées.
2. **Bandeau de faits** (4 colonnes séparées par des filets, 2 × 2 sur téléphone) :
   - « {trialDays} jours gratuits » / « Sans carte bancaire ni engagement » ;
   - « Prix en FCFA » / « Abonnement payable par Mobile Money » ;
   - « Données séparées » / « Chaque clinique ne voit que ses dossiers » ;
   - « Aide sur WhatsApp » / « On vous aide à démarrer, en français ».
3. **Parcours** (`#fonctionnalites`) :
   - H2 « Un seul dossier patient, partagé par toute l'équipe. » ;
   - texte « La secrétaire l'ouvre, le médecin le complète, le laboratoire et la pharmacie s'en servent, la
     caisse encaisse. Personne ne ressaisit. » ;
   - cinq onglets accessibles (`role="tablist"`, flèches gauche et droite) ; chaque panneau porte un titre,
     trois points et une capture (desktop, ou mobile sur téléphone) :
     - **Accueil** : « Le registre des patients, toujours à jour. » Numéro de dossier attribué
       automatiquement. Allergies visibles d'un coup d'œil. Rendez-vous et orientation vers le médecin
       disponible.
     - **Consultation** : « Le médecin voit tout l'historique avant de consulter. » Constantes, diagnostic
       et notes dans le dossier. Ordonnance et analyses prescrites depuis la consultation. Résultats et
       factures dans la même chronologie.
     - **Laboratoire** : « Les demandes d'analyses arrivent directement au labo. » Chaque demande avec son
       heure, son patient et son médecin. Résultats saisis une fois, lus par le médecin. Plus de bon papier
       qui se perd entre deux bureaux.
     - **Pharmacie** : « Un stock qui ne disparaît plus. » Alertes de stock bas et de péremption proche.
       Délivrance liée à l'ordonnance : le stock baisse tout seul. Prix d'achat, prix de vente et marge par
       produit.
     - **Caisse** : « Chaque franc encaissé a son reçu. » Reçu numéroté à l'en-tête de la clinique. Journal
       des recettes et total du jour. Le nom de la personne qui a encaissé, sur chaque ligne.
   - légende sous les onglets : « Captures de l'application, avec des données d'exemple. »
4. **Documents** :
   - H2 « Vos patients repartent avec un reçu à votre nom. » ;
   - texte « Chaque encaissement produit un reçu numéroté, imprimé à l'en-tête de votre clinique. Les
     ordonnances aussi. » ;
   - trois points :
     - « L'en-tête de votre clinique » (nom, adresse et téléphone repris des paramètres) ;
     - « Un numéro unique » (`FAC-2026-00042` est attribué par le système : deux reçus ne peuvent pas porter
       le même) ;
     - « Qui a encaissé » ;
   - visuel : le reçu imprimé réel, posé sur un panneau `--brand-soft`. La phrase « Les ordonnances aussi »
     n'est vraie qu'**après** le correctif du défaut 6, qui est donc un prérequis de cette section.
5. **« Fait pour les cliniques d'ici. »** (grille asymétrique de 4 cellules) :
   - **Téléphone** (haute, fond `--brand`) : « Sur ordinateur comme sur téléphone », avec la capture mobile.
   - **Rôles** (large) : « Chacun voit ce qui le concerne ». Texte : « Sept rôles, chacun avec ses écrans.
     Le pharmacien n'a pas accès à la comptabilité, le laborantin ne voit pas la caisse. » Les sept
     libellés en pastilles neutres.
   - **Prix** (fond `--brand-soft`) : « En FCFA, sans conversion ». Moyens de paiement, puis « dès {prix
     Clinique} FCFA / mois ».
   - **Données** : « Vos données restent les vôtres ». Trois points : espace propre à chaque clinique,
     connexion chiffrée, compte désactivé coupé immédiatement.
6. **Tarifs** (`#tarifs`) :
   - H2 « Un prix clair, en FCFA. » ;
   - texte « Toute l'équipe essaie gratuitement pendant {trialDays} jours. Ensuite, vous choisissez la formule
     qui correspond à la taille de votre clinique. » ;
   - bandeau d'essai : « Essai gratuit de {trialDays} jours », « {staffLimit Starter} comptes
     (administrateur, médecin, secrétaire), sans carte bancaire », bouton « Essayer gratuitement » ;
   - deux cartes sans bouton :
     - **Clinique** : « Cabinets et petites cliniques », {prix} FCFA / mois, « Jusqu'à {staffLimit} comptes »,
       « Les 7 rôles, dont pharmacien et laborantin » ;
     - **Hôpital** : « Cliniques avec plusieurs services », {prix} FCFA / mois, « Comptes illimités », même
       mention des rôles ;
   - pas de badge « Populaire » ;
   - « Inclus dans les deux formules » (9 points) : patients illimités, rendez-vous et dossiers, ordonnances,
     pharmacie et stock, laboratoire, caisse et reçus, dépôts de garantie, mises à jour, assistance WhatsApp ;
   - note de paiement : « Paiement par Orange Money, MTN MoMo, Wave ou carte bancaire, pour 1, 3, 6 ou 12
     mois. Changement de formule à tout moment depuis l'application. »
   - Les prix et limites viennent de `GET /settings/public/plans`. Le repli statique actuel reste en place
     si l'API ne répond pas.
7. **Fondateur** (portrait 4:5 et citation) : citation à la première personne, « {nom}, fondateur de
   MediClinic », bouton « Écrire sur WhatsApp ». **Le bloc n'est rendu que si `SITE.founder` est renseigné.**
8. **Questions fréquentes** (`#questions`, colonne de titre collante et accordéon `<details>`), sept
   questions :
   - « Faut-il installer un logiciel ? » Non, MediClinic s'utilise dans le navigateur, sur ordinateur,
     tablette ou téléphone, avec une connexion internet.
   - « Que se passe-t-il à la fin des {trialDays} jours d'essai ? » Formule à choisir et à régler depuis
     l'application. Sans paiement, les dossiers restent consultables 3 jours, puis l'accès est suspendu
     jusqu'au règlement. Les données sont conservées.
   - « Mes données médicales sont-elles protégées ? » Espace propre à chaque clinique, connexion chiffrée,
     écrans limités au rôle, compte désactivé coupé immédiatement.
   - « Faut-il une connexion internet en permanence ? » Oui, MediClinic fonctionne en ligne. Une connexion
     mobile suffit.
   - « Combien de personnes peuvent l'utiliser ? » {Starter}, {Clinique} ou sans limite selon la formule.
     Patients illimités.
   - « Comment payer l'abonnement ? » Moyens et durées, depuis Paramètres.
   - « Pouvez-vous nous aider à démarrer ? » Oui, sur WhatsApp au {numéro}.
9. **Appel final** (panneau `--brand`) : « Essayez MediClinic dans votre clinique cette semaine. » Texte :
   « {trialDays} jours gratuits, sans carte bancaire. Une question avant de commencer ? On vous répond sur
   WhatsApp. » Boutons « Essayer gratuitement » (fond blanc) et « Écrire sur WhatsApp ».
10. **Pied de page** (clair) :
    - logo et « Logiciel de gestion de clinique pour la Côte d'Ivoire. » ;
    - colonne Produit : les trois ancres ;
    - colonne Compte : Connexion, Essayer gratuitement ;
    - colonne Contact : WhatsApp {numéro}, Conditions d'utilisation ;
    - ligne légale : « © {année} {raison sociale}. RCCM {numéro}. » si `SITE.legal` est renseigné, sinon
      « © {année} MediClinic. »

**Règles de libellés :** une intention, un libellé. L'inscription s'écrit toujours « Essayer gratuitement »,
le contact toujours « Écrire sur WhatsApp ». Aucun tiret cadratin dans les textes visibles. Un seul surtitre
sur la page, celui du héros.

**Photo réelle (optionnelle) :** si le propriétaire fournit une photo nette et lumineuse d'une vraie clinique
ou de l'équipe, elle s'insère en bande pleine largeur entre « Documents » et « Fait pour les cliniques
d'ici ». Sans photo, ou avec une photo médiocre, rien n'est ajouté. Les images actuelles `doctor_hero.png`
et `lab_showcase.png`, générées, sont retirées de la page. `clinic_hero.png` n'est plus l'image de partage.

### Configuration du site

Nouveau fichier `frontend/src/config/site.ts`, seule source des données de contact et d'identité :

```ts
export const SITE = {
  url: 'https://mediclinicpro.com',
  whatsapp: {
    display: '+225 07 88 81 81 18',
    e164: '2250788818118',
    message: 'Bonjour, je souhaite en savoir plus sur MediClinic.',
  },
  founder: null as null | { name: string; role: string; photo: string; quote: string },
  legal: null as null | { name: string; rccm: string },
  fieldPhoto: null as null | { src: string; alt: string },
};
export const whatsappUrl = (text = SITE.whatsapp.message) =>
  `https://wa.me/${SITE.whatsapp.e164}?text=${encodeURIComponent(text)}`;
```

Les liens WhatsApp ouvrent `wa.me` dans un nouvel onglet (`rel="noopener"`), avec un message prérempli.
La page des CGU lit le même fichier pour le téléphone et l'éventuelle raison sociale. L'adresse e-mail
de contact des CGU reste inchangée (décision du commit `ca6ed34`).

### Pages annexes

- **Connexion et inscription (`AuthPage.tsx`)** : restyle seul, aucune logique touchée (connexion,
  inscription, mot de passe oublié, Google, bascule de visibilité du mot de passe, états de chargement).
  - Le panneau gauche sombre devient un panneau clair `--surface` : logo, titre « Toute votre clinique, de
    l'accueil à la caisse. », la capture du tableau de bord recadrée, et la ligne « {trialDays} jours
    gratuits, sans carte bancaire ».
  - Les libellés en capitales (« ADRESSE EMAIL ») passent en casse de phrase (« Adresse e-mail »). Les noms
    et l'ordre des champs ne changent pas.
  - Le tiret cadratin du sous-titre disparaît.
  - Sous le formulaire : « Besoin d'aide ? Écrivez-nous sur WhatsApp ».
  - Jetons, police et boutons identiques à la vitrine.
- **CGU (`TermsOfServicePage.tsx`)** : mêmes jetons et même police. Le contenu juridique est inchangé.
- **`frontend/index.html`** :
  - `canonical`, `og:url` et `og:image` pointent vers `https://mediclinicpro.com` ;
  - nouvelle image de partage `frontend/public/og-image.png` (1200 × 630), composée du logo, du titre du
    héros et de la capture réelle, générée par le script de captures ;
  - `<title>` et descriptions sans tiret cadratin ;
  - `robots.txt` et `sitemap.xml` passent au vrai domaine ;
  - la mention « 7 jours » des métadonnées statiques reste écrite à la main, avec un commentaire indiquant
    de la mettre à jour si `starter_trial_days` change. Le HTML statique ne peut pas lire l'API.

### Captures produit

Nouveau script versionné `frontend/scripts/capture-screens.mjs`, lancé par `npm run captures` :
- Il pilote **l'application réelle** (serveur Vite local) avec `playwright-core` (nouvelle dépendance de
  développement) et le Chrome installé sur le poste.
- Chaque appel `/api/*` reçoit une réponse locale tirée de `frontend/scripts/capture-data.mjs` : une clinique
  « Cabinet Médical Les Palmiers » et des patients, soignants, médicaments, analyses et paiements aux noms
  ivoiriens plausibles. **Aucune requête ne sort du poste.**
- Il produit, en desktop (1440 × 900) et en mobile (390 × 844) à densité 2 :
  - tableau de bord ;
  - registre des patients ;
  - dossier patient ;
  - laboratoire ;
  - pharmacie ;
  - journal des recettes ;
  - reçu imprimé ;
  - l'image de partage.
- `npm run images` (script existant, étendu) en tire les variantes AVIF et WebP dans
  `frontend/public/captures/`.
- À relancer quand l'interface change, notamment après le chantier 3.

### Correctifs d'impression (défauts 6 et 7)

Nouveau module `frontend/src/utils/print.ts` :
- `escapeHtml(value)` remplace `& < > " '` par leurs entités ;
- `clinicHeaderHtml(clinic, subtitle)` reprend l'en-tête du reçu, champs échappés ;
- `PRINT_STYLES` reprend les styles littéraux de `AccountingPage.tsx`. Une fenêtre `window.open('')` ne voit
  pas les variables CSS de l'application, d'où les valeurs en dur.

Les trois modèles l'utilisent : `AccountingPage.tsx` (reçu et journal), `PatientDetailPage.tsx`
(impression d'un élément du dossier) et `OrdonnancesPage.tsx` (ordonnance). **Toute** valeur saisie par
un utilisateur passe par `escapeHtml`. Les deux en-têtes « Clinique Médicale de l'Avenir » disparaissent.

### Durée d'essai effective (défaut 8)

`GET /settings/public/plans` lit `starter_trial_days` via `utils/platformSettings.js` et renvoie
`plans.starter.trialDays` égal à la valeur effective (repli sur `PLANS.starter.trialDays`). Le reste de la
réponse ne change pas. Un test `backend/tests/public-plans.test.js`, construit sur le harnais existant,
couvre deux cas : réglage présent, et table absente ou réglage invalide.

### Fichiers

- **Créés :**
  - `frontend/src/styles/site.css`
  - `frontend/src/config/site.ts`
  - `frontend/src/utils/print.ts`
  - les composants de la vitrine dans `frontend/src/pages/Landing/`, une section par fichier
  - `frontend/public/brand/whatsapp.svg`
  - `frontend/public/captures/*`
  - `frontend/public/og-image.png`
  - `frontend/scripts/capture-screens.mjs`
  - `frontend/scripts/capture-data.mjs`
  - `backend/tests/public-plans.test.js`
- **Réécrits :** `frontend/src/pages/LandingPage.tsx`, qui devient l'assemblage des sections.
- **Modifiés :**
  - `AuthPage.tsx`, `TermsOfServicePage.tsx` ;
  - `AccountingPage.tsx`, `PatientDetailPage.tsx`, `OrdonnancesPage.tsx` (impression seulement) ;
  - `frontend/index.html`, `robots.txt`, `sitemap.xml`, `frontend/package.json`,
    `frontend/scripts/optimize-images.mjs` ;
  - `backend/routes/settings.js`.
- **Supprimés :**
  - `frontend/src/components/AppPreview.tsx` ;
  - les blocs `.landing-*`, `.pricing-cards-grid`, `.auth-*` et `.terms-*` de `index.css`, remplacés par
    `site.css` ;
  - `doctor_hero.png`, `lab_showcase.png` et leurs variantes dans `public/optimized/`, s'ils ne sont plus
    référencés nulle part (à vérifier par recherche avant suppression).

`App.tsx` ne change pas : la vitrine garde son contrat `onNavigate('login' | 'register' | 'terms')`.

## Traçabilité des promesses

Chaque phrase de la vitrine qui décrit le produit a été vérifiée dans le code le 2026-10-05 :

| Promesse | Source |
|---|---|
| Numéro de dossier automatique | `backend/routes/patients.js`, génération de `folder_number` |
| Orientation vers le médecin disponible | `PatientsPage.tsx`, `PatientDetailPage.tsx`, `utils/schedule.js` |
| Ordonnance et analyses depuis la consultation | formulaire de consultation de `PatientDetailPage.tsx` |
| Le stock baisse à la délivrance | `POST /pharmacy/dispense/:id` → `applyStockDelta()` (lignes liées au catalogue) |
| Reçu numéroté, unique | `POST /financials/checkout` attribue `FAC-<année>-<id>` |
| Pharmacien sans comptabilité, laborantin sans caisse | `Sidebar.tsx:42-50` |
| Compte désactivé coupé immédiatement | `middleware/auth.js` relit `users.active` à chaque requête |
| Données séparées par clinique | filtre `clinic_id` de toutes les routes |
| 3 jours en lecture seule, puis suspension, données conservées | `GRACE_PERIOD_DAYS`, `LOCKED_API_PREFIXES` ; seule purge existante : `login_failures` |
| Patients illimités, limites de comptes | `backend/utils/plans.js` |
| Paiement pour 1, 3, 6 ou 12 mois | `chariow_products`, huit combinaisons |
| Orange Money, MTN MoMo, Wave, carte | **dépend de la boutique Chariow : à confirmer par le propriétaire** (mention reprise du site actuel) |

## Vérification

- `npm run build` et `npm run lint` (frontend), `npm test` (backend) passent.
- Captures Playwright de la vitrine, de la connexion et de l'inscription à 1440, 1024, 768 et 390 px,
  relues une par une : aucun débordement horizontal, titres sur deux lignes au plus sur ordinateur, boutons
  sans retour à la ligne.
- Navigation au clavier : ordre de tabulation, focus visible, onglets aux flèches, accordéon au clavier.
- Contrastes AA vérifiés sur chaque couple texte/fond du tableau des jetons.
- Lighthouse mobile sur `npm run preview` : performance ≥ 90, LCP < 2,5 s, CLS < 0,1.
- Impression : un patient nommé `<img src=x onerror=alert(1)>` (données simulées) s'imprime en texte, sans
  exécution, dans les trois modèles ; l'ordonnance porte l'en-tête de la clinique connectée.
- Aperçu de partage contrôlé après déploiement avec un débogueur Open Graph.
- Grille de contrôle finale du skill `design-taste-frontend` (section 14), case par case.

## À fournir par le propriétaire

Rien de ceci ne bloque le développement. Chaque bloc concerné reste masqué tant que sa donnée manque.
1. Fondateur : nom, rôle, photo portrait, deux ou trois phrases à la première personne.
2. Raison sociale et numéro RCCM.
3. Une photo réelle de clinique, si elle est nette.
4. La confirmation des moyens de paiement actifs sur la boutique Chariow.
