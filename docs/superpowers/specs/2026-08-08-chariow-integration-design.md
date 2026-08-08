# Chariow — encaissement de l'abonnement MediClinic — Design

Date: 2026-08-08
Status: Approved by user, ready for implementation planning

## Contexte

`Chariow.md` (racine du repo) documente un checkout **hébergé** pour le Mobile
Money africain (Orange Money, Wave, MTN, Moov) qui encaisse aussi la **carte
bancaire**. Le présent document décide comment MediClinic l'intègre.

L'application encaisse aujourd'hui par trois chemins, tous documentés dans
`CLAUDE.md` § Payments :

| Référence | Table | Montant | Fournisseurs actuels |
|---|---|---|---|
| `sub-<id>` | `subscription_payments` | `PLANS[plan].price × months` | Bictorys, PayTech, PayPal |
| `pay-<id>` | `payments` | libre (saisi par le caissier) | Bictorys, PayTech |
| `dep-<id>` | `deposits` | libre | Bictorys, PayTech |

Bictorys, PayTech et PayPal sont configurés par **variables d'environnement** :
un seul compte marchand plateforme sert toutes les cliniques.

### La contrainte qui décide de tout

> « Chariow débite le prix DU PRODUIT configuré dans SA boutique — aucun montant
> custom via l'API. » (`Chariow.md` §3.1)

Un montant libre ne peut donc pas passer par Chariow. Les paiements patients et
les dépôts de garantie, tous deux à montant libre, sont hors de portée sans
refonte tarifaire. Seul l'abonnement a un nombre fini de montants : 2 plans
payants × 4 durées = **8 combinaisons**.

## Décisions

Prises avec l'utilisateur, dans cet ordre :

1. **Chariow devient l'unique moyen de payer l'abonnement MediClinic.**
2. **Les paiements patients et les dépôts de garantie repassent en espèces
   uniquement.** Aucun paiement patient en ligne, quel que soit le plan.
3. **Bictorys, PayTech et PayPal sont désactivés à l'initiation, mais leur code
   et leurs webhooks restent en place** — un paiement lancé avant le déploiement
   doit encore pouvoir se créditer.
4. **La configuration Chariow est éditable depuis Platform Admin**, clé API
   comprise, stockée chiffrée en base.
5. **Le crédit se fait par webhook déclencheur + pull, avec deux filets** :
   poll au retour navigateur et cron quotidien de rattrapage.

### Alternatives écartées

- **Un compte Chariow par clinique** (modèle « per-créateur » de `Chariow.md`) :
  aurait permis aux cliniques d'encaisser leurs patients à leurs propres tarifs.
  Écarté : table dédiée, chiffrement par clinique, résolution du compte à chaque
  checkout, webhook par clinique — hors de proportion avec le besoin actuel.
- **Un catalogue d'actes à prix fixe** pour les paiements patients : envisagé
  puis abandonné par l'utilisateur au profit du tout-espèces, qui évite
  d'imposer un tarif national unique à toutes les cliniques.
- **Webhook seul**, comme PayPal aujourd'hui : Chariow n'a pas de signature et
  sa doc cite un cas réel de vente réglée après expiration côté application. Un
  webhook perdu signifierait argent encaissé, abonnement jamais crédité.

## Périmètre et retraits

### Paiements patients et dépôts

`POST /api/financials/checkout` et `POST /api/deposits` refusent toute méthode
Mobile Money avec un message français explicite, quel que soit le plan de la
clinique. `PaymentCheckoutModal` est retiré de `AccountingPage` et de
`DepositsPage`.

`isPaymentMethodAllowed` (`backend/utils/plans.js`) devient sans objet pour ces
deux routes. La fonction est conservée — elle reste la description honnête de ce
que le plan autorise — mais les deux routes refusent le non-espèces avant même
de l'interroger.

### Fournisseurs existants

`initiateCheckoutWithFailover()` et `paypal.initiateCheckout()` ne sont plus
appelés par aucune route de checkout. Les routes `POST /api/webhooks/bictorys`,
`/paytech`, `/paypal` et `GET /api/webhooks/paypal/return` **restent montées et
fonctionnelles**, ainsi que `backend/tests/paypal-subscription.test.js`.

Un paiement déjà en vol se crédite donc normalement après le déploiement. Rien
n'est supprimé : le retour en arrière tient dans un revert.

### Textes commerciaux

Deux corrections distinctes, à ne pas confondre :

1. **Le plan Hôpital perd son argument « ajoute le Mobile Money
   (Wave/Orange Money/MTN) »**, qui décrivait l'encaissement patient, désormais
   supprimé. Cet avantage disparaît de `backend/utils/plans.js`, de
   `LandingPage.tsx` et des cartes de plans de `SettingsPage.tsx`. Le plan garde
   ses avantages réels : personnel illimité et tous les rôles.
2. **Les pages publiques annoncent les moyens de paiement de l'abonnement** —
   Mobile Money et carte bancaire, fournis par la page hébergée Chariow — pour
   rassurer le visiteur sur la façon dont il paiera.

Contrainte de véracité (règle repo, `CLAUDE.md` § Banani) : n'annoncer que les
opérateurs réellement activés sur la boutique Chariow de l'exploitant. À
vérifier dans le tableau de bord Chariow avant mise en ligne.

## Configuration

### Stockage

Aucune nouvelle table. Quatre clés s'ajoutent à `platform_settings`, qui existe
déjà en production :

| Clé | Contenu | Secret |
|---|---|---|
| `chariow_api_key_enc` | clé API, chiffrée | oui |
| `chariow_webhook_secret_enc` | secret d'URL du webhook, chiffré | oui |
| `chariow_products` | JSON `{"clinique_1":"prod_…", …}`, 8 entrées | non |
| `chariow_api_url` | base API, défaut `https://api.chariow.com/v1` | non |

`backend/utils/platformSettings.js` voit sa liste blanche `DEFAULTS` étendue à
ces quatre clés, et gagne la notion de valeur secrète : une clé secrète n'est
jamais renvoyée par `getSettings()`, seulement par un accesseur dédié réservé à
l'adaptateur.

### Chiffrement

Nouveau `backend/utils/secretBox.js`, AES-256-GCM via `node:crypto` — aucune
dépendance ajoutée. Format stocké : `v1:<iv b64>:<tag b64>:<chiffré b64>`, le
préfixe de version permettant une rotation future.

La clé maîtresse vient de `CONFIG_ENCRYPTION_KEY` (32 octets en hexadécimal).
**Un secret continue donc de vivre en variable d'environnement** : on déplace la
clé Chariow de l'environnement vers la base, on ne supprime pas le besoin d'un
secret racine. Variable absente ou malformée → l'écran affiche « chiffrement non
configuré » et l'enregistrement est refusé. Jamais de stockage en clair, jamais
de repli silencieux.

### Endpoints

`GET /api/platform/config` gagne un bloc `chariow` :

```jsonc
{
  "apiKey": "set",          // "set" | "blank" — jamais la valeur
  "webhookSecret": "set",
  "apiUrl": "https://api.chariow.com/v1",
  "products": { "clinique_1": "prod_…", … },   // non secret
  "encryptionConfigured": true
}
```

Noter l'absence d'`webhookUrl` complète : elle contient le secret, et `GET` n'en
renvoie jamais aucun. L'URL entière, secret inclus, est renvoyée **une seule
fois**, dans la réponse du `PUT` qui génère ou régénère ce secret — c'est le
moment où l'exploitant la copie dans le tableau de bord Chariow. Perdue, elle se
récupère en régénérant le secret, ce qui invalide l'ancienne : l'écran le dit
avant d'agir.

L'invariant existant — la réponse ne contient aucun secret, vérifié par un test
qui plante des secrets reconnaissables et échoue s'ils apparaissent — est étendu
aux secrets stockés en base.

`PUT /api/platform/config` accepte `chariow_api_key`, `chariow_webhook_secret`,
`chariow_products`, `chariow_api_url`. Validations :

- la clé API est vérifiée par un appel réel `GET /products` avant enregistrement
  (`Chariow.md` §9) — une clé fausse est rejetée tout de suite, pas au premier
  client qui paie ;
- ce même appel sert à contrôler que **la boutique est en XOF** (voir plus bas)
  et à proposer la liste des produits dans l'écran ;
- `chariow_products` doit être un objet dont les clés appartiennent aux huit
  combinaisons attendues et les valeurs sont des identifiants non vides ;
- le secret webhook est généré automatiquement s'il est absent.

Les mutations écrivent un `activity_logs` `PLATFORM_CONFIG_UPDATE` **sans jamais
consigner la valeur** d'un secret.

Les prix de plans et `SUPER_ADMIN_EMAILS` restent non modifiables, pour les
raisons déjà documentées dans `CLAUDE.md`.

## Adaptateur `backend/services/payments/chariow.js`

Interface, alignée sur les adaptateurs frères :

- `loadConfig()` — lit et déchiffre la configuration, avec un cache mémoire de
  60 s pour éviter un `SELECT` par requête ;
- `isConfigured()` — asynchrone, contrairement aux autres adaptateurs dont la
  configuration est en environnement ; la différence est explicite dans le code ;
- `createCheckout({ productId, email, firstName, lastName, phone, redirectUrl,
  metadata })` → `{ ok, saleId, checkoutUrl, amount: { value, currency } }` ;
- `getSale(saleId)` → `{ ok, status, amount, settledAt }` ;
- `mapChariowStatus(raw)` ;
- `resolveChariowPhone({ phone, phoneCountry, phoneLocal })` ;
- `listProducts()` — pour l'écran de configuration.

### Ordre de test des statuts

`mapChariowStatus` teste dans cet ordre, sans exception :

1. `unpaid` → `pending` ;
2. `failed`, `error` → `failed` ;
3. `cancel`, `abandon`, `refund` → `abandoned` ;
4. `settle`, `complete`, `paid`, `success` → `succeeded` ;
5. tout le reste → `pending`.

`unpaid` contient `paid` : l'ordre inverse créditerait une vente non payée
(`Chariow.md` §3.3). `settled` **est** un succès — l'oublier a déjà coûté une
vente non créditée chez l'auteur de la doc.

### Téléphone

`resolveChariowPhone` s'appuie sur `libphonenumber-js`, déjà dépendance du
backend, et renvoie `{ number: <national>, country_code: <ISO2> }`. Un E.164
brut dans `number` provoque un `400 Invalid phone number` — cause n°1 des échecs
de checkout selon la doc. Ordre des tentatives : `phoneCountry` + `phoneLocal`,
puis `phone` E.164, puis repli. Le front envoie les trois champs sans jamais
pré-nettoyer.

### Devise : XOF exclusivement

`Chariow.md` autorise des boutiques en USD ou EUR et interdit de figer la
devise. Cette intégration **refuse toute devise autre que XOF**, à
l'enregistrement de la configuration comme au checkout.

Justification : MediClinic facture en FCFA. Vérifier un montant dans une devise
étrangère exigerait un taux de change, avec exactement le piège d'exploitation
déjà documenté pour `XOF_TO_USD_RATE` — un taux modifié pendant qu'un paiement
est en vol fait échouer ce paiement, argent pris. Refuser est la direction sûre,
et le refus est bruyant, jamais silencieux.

Bénéfice direct : le montant renvoyé par Chariow est comparable tel quel à
`subscription_payments.amount`. **Aucune colonne à ajouter, aucune migration
manuelle** — ce qui, vu l'historique de dérive de schéma de ce repo, compte.

## Checkout abonnement

`POST /api/financials/subscription/checkout` conserve son URL. Le champ
`provider` disparaît du corps, qui devient :

```jsonc
{ "months": 12, "planId": "hopital",
  "phone": "+2250700000000", "phoneCountry": "CI", "phoneLocal": "0700000000" }
```

Déroulé :

1. validations existantes conservées — `months ∈ {1,3,6,12}`, plan payant,
   limite de personnel du plan cible vérifiée avant tout paiement ;
2. résolution du produit par la clé `<plan>_<months>` ; combinaison absente →
   **502 nommant explicitement la combinaison manquante**, pas un « paiement
   indisponible » opaque ;
3. insertion d'une ligne `subscription_payments` `pending`, `provider: 'chariow'` ;
4. `POST /checkout` chez Chariow ;
5. **contrôle du prix réellement débité** : `purchase.amount` doit être en XOF
   et ne pas s'écarter de plus de 2 % de `PLANS[plan].price × months`. Sinon la
   ligne passe `failed` et le checkout est refusé.
6. persistance de `provider_reference = purchase.id` et `checkout_url`, puis
   renvoi de l'URL au front.

Le contrôle de l'étape 5 est le garde-fou central de cette intégration : un
produit Chariow à 5 000 F mal rattaché à la clé `hopital_12` vendrait sinon
douze mois d'Hôpital au prix d'un, sans qu'aucun signal ne se déclenche.

`redirect_url` pointe vers le front (`${APP_URL}/?checkout=chariow&sub=<id>`) et
non vers l'API : contrairement à PayPal, aucune capture serveur n'est nécessaire.
`custom_metadata` porte `clinicId` et `subscriptionPaymentId`.

## Réconciliation

Nouveau `backend/services/payments/chariowReconcile.js`, une fonction publique
`reconcileChariowSubscription(subscriptionPaymentId)`, appelée par les trois
chemins de crédit. C'est la seule fonction qui crédite.

1. relire la ligne ; ne traiter que `provider = 'chariow'` et un statut
   `pending`, ou `failed` de moins de 14 jours ;
2. `GET /sales/{provider_reference}` — **source de vérité unique** ;
3. si le statut normalisé n'est pas `succeeded`, sortir sans rien écrire ;
4. revérifier le montant et la devise contre `amount` (tolérance 2 %) ;
5. `UPDATE … SET status='paid', paid_at=<date fournisseur> WHERE id=… AND
   provider='chariow' AND status IN ('pending','failed')` — écriture
   conditionnelle : deux chemins concurrents, un seul crédite ;
6. si la mise à jour a touché une ligne, créditer l'abonnement.

`paid_at` reçoit `settled_at`/`paid_at` du fournisseur, à défaut `created_at` de
la ligne — **jamais `new Date()`**. Un paiement rattrapé quatre jours plus tard
apparaîtrait sinon dans les recettes du mauvais jour (`Chariow.md` §11 piège 3).

Le rattrapage des `failed` est borné à 14 jours **et** aux lignes
`provider = 'chariow'` : jamais de résurrection d'un échec Bictorys.

### Endpoint de vérification

`POST /api/financials/subscription/verify`, authentifié, réservé au rôle `admin`,
prend `{ subscriptionPaymentId }` et appelle la même fonction de réconciliation
après avoir vérifié que la ligne appartient bien à la clinique de l'appelant.
Renvoie `{ status: 'paid' | 'pending' | 'failed' }`. C'est ce que la page de
retour interroge.

Cette route est exemptée du blocage en écriture des abonnements expirés dans
`middleware/auth.js`, au même titre que `/financials/subscription` : une clinique
dont l'abonnement vient d'expirer doit pouvoir faire constater son paiement.

### Refactor nécessaire

L'extension d'échéance et la bascule de plan sont aujourd'hui enfermées dans
`fulfillSubscriptionEvent` (`backend/routes/webhooks.js:67`), qui code en dur
`paid_at: new Date()`. Cette logique est extraite dans un helper partagé prenant
la date de paiement en paramètre. L'appelant existant continue de passer
`new Date()` : aucun changement de comportement pour Bictorys, PayTech et PayPal.

## Webhook, cron, front

### Webhook

`POST /api/webhooks/chariow?secret=…`, monté avec les autres webhooks, hors
`auth`. Chariow n'a pas de signature (`Chariow.md` §7) : le secret de l'URL est
comparé en **temps constant** au secret déchiffré, 401 si différent.

**Le corps ne sert qu'à extraire un identifiant de vente** — jamais un montant,
jamais un statut. La route déclenche la réconciliation, qui re-pull le statut.
Réponse 200 même sur un événement inconnu, pour ne pas provoquer de rejeux.
Déduplication par `payment_webhook_events` (`UNIQUE(provider, event_hash)`),
comme les autres fournisseurs.

Événements de succès reconnus : `successful.sale`, `settled.sale`,
`completed.sale`.

### Cron

`GET /api/cron/reconcile-chariow`, protégé par `CRON_SECRET`, plus une entrée
quotidienne dans `vercel.json`. Reprend les `pending` et les `failed` de moins
de 14 jours.

Cadence quotidienne assumée : les crons Vercel du plan Hobby ne descendent pas
sous la journée, et les deux autres chemins créditent en secondes. Le cron est
un filet, pas le mécanisme principal.

### Front

L'onglet Abonnement de `frontend/src/pages/Settings/SettingsPage.tsx` perd les
boutons Mobile Money et PayPal au profit d'un formulaire unique : plan, durée,
téléphone via le `PhoneInput` existant — qui envoie bien `phone`, `phoneCountry`
et `phoneLocal`.

Au retour (`?checkout=chariow&sub=<id>`), la page interroge
`POST /api/financials/subscription/verify` toutes les 3 s pendant 45 s. Trois
états : abonnement activé, « paiement en cours de validation, vous recevrez la
confirmation » (le cron finalisera), ou échec. **Un échec n'est jamais déduit
d'un paramètre d'URL** — seul le serveur tranche.

Platform Admin gagne un onglet Chariow dans Config. système : clé API, huit
produits (liste déroulante alimentée par `GET /products`), secret webhook et URL
complète prête à copier dans le tableau de bord Chariow.

## Tests

Même dispositif que `backend/tests/paypal-subscription.test.js` : routes réelles
montées sur un Express jetable, seuls `database.js`, le réseau Chariow et
`middleware/auth.js` sont remplacés via le cache `require`.

| Cas | Ce qu'il protège |
|---|---|
| `unpaid` → `pending`, `settled` → `succeeded` | l'ordre de test des statuts |
| corps de webhook annonçant « paid » alors que `GET /sales` répond « unpaid » → aucun crédit | la règle « le corps ne fait jamais foi » |
| secret d'URL faux → 401 | l'authentification du webhook |
| `paid_at` = date fournisseur, pas l'heure du test | la datation des rattrapages |
| produit dont le prix diverge de plus de 2 % → checkout refusé | le garde-fou de prix |
| `GET /platform/config` ne contient aucun secret, y compris lus en base | l'invariant de non-divulgation |

## Prérequis d'exploitation

Rien ne fonctionne tant que ces trois points ne sont pas faits, à la main :

1. **Huit produits créés dans la boutique Chariow**, en XOF, aux prix exacts de
   `PLANS` × durée : Clinique 9 000 / 27 000 / 54 000 / 108 000 FCFA et Hôpital
   14 500 / 43 500 / 87 000 / 174 000 FCFA.
2. **`CONFIG_ENCRYPTION_KEY` définie** — dans les Project Settings Vercel en
   production, jamais dans `backend/.env`, qui n'y est pas lu.
3. **URL de webhook collée dans le tableau de bord Chariow**, telle que fournie
   par l'écran de configuration.

## Risques connus

| Risque | Traitement |
|---|---|
| Prix d'un produit Chariow modifié après coup dans la boutique | Contrôle de prix à chaque checkout : un écart supérieur à 2 % refuse le paiement au lieu de le laisser passer |
| Webhook perdu ou secret mal collé | Poll au retour navigateur, puis cron quotidien ; les `failed` restent rattrapables 14 jours |
| `CONFIG_ENCRYPTION_KEY` perdue ou changée | Les secrets stockés deviennent indéchiffrables : l'écran signale « clé illisible » et l'exploitant ressaisit la clé API. Aucun crédit erroné possible entre-temps |
| Boutique Chariow en USD | Refusée à l'enregistrement, message explicite |
| Cliniques attendant l'encaissement patient en ligne | Décision produit assumée ; à communiquer avant déploiement |
