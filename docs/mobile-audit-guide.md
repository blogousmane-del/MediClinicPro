# Guide d'audit mobile — MediClinic

Audit page par page de l'app en largeur mobile (référence : ~375px, iPhone SE / Android courant), avec les problèmes trouvés et les corrections appliquées. Méthode : lecture exhaustive du code (grilles, largeurs fixes, `flexWrap`, media queries) — pas de capture d'écran réelle (pas d'outil navigateur disponible dans cet environnement), donc à valider visuellement sur un vrai téléphone ou via les DevTools.

## Corrections appliquées

### 1. Barre recherche + cloche qui débordait (Patients, Pharmacy, Laboratory, Ordonnances)
**Problème :** la boîte de recherche du header avait une largeur fixe de 280px, sans retour à la ligne possible avec l'icône de notification à côté. Sur un écran < ~400px de large, cette rangée dépassait la largeur disponible → contenu coupé/débordant. Le Dashboard avait déjà un correctif pour ce même motif, copié sur les 4 autres pages sans son CSS associé.
**Correction :** classes partagées `.page-header-actions` / `.page-search-box` (`index.css`), qui réduisent la boîte de recherche en dessous de 640px. Appliquées aux 5 endroits concernés.

### 2. Padding de page non réduit sur mobile (Pharmacy, Laboratory, Ordonnances, Patients, Dépôts)
**Problème :** ces 5 pages utilisaient un padding fixe `1.5rem 2rem` (32px de marge de chaque côté) sans réduction sur mobile, contrairement au Dashboard/Settings/Accounting qui réduisent déjà leur padding à `1rem` sur petit écran. Résultat : sur un téléphone de 375px, il ne restait que ~311px de largeur utile pour tout le contenu (formulaires, cartes, tableaux) — c'est ce qui donne l'impression de contenu écrasé/mal centré.
**Correction :** nouvelle classe partagée `.app-page` (`index.css`) avec padding réduit à `1rem 0.875rem` sous 640px, appliquée aux 5 pages. Pour Dépôts (`.dep-page`, déjà une classe locale), ajout direct de la media query manquante.

### 3. Boutons "+ Ajouter" trop grands sur mobile (Pharmacy, Patients, Ordonnances, Rendez-vous, Paramètres)
**Problème :** le Dashboard réduit déjà la taille de ses boutons d'action (padding et police plus petits) sous 640px. Les boutons équivalents des autres pages ("Ajouter un médicament", "Ajouter un patient", "Nouvelle ordonnance", "Ajouter un RDV", "Nouveau Compte Collaborateur") gardaient leur taille desktop complète sur mobile, ce qui les fait paraître disproportionnés une fois isolés sur leur propre ligne (à cause du retour à la ligne du header).
**Correction :** nouvelle classe `.page-cta-btn` (`index.css`) qui réduit padding et taille de police sous 640px, reprenant exactement les valeurs déjà validées sur le Dashboard. Appliquée aux 5 boutons.

### 4. Couleur de la sidebar hors charte
**Problème :** fond navy-noir générique (`#0c131f`) sans lien avec l'identité teal/menthe du reste du site.
**Correction :** remplacé par `#162a26` (teal foncé déjà utilisé sur la landing page et Dépôts), plus ajustement des gris de texte et du fond de l'avatar en teinte teal cohérente.

### 5. Bouton "Se déconnecter" en rouge
**Problème :** couleur rouge (`--danger`) réservée aux actions destructives ailleurs dans l'app, utilisée ici pour une simple déconnexion.
**Correction :** remplacé par `btn btn-primary` (dégradé teal des actions principales).

## Vérifié — déjà correct, aucune correction nécessaire

- **Modales** (`.modal-content` / `.modal-grid`) : passent déjà en 1 colonne sous 640px sur toutes les pages (Pharmacy, Laboratory, Patients, Ordonnances, Settings, Appointments, PaymentCheckoutModal). Centrage géré par `.modal-backdrop` (flexbox `align-items/justify-content: center`), robuste à toute taille d'écran.
- **Tableaux** (Patients, Settings, Deposits, Accounting) : déjà dans un `.table-container` à défilement horizontal contrôlé — pattern volontaire pour les données tabulaires plutôt qu'un empilement de colonnes.
- **Formulaire de connexion** (`AuthPage`) : `.auth-right-panel` centre déjà la carte de formulaire (flex `center`/`center`), le panneau de marque gauche disparaît proprement sous 960px.
- **Onboarding** : conteneur racine déjà centré (`flex`, `align-items/justify-content: center`), stepper à 3 colonnes déjà dégradé en icônes seules sous 560px.
- **Landing page** : grilles (`landing-hero-grid`, `landing-stats-grid`, etc.) déjà gérées par media queries dédiées à 900px/500px.
- **Sidebar / Header / MobileQuickActionsBar** : bascule mobile déjà en place (`.sidebar`, `.main-content`, `.mobile-quick-actions` à 768px).
- **Appointments** : page déjà construite mobile-first (colonnes qui s'empilent sous 700px), aucune retouche nécessaire.
- **Textes qui débordent** : recherche ciblée (`white-space: nowrap` sans troncature, `overflow: hidden` sans ellipsis) sur tout le code — aucun cas trouvé sur du contenu dynamique (noms de patients, adresses) qui ne soit pas déjà protégé par un `textOverflow: ellipsis` ou un simple retour à la ligne naturel.

## Limite de cet audit

Fait uniquement par lecture de code (pas d'outil de capture d'écran/navigateur disponible ici). Les 5 corrections ci-dessus sont vérifiées par le calcul (largeurs, paddings, media queries) et le build (`tsc -b && vite build`) passe sans erreur, mais une vérification visuelle sur un vrai téléphone reste recommandée. Si un écran précis pose encore problème après ces correctifs, un screenshot permettra de cibler directement le fichier en cause.
