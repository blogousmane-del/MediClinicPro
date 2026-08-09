# Verrou d'abonnement expiré — conception

**Date :** 2026-08-09
**État :** approuvé par le propriétaire du produit, implémentation immédiate

## Problème

L'essai Starter dure 7 jours. Passé ce délai, l'application **prévient** mais ne
verrouille rien : `middleware/auth.js` refuse les écritures (`403
SUBSCRIPTION_EXPIRED`) et laisse passer toutes les lectures, tandis que le
frontend se contente d'une pastille dans le `Header`. Une clinique expirée
continue donc de consulter ses dossiers, ses stocks et ses ordonnances comme
avant, et ne rencontre le blocage qu'au moment d'enregistrer. Rien ne pousse à
payer.

Deux failles aggravent le constat :

1. **L'essai est renouvelable à l'infini.** `PUT /settings/plan` refuse le
   retour à Starter aux cliniques ayant déjà payé, mais une clinique Starter
   expirée qui n'a jamais payé peut recliquer « Starter » et se redonner 7
   jours. Le verrou serait contournable en un clic.
2. **Aucune règle d'expiration commune.** Le serveur compare des instants
   (`isClinicExpired()`), le frontend calcule des jours restants avec
   `Math.ceil` à deux endroits (`Header.tsx`, `SettingsPage.tsx`). Les deux
   peuvent afficher « expire dans 1 jour » pendant que le serveur refuse déjà.

## Objectif

À l'expiration — quelle que soit la date, essai gratuit comme plan payant non
renouvelé — les modules métier deviennent inaccessibles et cèdent la place à un
écran de paiement. La clinique doit payer pour retrouver son application.

## Décisions

| Sujet | Décision |
|---|---|
| Niveau de verrou | Écran de paiement **à la place** de la page. Aucune donnée métier visible. |
| Périmètre | Tout abonnement expiré : essai Starter terminé **et** plan payant non renouvelé. Même règle que `isClinicExpired()`. |
| Modules verrouillés | Patients, Rendez-vous, Ordonnances, Laboratoire, Pharmacie, Comptabilité, Dépôts de garantie. |
| Restent ouverts | Tableau de bord (sans chiffres), Paramètres, Profil, notifications, déconnexion. |
| Délai de grâce | **3 jours** après la date d'expiration : lecture seule (comportement actuel) + bandeau. Au-delà : verrou dur. |

### Pourquoi un délai de grâce

Sans lui, la coupure tombe à la seconde près. Un cabinet qui règle son
abonnement le lendemain perdrait l'accès à ses dossiers médicaux une matinée
entière, sans préavis autre qu'un email de rappel. Trois jours amortissent
l'accident sans rien retirer à la pression commerciale : pendant la grâce, plus
rien ne peut être créé ni modifié, et le bandeau est permanent.

### Ce que le verrou ne fait pas

Il ne coupe ni les notifications, ni Platform Admin, ni le tunnel de paiement.
La cloche continue donc de signaler « stock bas » alors que la Pharmacie est
verrouillée : c'est assumé, les notifications sont conçues pour survivre à une
suspension comme à une expiration.

## Architecture

### Source unique de vérité : le serveur

L'état de verrou est **calculé côté serveur et transmis au client**, jamais
recalculé par le frontend. C'est ce qui règle la divergence d'arrondi décrite
plus haut : le client affiche ce que le serveur a décidé.

`backend/utils/subscription.js` gagne `getSubscriptionState(clinic, now)` :

```js
{
  expired: boolean,      // date dépassée ou statut 'expired'
  locked: boolean,       // expiré ET délai de grâce écoulé
  expiresAt: string|null,
  graceEndsAt: string|null,  // expiresAt + 3 jours
  graceDaysLeft: number|null // 0..3, null si non expiré
}
```

`isClinicExpired()` reste exporté tel quel — `routes/platform.js` s'en sert pour
l'affichage cross-clinique et n'a pas à connaître la grâce.

### Application côté serveur

`middleware/auth.js` distingue désormais deux niveaux :

- **Expiré, dans la grâce** — comportement actuel inchangé : les écritures sont
  refusées (`403 SUBSCRIPTION_EXPIRED`), les lectures passent.
- **Verrouillé** — toute méthode, y compris `GET`, est refusée sur les domaines
  métier avec `403 SUBSCRIPTION_LOCKED`. Le code distinct permet au frontend de
  reconnaître le verrou sans deviner.

Domaines verrouillés : `/api/patients`, `/api/appointments`,
`/api/consultations`, `/api/pharmacy`, `/api/laboratory`, `/api/deposits`,
`/api/financials`.

Exemptions, dans cet ordre de priorité : `/api/financials/subscription` (le
tunnel de paiement, testé **avant** `/api/financials`), `/api/auth`,
`/api/settings`, `/api/notifications`, `/api/platform`. Les écritures restent
gouvernées par les règles existantes — `/api/settings/plan` et
`/api/auth/logout` gardent leur passe-droit.

`GET /auth/me` renvoie le bloc `subscription` calculé ci-dessus, à côté de
`user` et `clinic`.

### Fermeture de la boucle d'essais

`PUT /settings/plan` refuse Starter à une clinique qui est **déjà** en plan
Starter et dont l'abonnement est expiré : son essai est consommé. La garde
existante (historique de paiement) est conservée telle quelle. Aucune migration
n'est nécessaire — la condition se lit sur `clinics.plan` et
`clinics.subscription_expires_at`.

### Application côté client

`frontend/src/utils/subscription.ts` porte le type `SubscriptionState` et un
repli local de même règle, utilisé uniquement si `/auth/me` ne renvoie pas
encore le bloc (déploiement en cours, cache d'un onglet ouvert).

`AuthContext` expose `subscription` et le rafraîchit quand `api.ts` intercepte
un `403` portant `SUBSCRIPTION_LOCKED`, `SUBSCRIPTION_EXPIRED` ou
`ACCOUNT_SUSPENDED` : le verrou tombe en cours de session, à minuit comme au
retour d'une pause, sans rechargement.

`components/SubscriptionLockScreen.tsx` rend trois variantes :

- **admin** — cadenas, date de fin, les deux plans payants et leurs prix, bouton
  vers Paramètres > Abonnement, où vit déjà le tunnel Chariow. Rien n'est
  dupliqué.
- **non-admin** — même écran, sans bouton : « Prévenez l'administrateur de votre
  clinique ». `POST /financials/subscription/checkout` est en
  `checkRole(['admin'])` ; afficher un bouton que le serveur refusera serait une
  impasse. Un `manager` est traité comme un non-admin pour la même raison.
- **suspendu** — `ACCOUNT_SUSPENDED` : message d'appel au support, aucun plan
  affiché. Payer ne lève pas une suspension plateforme.

`App.tsx` teste le verrou **avant** la redirection d'onboarding : une clinique
jamais configurée et expirée tomberait sinon sur un formulaire dont
l'enregistrement est refusé, sans jamais voir les plans. L'écran remplace ensuite
le rendu de chaque onglet verrouillé, ce qui démonte les pages déjà visitées
(`visitedTabsRef` les garde montées) et coupe leurs requêtes.

`Sidebar` grise les entrées verrouillées et leur ajoute un cadenas ; le clic mène
à l'écran plutôt que de ne rien faire. `MobileQuickActionsBar` est désactivée.
`Dashboard` n'appelle plus `/financials/stats` ni `/appointments` quand le
verrou est actif et affiche l'invitation à la place de ses cartes. `Header` et
`SettingsPage` lisent l'état serveur au lieu de recalculer.

## Tests

`backend/tests/subscription-lock.test.js`, sur le **vrai** `middleware/auth.js` :

- un abonnement expiré depuis 1 jour laisse passer `GET /api/patients` et refuse
  `POST /api/patients` ;
- expiré depuis 5 jours, `GET /api/patients` répond `403 SUBSCRIPTION_LOCKED` ;
- verrouillé, `POST /api/financials/subscription/checkout` passe malgré le
  préfixe `/api/financials` — l'ordre des exemptions est vérifié, pas seulement
  commenté ;
- verrouillé, `GET /auth/me` et `/api/notifications` passent.

`backend/tests/plan-trial-reuse.test.js` : une clinique Starter expirée ne peut
pas réactiver Starter ; une clinique Starter encore en cours d'essai le peut.

## Conséquences opérationnelles

Relevé sur la base de production le 2026-08-09 :

- **6 cliniques sur 20 sont déjà expirées** (ids 2, 3, 4, 5 en plan hôpital ;
  10 et 11 en Starter). Elles franchiront le délai de grâce immédiatement et
  seront verrouillées dès le déploiement.
- **Aucun paiement d'abonnement n'a jamais abouti** — `subscription_payments`
  ne contient aucune ligne `paid`, alors que la configuration Chariow est
  complète (clé API chiffrée, huit produits mappés, secret de webhook). Le
  tunnel n'a donc jamais été éprouvé en production. Le risque a été signalé et
  assumé : le verrou est livré avant cette validation.
