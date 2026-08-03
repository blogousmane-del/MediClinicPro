# PayPal — renouvellement d'abonnement — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à une clinique de payer son abonnement MediClinic (Clinique/Hôpital) par PayPal, en alternative explicite au Mobile Money.

**Architecture:** Nouvel adaptateur `backend/services/payments/paypal.js` respectant le même contrat que `bictorys.js`/`paytech.js` (`isConfigured` / `initiateCheckout` / `verifyWebhookSignature` / `parseEvent`). `POST /financials/subscription/checkout` gagne un champ `provider` qui aiguille vers PayPal **sans failover**. Le webhook réutilise `isDuplicateEvent` et `fulfillEvent` sans les modifier — seul `amountMatches` gagne une branche PayPal pour la conversion FCFA→USD.

**Tech Stack:** Node 18+ (`fetch` natif), Express, Supabase JS, React 19 + TypeScript. Aucune nouvelle dépendance npm — l'API REST PayPal s'appelle en `fetch`, pas via le SDK.

**Spec source:** [`docs/superpowers/specs/2026-07-27-paypal-subscription-design.md`](../specs/2026-07-27-paypal-subscription-design.md)

## Global Constraints

- Toutes les chaînes visibles par l'utilisateur sont en **français**.
- Multi-tenancy : toute requête Supabase dans une route authentifiée filtre `.eq('clinic_id', req.user.clinicId)`. Les routes webhook sont la seule exception (server-to-server, résolues par référence `sub-<id>`).
- Pas de suite de tests automatisée dans ce dépôt. Vérification = `node --check` sur chaque fichier backend touché, `npm run build` côté frontend, puis exercice manuel de l'endpoint.
- Aucun prix ni limite en dur : tout vient de `backend/utils/plans.js`.
- PayPal ne règle pas en XOF. Conversion FCFA→USD par taux fixe `XOF_TO_USD_RATE`, jamais par API de change.
- Aucun montant n'est crédité sans webhook signé confirmé. La route de retour navigateur ne remplit rien.
- Ne jamais écrire de secret réel dans un fichier suivi par git.
- Périmètre : abonnements uniquement. Les paiements patients (`payments`) et les dépôts (`deposits`) ne sont pas touchés.

---

### Task 1: Sécuriser les identifiants PayPal et poser la configuration

`backend/.env.example` est suivi par git et contient actuellement de vrais identifiants PayPal, plus une faute de frappe (`AYPAL_CLIENT_ID`). Cette tâche les sort du fichier suivi avant toute autre chose.

**Files:**
- Modify: `backend/.env.example:48-58`
- Modify: `backend/.env` (non suivi par git — créer les clés si absent)

**Interfaces:**
- Consumes: rien.
- Produces: les variables d'environnement `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_WEBHOOK_ID`, `XOF_TO_USD_RATE`, lues par la Task 2.

- [ ] **Step 1: Copier les vraies valeurs vers `backend/.env`**

Ouvrir `backend/.env.example`, relever les trois valeurs actuellement présentes aux lignes 50-52, et les écrire dans `backend/.env` (fichier non suivi) sous ces noms exacts :

```
PAYPAL_CLIENT_ID=<valeur reprise de la ligne AYPAL_CLIENT_ID>
PAYPAL_CLIENT_SECRET=<valeur reprise de la ligne PAYPAL_CLIENT_SECRET>
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=<valeur reprise de la ligne PAYPAL_WEBHOOK_ID>
XOF_TO_USD_RATE=600
```

- [ ] **Step 2: Vérifier que `backend/.env` est bien ignoré par git**

Run: `git check-ignore -v backend/.env`
Expected: une ligne citant `.gitignore` et le motif qui l'exclut. Si la commande ne renvoie rien, **arrêter** : ajouter `backend/.env` à `.gitignore` avant de continuer.

- [ ] **Step 3: Remplacer le bloc dans `backend/.env.example` par des placeholders vides**

Remplacer intégralement les lignes 48-52 de `backend/.env.example` (le bloc contenant `AYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) par :

```
# PayPal — paiement d'abonnement MediClinic uniquement (Optional).
# Identifiants créés sur https://developer.paypal.com > Apps & Credentials.
# PAYPAL_WEBHOOK_ID vient du webhook déclaré dans cette même app.
# Laisser vide désactive proprement le bouton PayPal (le Mobile Money continue).
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox
PAYPAL_WEBHOOK_ID=
# PayPal ne règle pas en FCFA : taux de conversion fixe FCFA -> USD.
# 600 signifie 1 USD = 600 FCFA.
XOF_TO_USD_RATE=600
```

- [ ] **Step 4: Vérifier qu'aucun secret ne subsiste dans un fichier suivi**

Run: `git diff backend/.env.example`
Expected: le diff montre uniquement des clés vides. Aucune chaîne commençant par `EB6` ou `BAA` ne doit apparaître dans la version modifiée.

- [ ] **Step 5: Révoquer et régénérer le secret côté PayPal**

Sur `developer.paypal.com` > Apps & Credentials > l'app concernée : cliquer sur le secret existant, le supprimer, en générer un nouveau, et reporter la nouvelle valeur dans `backend/.env`. Le secret précédent a séjourné dans un fichier suivi par git — le traiter comme compromis même s'il n'a jamais été commité.

- [ ] **Step 6: Commit**

```bash
git add backend/.env.example
git commit -m "chore(config): remove real PayPal credentials from tracked env example"
```

---

### Task 2: Adaptateur PayPal (`backend/services/payments/paypal.js`)

**Files:**
- Create: `backend/services/payments/paypal.js`

**Interfaces:**
- Consumes: les variables d'environnement de la Task 1.
- Produces:
  - `isConfigured(): boolean`
  - `xofToUsd(amountXof: number): number | null`
  - `initiateCheckout(params): Promise<{ok: true, providerReference: string, checkoutUrl: string, status: 'pending'} | {ok: false, error: string}>` — `params` = `{ amount, description, reference, returnUrl, cancelUrl, customerEmail?, customerName? }`
  - `captureOrder(orderId: string): Promise<{ok: boolean, status?: string, error?: string}>`
  - `verifyWebhookSignature(req, rawBody): Promise<{ok: boolean, error?: string}>` — **asynchrone**, contrairement à celle de `bictorys.js`
  - `parseEvent(body): {providerReference, status, reportedAmount, reportedCurrency, paymentReference} | null`

- [ ] **Step 1: Créer le fichier avec la configuration, la conversion et le jeton OAuth**

Créer `backend/services/payments/paypal.js` :

```js
// PayPal Orders v2 adapter — abonnements MediClinic uniquement (ni paiements
// patients, ni dépôts). PayPal ne règle pas en XOF : les montants sont
// convertis FCFA -> USD à un taux fixe configuré par l'exploitant
// (XOF_TO_USD_RATE), pas via une API de change en direct.
// https://developer.paypal.com/docs/api/orders/v2/
const API_LIVE = 'https://api-m.paypal.com';
const API_SANDBOX = 'https://api-m.sandbox.paypal.com';
const FETCH_TIMEOUT_MS = 15_000;
const TOKEN_EXPIRY_MARGIN_MS = 60_000; // renouvelle 1 min avant l'expiration réelle

let cachedToken = null; // { value: string, expiresAt: number }

function isConfigured() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

function apiUrl() {
  return (process.env.PAYPAL_MODE || 'sandbox') === 'live' ? API_LIVE : API_SANDBOX;
}

/**
 * Convertit un montant FCFA en USD au taux fixe configuré.
 * Renvoie null si le taux est absent/invalide — l'appelant doit alors
 * échouer proprement plutôt que d'envoyer un montant faux à PayPal.
 * @param {number} amountXof
 * @returns {number|null} montant USD arrondi à 2 décimales (exigé par PayPal)
 */
function xofToUsd(amountXof) {
  const rate = parseFloat(process.env.XOF_TO_USD_RATE || '');
  if (!rate || rate <= 0 || !Number.isFinite(rate)) return null;
  const usd = Math.round((amountXof / rate) * 100) / 100;
  return usd > 0 ? usd : null;
}

async function paypalFetch(path, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${apiUrl()}${path}`, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Jeton OAuth2 client_credentials, mis en cache mémoire jusqu'à expiration
 * (sinon un aller-retour OAuth complet par paiement).
 * @returns {Promise<{ok: true, token: string} | {ok: false, error: string}>}
 */
async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.value };
  }

  const basic = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  let res;
  try {
    res = await paypalFetch('/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  if (!res.ok || !data.access_token) {
    return { ok: false, error: `PayPal OAuth a échoué (${res.status}): ${data.error_description || data.error || 'raison inconnue'}` };
  }

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000 - TOKEN_EXPIRY_MARGIN_MS
  };
  return { ok: true, token: data.access_token };
}
```

- [ ] **Step 2: Vérifier la syntaxe**

Run: `node --check backend/services/payments/paypal.js`
Expected: aucune sortie (succès).

- [ ] **Step 3: Ajouter `initiateCheckout` et `captureOrder`**

Ajouter à la suite, dans le même fichier :

```js
/**
 * Crée une commande PayPal (intent CAPTURE) et renvoie le lien d'approbation.
 * `reference` est notre référence maison ("sub-12") : elle est posée à la fois
 * en reference_id ET en custom_id, car seul custom_id est repropagé dans la
 * ressource capture reçue par webhook.
 * @param {object} params
 * @param {number} params.amount - montant en FCFA (entier)
 * @param {string} params.description
 * @param {string} params.reference
 * @param {string} params.returnUrl
 * @param {string} params.cancelUrl
 * @param {string} [params.customerEmail]
 * @param {string} [params.customerName]
 */
async function initiateCheckout(params) {
  if (!isConfigured()) {
    return { ok: false, error: 'not_configured' };
  }

  const amountUsd = xofToUsd(params.amount);
  if (amountUsd === null) {
    return { ok: false, error: 'PayPal: taux de conversion XOF_TO_USD_RATE absent ou invalide.' };
  }

  const auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  const body = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: params.reference,
        custom_id: params.reference,
        description: (params.description || 'Abonnement MediClinic').slice(0, 127),
        amount: { currency_code: 'USD', value: amountUsd.toFixed(2) }
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'MediClinic Pro',
          locale: 'fr-FR',
          user_action: 'PAY_NOW',
          return_url: params.returnUrl,
          cancel_url: params.cancelUrl
        }
      }
    }
  };

  let res;
  try {
    res = await paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  if (!res.ok || !data.id) {
    return { ok: false, error: `PayPal a refusé la commande (${res.status}): ${data.message || 'raison inconnue'}` };
  }

  const approveLink = (data.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!approveLink || !approveLink.href) {
    return { ok: false, error: "PayPal: réponse sans lien d'approbation." };
  }

  return { ok: true, providerReference: data.id, checkoutUrl: approveLink.href, status: 'pending' };
}

/**
 * Capture une commande déjà approuvée par l'acheteur. Idempotent côté PayPal :
 * recapturer une commande déjà capturée renvoie son statut, sans double débit.
 * @param {string} orderId
 */
async function captureOrder(orderId) {
  if (!isConfigured()) return { ok: false, error: 'not_configured' };

  const auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  let res;
  try {
    res = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  // ORDER_ALREADY_CAPTURED = le webhook ou un rechargement de page a déjà fait
  // le travail. Ce n'est pas une erreur pour nous.
  const alreadyCaptured =
    data.name === 'UNPROCESSABLE_ENTITY' &&
    (data.details || []).some((d) => d.issue === 'ORDER_ALREADY_CAPTURED');

  if (!res.ok && !alreadyCaptured) {
    return { ok: false, error: `PayPal capture a échoué (${res.status}): ${data.message || 'raison inconnue'}` };
  }

  return { ok: true, status: data.status || 'COMPLETED' };
}
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `node --check backend/services/payments/paypal.js`
Expected: aucune sortie.

- [ ] **Step 5: Ajouter `verifyWebhookSignature`, `parseEvent` et les exports**

Ajouter à la suite, dans le même fichier :

```js
/**
 * Vérifie la signature d'un webhook via l'API PayPal Verify Webhook Signature.
 * Asynchrone (appel réseau) — contrairement à l'équivalent Bictorys/PayTech qui
 * calcule un HMAC localement. L'appelant doit `await`.
 * @param {import('express').Request} req
 * @param {Buffer} rawBody
 */
async function verifyWebhookSignature(req, rawBody) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return { ok: false, error: 'PAYPAL_WEBHOOK_ID non configuré' };

  const transmissionId = req.headers['paypal-transmission-id'];
  const transmissionTime = req.headers['paypal-transmission-time'];
  const transmissionSig = req.headers['paypal-transmission-sig'];
  const certUrl = req.headers['paypal-cert-url'];
  const authAlgo = req.headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    return { ok: false, error: 'PayPal: en-têtes de signature manquants' };
  }

  // PayPal n'accepte pas le cert-url de n'importe quel domaine : refuser tout ce
  // qui ne vient pas de paypal.com évite de suivre une URL fournie par un tiers.
  let certHost;
  try {
    certHost = new URL(String(certUrl)).hostname;
  } catch {
    return { ok: false, error: 'PayPal: paypal-cert-url illisible' };
  }
  if (certHost !== 'api.paypal.com' && !certHost.endsWith('.paypal.com')) {
    return { ok: false, error: 'PayPal: paypal-cert-url hors domaine paypal.com' };
  }

  let webhookEvent;
  try {
    webhookEvent = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return { ok: false, error: 'PayPal: corps de requête illisible' };
  }

  const auth = await getAccessToken();
  if (!auth.ok) return { ok: false, error: auth.error };

  let res;
  try {
    res = await paypalFetch('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent
      })
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayPal: ${err.message}` };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `PayPal a répondu ${res.status} (réponse non JSON)` };
  }

  if (data.verification_status !== 'SUCCESS') {
    return { ok: false, error: `PayPal: signature webhook invalide (${data.verification_status || res.status})` };
  }

  return { ok: true };
}

/**
 * Normalise un événement PayPal vers la forme attendue par fulfillEvent().
 * reportedAmount est en USD — c'est amountMatches() qui gère la comparaison
 * avec le montant FCFA stocké en base.
 */
function parseEvent(body) {
  if (!body || !body.resource) return null;

  const resource = body.resource;
  const eventType = String(body.event_type || '');
  const reference =
    resource.custom_id ||
    resource.invoice_id ||
    (resource.purchase_units && resource.purchase_units[0] && resource.purchase_units[0].custom_id);

  if (!reference) return null;

  const rawAmount = resource.amount && resource.amount.value;
  const amount = rawAmount === undefined || rawAmount === null ? undefined : parseFloat(rawAmount);
  const currency = (resource.amount && resource.amount.currency_code) || undefined;

  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    return {
      providerReference: resource.id,
      status: 'completed',
      reportedAmount: amount,
      reportedCurrency: currency,
      paymentReference: reference
    };
  }

  if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
    return {
      providerReference: resource.id,
      status: 'failed',
      failureReason: eventType,
      reportedAmount: amount,
      reportedCurrency: currency,
      paymentReference: reference
    };
  }

  return null; // pending/en attente/autres types -> ignoré
}

module.exports = {
  isConfigured,
  xofToUsd,
  getAccessToken,
  initiateCheckout,
  captureOrder,
  verifyWebhookSignature,
  parseEvent
};
```

- [ ] **Step 6: Vérifier la syntaxe et la conversion**

Run:
```bash
node --check backend/services/payments/paypal.js
node -e "process.env.XOF_TO_USD_RATE='600'; const p=require('./backend/services/payments/paypal'); console.log(p.xofToUsd(14500), p.xofToUsd(9000*12));"
```
Expected: `24.17 180`

- [ ] **Step 7: Vérifier l'authentification réelle contre le sandbox**

Avec `backend/.env` rempli (Task 1) :

Run:
```bash
node -e "require('dotenv').config({path:'./backend/.env'}); require('./backend/services/payments/paypal').getAccessToken().then(r=>console.log(r.ok ? 'TOKEN OK' : r.error));"
```
Expected: `TOKEN OK`. Si la sortie est `PayPal OAuth a échoué (401)`, les identifiants ou `PAYPAL_MODE` ne correspondent pas (une clé sandbox contre l'URL live échoue en 401).

- [ ] **Step 8: Commit**

```bash
git add backend/services/payments/paypal.js
git commit -m "feat(payments): add PayPal Orders v2 adapter for subscription checkout"
```

---

### Task 3: Aiguillage `provider` dans `POST /financials/subscription/checkout`

**Files:**
- Modify: `backend/routes/financials.js:6` (imports), `backend/routes/financials.js:305-420` (la route)

**Interfaces:**
- Consumes: `paypal.isConfigured()`, `paypal.initiateCheckout()` (Task 2).
- Produces: l'endpoint accepte `{ provider?: 'mobile_money' | 'paypal' }` dans le corps et renvoie `{ success, subscriptionPaymentId, checkoutUrl, provider }` — forme de réponse inchangée.

- [ ] **Step 1: Importer l'adaptateur**

Dans `backend/routes/financials.js`, juste après la ligne 6 (`const { initiateCheckoutWithFailover } = require('../services/payments');`), ajouter :

```js
const paypal = require('../services/payments/paypal');
```

- [ ] **Step 2: Lire le champ `provider` en début de route**

Ligne 307, remplacer :

```js
    const { months, phoneNumber, planId } = req.body;
```

par :

```js
    const { months, phoneNumber, planId, provider } = req.body;
    // PayPal est une alternative explicite, pas un maillon de la chaîne de
    // failover Bictorys->PayTech : l'admin choisit, aucun repli automatique.
    const useProvider = provider === 'paypal' ? 'paypal' : 'mobile_money';
```

- [ ] **Step 3: Remplacer l'appel de checkout par l'aiguillage**

Lignes 381-394, remplacer le bloc `const checkout = await initiateCheckoutWithFailover(...)` en entier par :

```js
    const checkoutDescription = `Abonnement MediClinic ${getPlan(targetPlanId).name} — ${clinic.name} (${qtyMonths} mois)`;

    let checkout;
    if (useProvider === 'paypal') {
      if (!paypal.isConfigured()) {
        await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', subPayment.id);
        return res.status(400).json({ error: "Le paiement PayPal n'est pas configuré pour cette installation. Utilisez le Mobile Money ou contactez le support MediClinic." });
      }
      checkout = await paypal.initiateCheckout({
        amount,
        description: checkoutDescription,
        reference: `sub-${subPayment.id}`,
        // Le retour pointe vers l'API, pas vers le front : cette URL déclenche
        // la capture côté serveur avant de renvoyer le navigateur dans l'app.
        returnUrl: `${API_PUBLIC_URL}/api/webhooks/paypal/return`,
        cancelUrl: `${APP_URL}/`,
        customerName: adminUser?.name || clinic.name,
        customerEmail: adminUser?.email
      });
      if (checkout.ok) checkout.provider = 'paypal';
    } else {
      checkout = await initiateCheckoutWithFailover(
        {
          amount,
          currency: 'XOF',
          description: checkoutDescription,
          reference: `sub-${subPayment.id}`,
          returnUrl: `${APP_URL}/`,
          cancelUrl: `${APP_URL}/`,
          customerName: adminUser?.name || clinic.name,
          customerEmail: adminUser?.email,
          customerPhone: normalizedPhone
        },
        { itemName: 'Abonnement MediClinic', ipnUrl: `${API_PUBLIC_URL}/api/webhooks/paytech` }
      );
    }
```

Le reste de la route (mise à jour `provider`/`provider_reference`/`checkout_url`, réponse 201) ne change pas : il lit déjà `checkout.provider`.

- [ ] **Step 4: Vérifier la syntaxe**

Run: `node --check backend/routes/financials.js`
Expected: aucune sortie.

- [ ] **Step 5: Vérifier que le chemin Mobile Money est intact**

Démarrer le backend (`npm run backend`), se connecter en admin pour obtenir un token, puis :

Run:
```bash
curl -s -X POST http://localhost:5000/api/financials/subscription/checkout \
  -H "Authorization: Bearer <TOKEN_ADMIN>" -H "Content-Type: application/json" \
  -d '{"months":1,"planId":"hopital"}'
```
Expected: comportement identique à avant l'ajout (soit un `checkoutUrl` Bictorys/PayTech, soit l'erreur 502 « paiement en ligne pas encore configuré » si aucune clé Mobile Money n'est renseignée). L'absence de `provider` dans le corps doit conserver l'ancien comportement.

- [ ] **Step 6: Vérifier le chemin PayPal**

Run:
```bash
curl -s -X POST http://localhost:5000/api/financials/subscription/checkout \
  -H "Authorization: Bearer <TOKEN_ADMIN>" -H "Content-Type: application/json" \
  -d '{"months":1,"planId":"hopital","provider":"paypal"}'
```
Expected: un JSON contenant `"provider":"paypal"` et un `checkoutUrl` sur `sandbox.paypal.com`.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/financials.js
git commit -m "feat(financials): route subscription checkout to PayPal when requested"
```

---

### Task 4: Webhook PayPal, capture au retour, et tolérance de montant

**Files:**
- Modify: `backend/routes/webhooks.js:8-9` (imports), `:24-28` (`amountMatches`), fin de fichier (nouvelles routes)

**Interfaces:**
- Consumes: `paypal.verifyWebhookSignature()`, `paypal.parseEvent()`, `paypal.captureOrder()`, `paypal.xofToUsd()` (Task 2).
- Produces: `POST /api/webhooks/paypal` et `GET /api/webhooks/paypal/return`. `fulfillEvent`, `fulfillSubscriptionEvent`, `isDuplicateEvent` restent inchangés.

- [ ] **Step 1: Importer l'adaptateur**

Dans `backend/routes/webhooks.js`, après la ligne 9 (`const paytech = require('../services/payments/paytech');`), ajouter :

```js
const paypal = require('../services/payments/paypal');
```

- [ ] **Step 2: Ajouter la branche PayPal à `amountMatches`**

Remplacer la fonction `amountMatches` (lignes 24-28) par :

```js
function amountMatches(provider, expected, reported) {
  if (reported === undefined || reported === null) return false; // no amount to verify against — fail closed, needs manual review
  if (provider === 'paypal') {
    // `expected` est en FCFA (colonne en base), `reported` en USD (PayPal ne
    // règle pas en XOF). On compare dans la même unité, tolérance 2% pour les
    // arrondis de conversion et les frais.
    const expectedUsd = paypal.xofToUsd(expected);
    if (expectedUsd === null) return false; // taux non configuré -> refus, pas de confiance aveugle
    return Math.abs(reported - expectedUsd) <= expectedUsd * 0.02;
  }
  const tolerance = provider === 'paytech' ? expected * 0.05 : 1; // PayTech absorbs ~3% fees; Bictorys settles exact
  return Math.abs(reported - expected) <= tolerance;
}
```

- [ ] **Step 3: Ajouter les deux routes**

Juste avant `module.exports = router;` en fin de `backend/routes/webhooks.js`, ajouter :

```js
// Retour navigateur après approbation sur la page PayPal (?token=<orderId>).
// Cette route ne fait QUE déclencher la capture — la mise à jour de
// l'abonnement passe exclusivement par le webhook signé ci-dessous.
router.get('/paypal/return', async (req, res) => {
  const appUrl = process.env.APP_URL || '/';
  const orderId = req.query.token;

  if (orderId) {
    try {
      const capture = await paypal.captureOrder(String(orderId));
      if (!capture.ok) {
        console.error('[WEBHOOKS] Échec de capture PayPal:', capture.error);
      }
    } catch (err) {
      console.error('[WEBHOOKS] Erreur de capture PayPal:', err);
    }
  }

  // Redirection systématique : que la capture ait réussi ou non, l'utilisateur
  // revient dans l'app, qui interroge déjà le statut du paiement.
  res.redirect(appUrl);
});

router.post('/paypal', async (req, res) => {
  try {
    const rawBody = req.rawBody;
    if (!rawBody) return res.status(400).json({ error: 'Corps de requête brut manquant' });

    const verify = await paypal.verifyWebhookSignature(req, rawBody);
    if (!verify.ok) {
      console.error('[WEBHOOKS] Signature PayPal invalide:', verify.error);
      return res.status(401).json({ error: verify.error });
    }

    const event = paypal.parseEvent(req.body);
    if (!event) return res.json({ received: true, ignored: true });

    if (await isDuplicateEvent('paypal', rawBody)) {
      return res.json({ received: true, deduped: true });
    }

    await fulfillEvent('paypal', event);
    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOKS] Erreur webhook PayPal:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});
```

- [ ] **Step 4: Vérifier la syntaxe**

Run: `node --check backend/routes/webhooks.js`
Expected: aucune sortie.

- [ ] **Step 5: Vérifier que la vérification de signature refuse bien un faux webhook**

Backend démarré :

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:5000/api/webhooks/paypal \
  -H "Content-Type: application/json" -d '{"event_type":"PAYMENT.CAPTURE.COMPLETED"}'
```
Expected: `401` — aucun en-tête de signature, la requête doit être rejetée avant tout traitement.

- [ ] **Step 6: Vérifier la route de retour**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:5000/api/webhooks/paypal/return"
```
Expected: `302` (redirection vers `APP_URL`), sans `token` et sans erreur serveur.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/webhooks.js
git commit -m "feat(webhooks): add PayPal webhook, capture-on-return, and USD amount check"
```

---

### Task 5: Étape de paiement dans Settings > Abonnement (Mobile Money + PayPal)

`handleRenewSubmit` existe dans `SettingsPage.tsx` mais n'est appelé nulle part dans le JSX : aucun bouton ne déclenche aujourd'hui un checkout d'abonnement payant. Cette tâche construit l'étape manquante, avec les deux moyens de paiement.

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx:147-158` (signature de `renewSubscription`)
- Modify: `frontend/src/contexts/AuthContext.tsx` (type du contexte — la déclaration de `renewSubscription` dans l'interface)
- Modify: `frontend/src/pages/Settings/SettingsPage.tsx:267-281` (handler), et le JSX de l'onglet facturation, juste après la barre de note comparative (`:776-786`)

**Interfaces:**
- Consumes: `POST /financials/subscription/checkout` avec `provider` (Task 3).
- Produces: `renewSubscription(phone, months, planId?, provider?)` où `provider` vaut `'mobile_money' | 'paypal'`.

- [ ] **Step 1: Ajouter le paramètre `provider` à `renewSubscription`**

Dans `frontend/src/contexts/AuthContext.tsx`, remplacer les lignes 147-152 par :

```tsx
  const renewSubscription = async (
    phone: string | undefined,
    months: number,
    planId?: 'clinique' | 'hopital',
    provider: 'mobile_money' | 'paypal' = 'mobile_money'
  ) => {
    const data = await api.post('/financials/subscription/checkout', {
      phoneNumber: phone,
      months,
      planId,
      provider
    });
```

- [ ] **Step 2: Mettre à jour le type du contexte**

Dans le même fichier, trouver la déclaration de `renewSubscription` dans l'interface du contexte (chercher `renewSubscription:`) et remplacer sa signature par :

```tsx
  renewSubscription: (
    phone: string | undefined,
    months: number,
    planId?: 'clinique' | 'hopital',
    provider?: 'mobile_money' | 'paypal'
  ) => Promise<{ checkoutUrl: string; subscriptionPaymentId: number; provider: string }>;
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd frontend && npm run build`
Expected: build réussi. Une erreur TypeScript ici signifie que la signature de l'interface et celle de l'implémentation divergent.

- [ ] **Step 4: Adapter `handleRenewSubmit` pour recevoir le fournisseur**

Dans `frontend/src/pages/Settings/SettingsPage.tsx`, remplacer les lignes 267-281 par :

```tsx
  const handleRenewSubmit = async (provider: 'mobile_money' | 'paypal') => {
    if (!renewalTargetPlanId) return;

    setIsRenewing(true);
    try {
      const result = await renewSubscription(paymentPhone || undefined, renewMonths, renewalTargetPlanId, provider);
      setActiveCheckout(result);
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Échec du paiement', err.error || 'Impossible d\'initialiser le renouvellement.');
    } finally {
      setIsRenewing(false);
    }
  };
```

- [ ] **Step 5: Ajouter le bloc de paiement dans le JSX**

Dans le même fichier, juste après le bloc de la barre de note comparative (celui qui se termine par `)}` après « changement de plan à tout moment », vers la ligne 786) et **avant** la fermeture `</div>` de l'onglet facturation, insérer :

```tsx
            {/* Étape de paiement — apparaît une fois un plan payant sélectionné.
                Mobile Money et PayPal sont deux choix explicites : PayPal n'est
                pas un repli automatique du Mobile Money. */}
            {!loading && renewalTargetPlanId && (
              <div className="card" style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem' }}>Régler l'abonnement {plansCatalog?.[renewalTargetPlanId]?.name}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Votre abonnement est activé dès la confirmation du paiement.
                  </p>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '180px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Durée</span>
                    <select
                      className="input-control"
                      value={renewMonths}
                      onChange={(e) => setRenewMonths(parseInt(e.target.value, 10))}
                    >
                      <option value={1}>1 mois</option>
                      <option value={3}>3 mois</option>
                      <option value={6}>6 mois</option>
                      <option value={12}>12 mois</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '220px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Téléphone Mobile Money (optionnel)</span>
                    <PhoneInput value={paymentPhone} onChange={setPaymentPhone} />
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total</span>
                    <strong style={{ fontSize: '1.2rem' }}>
                      {(renewMonths * pricePerMonth).toLocaleString()} FCFA
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isRenewing}
                    onClick={() => handleRenewSubmit('mobile_money')}
                  >
                    {isRenewing ? 'Initialisation...' : 'Payer par Mobile Money'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={isRenewing}
                    onClick={() => handleRenewSubmit('paypal')}
                    style={{ border: '1px solid var(--border)' }}
                  >
                    {isRenewing ? 'Initialisation...' : 'Payer par PayPal'}
                  </button>
                </div>

                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                  PayPal ne règle pas en FCFA : le montant est converti en dollars américains au taux
                  appliqué par MediClinic. Le montant débité peut donc différer légèrement du total ci-dessus.
                </p>
              </div>
            )}
```

- [ ] **Step 6: Vérifier que `PhoneInput` est importé**

Chercher `PhoneInput` dans les imports en tête de `SettingsPage.tsx`. S'il est absent, ajouter :

```tsx
import { PhoneInput } from '../../components/PhoneInput';
```

- [ ] **Step 7: Vérifier la compilation et le lint**

Run: `cd frontend && npm run build && npm run lint`
Expected: build réussi, aucune erreur de lint sur `SettingsPage.tsx` ni `AuthContext.tsx`. `handleRenewSubmit`, `paymentPhone` et `renewMonths` ne doivent plus être signalés comme inutilisés.

- [ ] **Step 8: Vérifier dans le navigateur**

Lancer `npm run dev`, se connecter en admin, aller dans Paramètres > Abonnement, cliquer sur un plan payant.
Expected: le bloc de paiement apparaît sous les cartes de plans, avec le sélecteur de durée, le total qui se recalcule, et les deux boutons. Cliquer sur « Payer par PayPal » ouvre `PaymentCheckoutModal` avec une URL sandbox PayPal.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx frontend/src/pages/Settings/SettingsPage.tsx
git commit -m "feat(settings): add subscription payment step with Mobile Money and PayPal"
```

---

### Task 6: Aller-retour complet en sandbox

Aucun code n'est écrit ici — c'est la validation de bout en bout, seule preuve que la chaîne fonctionne. Les webhooks PayPal ne peuvent pas atteindre `localhost`.

**Files:**
- Modify: `backend/.env` (`API_PUBLIC_URL` temporairement mis sur l'URL du tunnel)

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien — confirmation.

- [ ] **Step 1: Ouvrir un tunnel public vers le backend**

Run: `ngrok http 5000`
Expected: une URL `https://<sous-domaine>.ngrok-free.app` affichée. La noter.

- [ ] **Step 2: Pointer la configuration sur le tunnel**

Dans `backend/.env`, mettre `API_PUBLIC_URL=https://<sous-domaine>.ngrok-free.app`, puis redémarrer le backend (les modules lisent `process.env` à l'import).

- [ ] **Step 3: Déclarer le webhook côté PayPal**

Sur `developer.paypal.com` > l'app sandbox > Webhooks > Add Webhook :
- URL : `https://<sous-domaine>.ngrok-free.app/api/webhooks/paypal`
- Événements : `PAYMENT.CAPTURE.COMPLETED` et `PAYMENT.CAPTURE.DENIED`

Copier le Webhook ID généré dans `PAYPAL_WEBHOOK_ID` (`backend/.env`), redémarrer le backend.

- [ ] **Step 4: Payer avec le compte acheteur sandbox**

Dans l'app : Paramètres > Abonnement > choisir Hôpital > 1 mois > « Payer par PayPal ». S'authentifier sur la page PayPal avec le compte acheteur sandbox (Testing Tools > Sandbox Accounts), approuver.
Expected: retour automatique dans l'app, `PaymentCheckoutModal` affiche la confirmation.

- [ ] **Step 5: Vérifier la réception du webhook**

Consulter la console du backend.
Expected: aucune ligne `[WEBHOOKS] Signature PayPal invalide`. Si elle apparaît, `PAYPAL_WEBHOOK_ID` ne correspond pas au webhook réellement déclaré.

- [ ] **Step 6: Vérifier l'état en base**

Dans le SQL Editor Supabase :

```sql
SELECT id, plan, months, amount, status, provider, paid_at
FROM subscription_payments ORDER BY id DESC LIMIT 1;

SELECT id, name, plan, subscription_status, subscription_expires_at
FROM clinics WHERE id = <clinic_id>;

SELECT action, details, created_at FROM activity_logs
WHERE action = 'SUBSCRIPTION_RENEW' ORDER BY id DESC LIMIT 1;
```

Expected: `subscription_payments.status = 'paid'` avec `provider = 'paypal'`, `clinics.subscription_expires_at` décalé d'un mois, une ligne `SUBSCRIPTION_RENEW` présente.

- [ ] **Step 7: Vérifier l'idempotence**

Depuis le tableau de bord PayPal (Webhooks > Event Logs), renvoyer le même événement (« Resend »).
Expected: la réponse HTTP est `{"received":true,"deduped":true}` et `subscription_expires_at` **ne bouge pas** une seconde fois.

- [ ] **Step 8: Vérifier la non-régression Mobile Money**

Refaire un renouvellement avec « Payer par Mobile Money ».
Expected: comportement identique à avant ce chantier (URL Bictorys/PayTech, ou l'erreur claire si les clés ne sont pas configurées).

- [ ] **Step 9: Restaurer la configuration et documenter**

Remettre `API_PUBLIC_URL` sur sa valeur de production dans `backend/.env`. Ajouter dans `CLAUDE.md`, section « Payments », une phrase indiquant que PayPal est un troisième fournisseur, réservé aux abonnements, hors chaîne de failover, avec conversion FCFA→USD par `XOF_TO_USD_RATE`.

- [ ] **Step 10: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document PayPal subscription provider in architecture notes"
```

---

## Passage en production

À faire une fois la Task 6 validée, pas avant :

1. Sur `developer.paypal.com`, basculer en **Live**, créer l'app, relever `Client ID` et `Secret` live.
2. Déclarer un webhook live sur `https://<domaine-prod>/api/webhooks/paypal` avec les deux mêmes événements, relever son Webhook ID (différent du sandbox).
3. Dans Vercel > Project Settings > Environment Variables : `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE=live`, `PAYPAL_WEBHOOK_ID`, `XOF_TO_USD_RATE`. Ces valeurs ne sont jamais lues depuis un `.env` en production.
4. Vérifier que `API_PUBLIC_URL` est bien l'URL HTTPS publique du backend.
5. Faire un premier paiement réel de faible montant (1 mois) et vérifier les trois mêmes tables qu'à l'étape 6 de la Task 6.

**Préalable métier, à confirmer avant l'étape 1 :** vérifier que le compte PayPal Business peut *recevoir* des paiements. Les comptes ouverts en Côte d'Ivoire sont historiquement limités à l'envoi. Le sandbox fonctionnera quoi qu'il arrive — il ne prouve donc rien sur ce point.
