# Platform Admin — passe de parité pixel — Banani → MediClinic

## Source
- Banani screen ID : `uh1OcdtphSFV/screens/new_screen9.jsx` ("Administration — Super Admin", desktop)
- Récupéré : 2026-08-09 (re-fetch explicite par `screenIds`, la sélection courante de l'utilisateur pointait encore sur `new_screen11.jsx`)
- Portée demandée par l'utilisateur : **toute la console** (9 sections)

## Contrainte structurante
Banani n'a **qu'un seul écran** pour Platform Admin. Les 8 autres sections
(Cliniques, Utilisateurs, Abonnements, Support, Notifications, Rapports,
Sécurité, Config. système) n'ont aucune maquette. Constat déjà posé le
2026-07-27 (`platform-admin.md` §2026-07-27) : décision retenue à l'époque,
appliquer le système de design Banani à l'ensemble plutôt que d'attendre des
maquettes dédiées. Cette passe reconduit la même règle.

Conséquence : « pixel-parfait » n'a de sens littéral que pour **Vue d'ensemble**.
Pour les 8 autres, l'objectif est la cohérence de tokens/espacements/typographie,
déjà largement en place.

## Diff Vue d'ensemble — Banani vs livré

| Élément Banani | État actuel | Verdict |
|---|---|---|
| Barre latérale sombre, 8 entrées | 9 entrées (+ Notifications), tokens exacts | Conforme, Notifications en plus |
| Bandeau haut : titre + sous-titre | Titre seul, pas de sous-titre | **Écart** |
| Bandeau haut : recherche clinique | Recherche par section, pas dans le bandeau | Écart mineur |
| Bandeau haut : bouton « Nouvelle clinique » | Absent | **Affordance sans backend** — voir Q1 |
| Bandeau haut : cloche + pastille « 3 » | Absente | **Donnée fabriquée** — voir Q2 |
| 4 cartes de stats + icône encadrée | 4 cartes, icône encadrée | Conforme |
| Ligne de variation (« +3 ce mois », « +8 % ») | Absente | **Écart, calculable pour de vrai** — voir Q3 |
| Jeu de cartes : Actives / Utilisateurs / Revenu / Tickets | Actives / **Expirées** / Utilisateurs / Revenu | Divergence — voir Q4 |
| Tableau cliniques + sous-titre région | Présent (`address`) | Conforme |
| Colonne « Actions » (œil / crayon / points) | Absente ici ; « Gérer » existe dans l'onglet Cliniques | **Écart** |
| Panneau « Tickets en cours » + pastille urgents | Présent, sans pastille urgents | Écart mineur |
| Panneau « Santé du système » (4 lignes) | Placeholder « bientôt disponible » | **Écart, 3 lignes/4 réelles** — voir Q5 |
| Journal d'activité récent | Présent | Conforme |
| Panneau « Abonnements arrivant à expiration » | Présent | **Ajout maison**, absent de Banani — à conserver |

## Ce qui est réellement constructible (données existantes)

- **Variations mensuelles** : `clinics.created_at`, `users.created_at`,
  `subscription_payments.paid_at` permettent « +N ce mois » et un pourcentage
  d'évolution du revenu mois/mois. Aucune migration.
- **Santé du système** : `GET /api/platform/config` rapporte déjà la
  connectivité Supabase, le canal e-mail effectif (Resend / SMTP / console) et
  le fait que la limitation de débit tourne sur Upstash ou sur le repli mémoire.
  Trois lignes réelles. La quatrième de Banani (« Sauvegardes ») n'a **aucun**
  backing dans ce dépôt — à retirer, pas à simuler.
- **Pastille « N urgents »** : `support_tickets` n'a pas de colonne `priority`.
  Soit on compte les tickets ouverts (réel), soit on retire la pastille.

## Ce qui est fabriqué chez Banani et doit être écarté ou réel

Rappel de la règle projet (CLAUDE.md, section Banani) : ne jamais introduire de
statistique, témoignage ou affordance inventés. Précédents déjà appliqués ici :
« Tickets support » et « Santé du système » avaient été supprimés au premier
import pour cette raison exacte, et les paliers tarifaires fictifs aussi.

1. Bouton « Nouvelle clinique » — aucune route de création de clinique côté
   opérateur ; les cliniques s'inscrivent seules via `POST /auth/register`.
2. Pastille cloche « 3 » — aucun compteur de notifications au niveau opérateur.
3. « Sauvegardes : Opérationnel » — aucune visibilité sur les sauvegardes
   Supabase depuis l'application.
4. Toutes les valeurs de la maquette (48 cliniques, 2,4M FCFA, tickets T-081…)
   sont des remplissages : seule la structure est à reprendre.

## Plan responsive
Banani ne fournit que le desktop. Le mobile existe déjà : bande de navigation
horizontale scrollable sous 900px, ajoutée le 2026-07-27 et vérifiée au
navigateur. Les ajouts de cette passe doivent la respecter :
- **375px** : cartes de stats en pile, ligne de variation conservée, tableau en
  défilement horizontal dans son conteneur, panneau droit sous le tableau.
- **768px** : stats en 2 colonnes.
- **≥1024px** : 4 colonnes de stats, tableau + colonne droite 288px côte à côte,
  soit la maquette Banani.

## Décisions de l'utilisateur (2026-08-09, avant tout code)
1. **Bouton « Nouvelle clinique » : construire la route pour de vrai.** D'où
   `POST /api/platform/clinics`. La cloche reste écartée.
2. **Cartes de stats : coller à Banani.** Actives / Utilisateurs / Revenu /
   Tickets. « Cliniques expirées » quitte cette rangée ; l'information reste
   dans l'onglet Cliniques, où chaque ligne porte son statut.
3. **Santé du système : construire les 3 lignes réelles** + la limitation de
   débit. « Sauvegardes » n'est pas repris.

## Livré

### Backend
- `GET /api/platform/overview` — quatre champs de plus dans `stats` :
  `clinicsNewThisMonth`, `usersNewThisMonth`, `lastMonthRevenue`,
  `revenueDeltaPct`. Le pourcentage vaut `null` quand le mois précédent n'a
  rien encaissé — une variation à partir de zéro n'existe pas, et l'interface
  bascule alors sur une phrase au lieu d'un chiffre.
- `POST /api/platform/clinics` (nouveau) — crée la clinique et son
  administrateur. Reprend les règles de `POST /auth/register` sans exception :
  `validatePassword`, téléphone normalisé, email en minuscules, plan `starter`
  écrit explicitement, durée d'essai lue dans `platform_settings`. Téléphone
  facultatif ici, seule différence assumée. Suppression de rattrapage de la
  clinique si l'insertion de l'admin échoue — PostgREST n'a pas de transaction,
  et une clinique sans compte serait invisible et inadministrable.
- `backend/tests/platform-clinic-create.test.js` — 12 tests : plan starter et
  non le défaut `hopital` de la colonne, mot de passe jamais en clair ni dans
  la réponse, règle de longueur, normalisation d'email, unicité insensible à la
  casse, refus sans écriture partielle, journalisation contre la clinique créée
  au nom du super admin.

### Frontend (`PlatformAdminPage.tsx`)
- Cartes de stats refaites : valeur et unité séparées comme dans la maquette,
  ligne de variation sous chaque carte.
- `SystemHealthPanel` (nouveau composant) — lit `GET /api/platform/config`,
  avec ses états de chargement et d'échec. Le mode e-mail `console` s'affiche
  « Dégradé — journal console », ce qu'il est réellement : aucun message ne
  part. Idem pour la limitation de débit en repli mémoire.
- Bandeau haut : sous-titre daté + bouton « Nouvelle clinique ». Recherche et
  cloche de la maquette écartées (recherche déjà présente par section, compteur
  sans source) — même arbitrage que sur le TopBar clinique, voir `STATUS.md`.
- `NewClinicForm` (nouveau composant) — grille auto-fit, une colonne à 375px.
  Rendu hors du bloc conditionnel de chargement : créer une clinique ne doit
  pas dépendre de la réussite de `GET /overview`.
- Lien « Voir toutes (n) → » dans l'en-tête du tableau, affiché seulement
  au-delà de 5 cliniques.

### Trois défauts de mise en page corrigés en chemin
1. Panneau santé : pastille détachée de son texte quand le statut passait à la
   ligne (`alignItems: center` sur une ligne à hauteur variable).
2. Tickets en cours : sujet et clinique côte à côte se coupaient tous les deux
   en deux lignes dans la colonne étroite. Empilés, comme dans la maquette.
3. Journal d'activité : `flexShrink: 0` sur le nom de clinique poussait le
   libellé hors de la carte, coupé net et sans défilement pour aller le lire.
   Visible à 375px sur toute clinique au nom long. Préexistant à cette passe.

## Non fait, et pourquoi
- **Colonne « Actions » (œil / crayon / points) du tableau Banani.** Trois
  icônes menant au même endroit sont une fausse variété ; la gestion par
  clinique vit dans l'onglet Cliniques, atteint par « Voir toutes → ».
- **Les 8 autres sections.** Aucune maquette Banani n'existe pour elles. Le
  système de design leur est déjà appliqué depuis le 2026-07-27.

## Vérification effectuée (2026-08-09)
- `npm test` : **190 tests, 0 échec** (178 avant, +12 sur la nouvelle route).
- `tsc -b` et `npm run lint` : aucune alerte sur `PlatformAdminPage.tsx`.
- `npm run build` propre.
- Captures Playwright à **375 / 768 / 1280px**, vue d'ensemble et formulaire
  ouvert. Méthode : routes `/api/**` interceptées et servies depuis des
  fixtures — le composant React rendu est le vrai, et **aucune requête n'a
  touché la base de production**. Fixtures choisies pour montrer les cas
  dégradés (e-mail console, limitation en mémoire) plutôt que le cas nominal.
- Aucune valeur affichée qui ne provienne d'une réponse serveur.
