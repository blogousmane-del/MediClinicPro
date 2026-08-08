// Public webhook receivers for payment providers — NOT behind the `auth`
// middleware (these are server-to-server calls from Bictorys/PayTech, not
// authenticated MediClinic users). Signature verification replaces auth.
const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { supabase } = require('../database');
const bictorys = require('../services/payments/bictorys');
const paytech = require('../services/payments/paytech');
const paypal = require('../services/payments/paypal');
const { getSecret } = require('../utils/platformSettings');

// Returns true if this exact webhook body was already processed (dedup via
// the payment_webhook_events UNIQUE(provider, event_hash) constraint).
async function isDuplicateEvent(provider, rawBody) {
  const eventHash = crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 32);
  const { error } = await supabase.from('payment_webhook_events').insert({ provider, event_hash: eventHash });
  if (!error) return false;
  if (error.code === '23505') return true; // unique_violation = already processed
  console.error('[WEBHOOKS] Erreur d\'insertion dédoublonnage:', error);
  return false; // fail open — the idempotent UPDATE ... WHERE status='pending' below is the real safety net
}

// Our own checkout references are always "<type>-<id>", generated at
// initiation time (sub-12, pay-45, dep-7) and echoed back by the provider.
// `row` = la ligne en base concernée (subscription_payments/payments/deposits) :
// seul le chemin PayPal s'en sert, pour lire le montant USD figé au checkout.
function amountMatches(provider, expected, event, row) {
  const reported = event ? event.reportedAmount : undefined;
  if (reported === undefined || reported === null) return false; // no amount to verify against — fail closed, needs manual review
  if (provider === 'paypal') {
    // PayPal n'encaisse qu'en USD pour nous (initiateCheckout impose
    // currency_code 'USD'). Une devise absente ou différente n'est pas
    // comparable au montant attendu : on échoue fermé, comme pour un montant
    // manquant, plutôt que de supposer des dollars.
    if (event.reportedCurrency !== 'USD') {
      console.error('[WEBHOOKS] Devise PayPal inattendue (USD attendu):', event.reportedCurrency);
      return false;
    }
    // `expected` est en FCFA (colonne en base), `reported` en USD (PayPal ne
    // règle pas en XOF). On compare dans la même unité.
    // Priorité au montant USD figé au moment du checkout (colonne amount_usd) :
    // le recalculer ici le soumettrait au XOF_TO_USD_RATE courant, qu'un
    // changement d'exploitant pendant qu'une commande est en vol ferait échouer
    // fermé sur un paiement pourtant légitime. Repli sur la reconversion tant
    // que la colonne n'existe pas en base (migration manuelle en attente, voir
    // la section « schema drift » de CLAUDE.md) : une colonne absente ne doit
    // jamais bloquer un paiement qui se vérifierait autrement.
    const storedUsd = row ? row.amount_usd : undefined;
    const hasStoredUsd = storedUsd !== undefined && storedUsd !== null;
    const expectedUsd = hasStoredUsd ? Number(storedUsd) : paypal.xofToUsd(expected);
    if (expectedUsd === null || !Number.isFinite(expectedUsd) || expectedUsd <= 0) return false; // taux non configuré/montant illisible -> refus, pas de confiance aveugle

    // Deux tolérances, pas une. `resource.amount.value` est le montant BRUT
    // encaissé (PayPal prélève ses frais après, contrairement à PayTech qui
    // rapporte un net) : quand amount_usd existe, c'est très exactement la
    // valeur envoyée à PayPal en `amount.value`, donc l'égalité est attendue au
    // centime près et une fenêtre à 2% laisserait passer un sous-paiement.
    // Le repli sans amount_usd reconvertit au taux courant, qui peut avoir
    // bougé depuis le checkout — d'où 2% conservés sur cette seule branche.
    const tolerance = hasStoredUsd ? 0.01 : expectedUsd * 0.02;
    return Math.abs(reported - expectedUsd) <= tolerance;
  }
  const tolerance = provider === 'paytech' ? expected * 0.05 : 1; // PayTech absorbs ~3% fees; Bictorys settles exact
  return Math.abs(reported - expected) <= tolerance;
}

async function fulfillSubscriptionEvent(provider, id, event) {
  const { data: row } = await supabase.from('subscription_payments').select('*').eq('id', id).maybeSingle();
  if (!row || row.status !== 'pending') return;

  if (event.status === 'failed') {
    await supabase.from('subscription_payments').update({ status: 'failed' }).eq('id', id).eq('status', 'pending');
    return;
  }

  if (!amountMatches(provider, row.amount, event, row)) {
    console.error('[WEBHOOKS] Montant abonnement suspect', { id, expected: row.amount, got: event.reportedAmount });
    return;
  }

  const paidAt = new Date().toISOString();

  const { data: updated } = await supabase
    .from('subscription_payments')
    .update({ status: 'paid', paid_at: paidAt, provider })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (!updated) return; // already fulfilled by a concurrent/duplicate webhook

  await creditSubscription(row, { provider, paidAt });
}

/**
 * Crédite un abonnement dont le paiement est DÉJÀ prouvé et dont la ligne est
 * déjà passée à 'paid' : prolonge l'échéance, bascule le plan, journalise.
 * Cette fonction ne décide rien — l'appelant a fait la vérification.
 *
 * `paidAt` est un paramètre et non `new Date()` en dur : la réconciliation
 * Chariow rattrape des paiements plusieurs jours après leur règlement et doit
 * pouvoir passer la date du fournisseur, sinon la recette est datée du jour du
 * rattrapage. Les webhooks Bictorys/PayTech/PayPal, eux, arrivent en direct et
 * continuent de passer l'heure courante.
 *
 * @param {object} row - ligne subscription_payments
 * @param {{provider: string, paidAt: string}} context - date ISO du règlement
 */
async function creditSubscription(row, { provider, paidAt }) {
  const { data: clinic } = await supabase
    .from('clinics')
    .select('subscription_expires_at, subscription_status')
    .eq('id', row.clinic_id)
    .single();

  // L'échéance repart de la date d'expiration en cours si elle est future :
  // un renouvellement anticipé ne doit pas effacer les jours restants.
  let baseDate = new Date(paidAt);
  if (clinic?.subscription_status === 'active' && clinic.subscription_expires_at) {
    const currentExpiry = new Date(clinic.subscription_expires_at);
    if (currentExpiry > baseDate) baseDate = currentExpiry;
  }
  baseDate.setMonth(baseDate.getMonth() + row.months);

  await supabase
    .from('clinics')
    .update({ subscription_status: 'active', subscription_expires_at: baseDate.toISOString(), plan: row.plan || undefined })
    .eq('id', row.clinic_id);

  await supabase.from('activity_logs').insert({
    clinic_id: row.clinic_id,
    user_id: row.user_id,
    action: 'SUBSCRIPTION_RENEW',
    details: `Abonnement ${row.plan || ''} renouvelé pour ${row.months} mois (${row.amount} FCFA) via ${provider.toUpperCase()}`
  });
}

async function fulfillPatientPaymentEvent(provider, id, event) {
  const { data: row } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
  if (!row || row.status !== 'pending') return;

  if (event.status === 'failed') {
    await supabase.from('payments').update({ status: 'failed' }).eq('id', id).eq('status', 'pending');
    return;
  }

  if (!amountMatches(provider, row.amount_total, event, row)) {
    console.error('[WEBHOOKS] Montant paiement patient suspect', { id, expected: row.amount_total, got: event.reportedAmount });
    return;
  }

  const { data: updated } = await supabase
    .from('payments')
    .update({ status: 'paid', provider })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (!updated) return;

  await supabase.from('activity_logs').insert({
    clinic_id: row.clinic_id,
    user_id: row.user_id,
    action: 'PAYMENT_CONFIRMED',
    details: `Paiement en ligne de ${row.amount_total} FCFA (${row.payment_method}) confirmé via ${provider.toUpperCase()}`
  });
}

async function fulfillDepositEvent(provider, id, event) {
  const { data: row } = await supabase.from('deposits').select('*').eq('id', id).maybeSingle();
  if (!row || row.payment_status !== 'pending') return;

  if (event.status === 'failed') {
    await supabase.from('deposits').update({ payment_status: 'failed' }).eq('id', id).eq('payment_status', 'pending');
    return;
  }

  if (!amountMatches(provider, row.amount, event, row)) {
    console.error('[WEBHOOKS] Montant dépôt suspect', { id, expected: row.amount, got: event.reportedAmount });
    return;
  }

  const { data: updated } = await supabase
    .from('deposits')
    .update({ payment_status: 'paid', provider })
    .eq('id', id)
    .eq('payment_status', 'pending')
    .select()
    .maybeSingle();
  if (!updated) return;

  await supabase.from('activity_logs').insert({
    clinic_id: row.clinic_id,
    user_id: row.user_id,
    action: 'DEPOSIT_PAYMENT_CONFIRMED',
    details: `Dépôt de garantie de ${row.amount} FCFA confirmé via ${provider.toUpperCase()}`
  });
}

async function fulfillEvent(provider, event) {
  if (!event) return;
  const parsedRef = event.paymentReference ? event.paymentReference.split('-') : null;
  const type = parsedRef ? parsedRef[0] : null;
  const id = parsedRef ? parseInt(parsedRef[1], 10) : NaN;
  if (!type || !id) {
    console.error('[WEBHOOKS] Référence de paiement introuvable/non reconnue:', event.paymentReference);
    return;
  }

  if (type === 'sub') return fulfillSubscriptionEvent(provider, id, event);
  if (type === 'pay') return fulfillPatientPaymentEvent(provider, id, event);
  if (type === 'dep') return fulfillDepositEvent(provider, id, event);
  console.error('[WEBHOOKS] Type de référence inconnu:', type);
}

router.post('/bictorys', async (req, res) => {
  try {
    const rawBody = req.rawBody;
    if (!rawBody) return res.status(400).json({ error: 'Corps de requête brut manquant' });

    const verify = bictorys.verifyWebhookSignature(req, rawBody);
    if (!verify.ok) {
      console.error('[WEBHOOKS] Signature Bictorys invalide:', verify.error);
      return res.status(401).json({ error: verify.error });
    }

    const event = bictorys.parseEvent(req.body);
    if (!event) return res.json({ received: true, ignored: true });

    if (await isDuplicateEvent('bictorys', rawBody)) {
      return res.json({ received: true, deduped: true });
    }

    await fulfillEvent('bictorys', event);
    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOKS] Erreur webhook Bictorys:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

router.post('/paytech', async (req, res) => {
  try {
    const rawBody = req.rawBody;
    if (!rawBody) return res.status(400).json({ error: 'Corps de requête brut manquant' });

    const verify = paytech.verifyAndParseIPN(req, rawBody);
    if (!verify.ok) {
      console.error('[WEBHOOKS] Signature PayTech invalide:', verify.error);
      return res.status(401).json({ error: verify.error });
    }

    const event = paytech.parseIPNEvent(verify.body);
    if (!event) return res.json({ received: true, ignored: true });

    if (await isDuplicateEvent('paytech', rawBody)) {
      return res.json({ received: true, deduped: true });
    }

    await fulfillEvent('paytech', event);
    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOKS] Erreur webhook PayTech:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Chariow n'expose AUCUNE signature de webhook (voir Chariow.md §7) :
// l'authentification se réduit à un secret placé dans l'URL. C'est faible,
// d'où la règle absolue appliquée ci-dessous — le corps ne sert qu'à
// identifier une vente, jamais à établir qu'elle est payée.
const CHARIOW_SUCCESS_EVENTS = ['successful.sale', 'settled.sale', 'completed.sale'];

function secretMatches(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  // timingSafeEqual exige des longueurs égales : comparer les longueurs
  // d'abord évite l'exception, et une longueur différente est de toute façon
  // un secret faux.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post('/chariow', async (req, res) => {
  try {
    const expected = await getSecret('chariow_webhook_secret');
    if (!expected || !secretMatches(req.query.secret, expected)) {
      console.error('[WEBHOOKS] Secret Chariow invalide ou absent.');
      return res.status(401).json({ error: 'Secret invalide.' });
    }

    const body = req.body || {};
    const eventName = String(body.event || body.type || '');
    if (!CHARIOW_SUCCESS_EVENTS.includes(eventName)) {
      // 200 volontaire : un code d'erreur ferait rejouer Chariow indéfiniment
      // sur un événement dont nous n'avons rien à faire.
      return res.json({ received: true, ignored: true });
    }

    const rawBody = req.rawBody;
    if (rawBody && (await isDuplicateEvent('chariow', rawBody))) {
      return res.json({ received: true, deduped: true });
    }

    // RÈGLE ABSOLUE : on ne lit du corps que de quoi retrouver la ligne. Ni le
    // statut ni le montant annoncés ne sont pris en compte — la réconciliation
    // les redemande à Chariow.
    const data = body.data || {};
    const metadata = data.custom_metadata || {};
    let subscriptionPaymentId = parseInt(metadata.subscriptionPaymentId, 10);

    if (!Number.isInteger(subscriptionPaymentId)) {
      const saleId = data.id || data.sale_id;
      if (!saleId) return res.json({ received: true, ignored: true });

      const { data: row } = await supabase
        .from('subscription_payments')
        .select('id')
        .eq('provider', 'chariow')
        .eq('provider_reference', String(saleId))
        .maybeSingle();

      if (!row) {
        console.error('[WEBHOOKS] Vente Chariow inconnue de cette installation :', String(saleId));
        return res.json({ received: true, ignored: true });
      }
      subscriptionPaymentId = row.id;
    }

    // Require paresseux : chariowReconcile requiert ce module pour
    // creditSubscription. Un require en tête de fichier créerait un cycle.
    const { reconcileChariowSubscription } = require('../services/payments/chariowReconcile');
    const result = await reconcileChariowSubscription(subscriptionPaymentId);

    res.json({ received: true, status: result.status });
  } catch (err) {
    console.error('[WEBHOOKS] Erreur webhook Chariow:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

// Retour navigateur après approbation sur la page PayPal (?token=<orderId>).
// Cette route ne fait QUE déclencher la capture — la mise à jour de
// l'abonnement passe exclusivement par le webhook signé ci-dessous.
router.get('/paypal/return', async (req, res) => {
  const appUrl = process.env.APP_URL || '/';
  const orderId = req.query.token;

  if (orderId) {
    try {
      // Périmètre vérifié AVANT la capture, comme sur le chemin webhook : cette
      // route est publique (montée hors du middleware `auth`) et son seul
      // paramètre vient du navigateur. Sans ce contrôle, n'importe qui pouvait
      // faire capturer une commande arbitraire de notre compte marchand, et
      // surtout déclencher deux appels sortants vers PayPal (OAuth + capture)
      // par requête anonyme sur une fonction serverless à durée bornée.
      // On n'accepte donc que les commandes que ce serveur a lui-même créées :
      // provider_reference est renseigné à l'initiation du checkout
      // (financials.js) avec l'id de commande PayPal.
      const { data: ownedOrder, error: ownedOrderError } = await supabase
        .from('subscription_payments')
        .select('id')
        .eq('provider', 'paypal')
        .eq('provider_reference', String(orderId))
        .maybeSingle();

      if (ownedOrderError) throw ownedOrderError;

      if (!ownedOrder) {
        // Ni capture ni erreur visible pour l'appelant : on redirige comme
        // d'habitude pour ne pas transformer cette route en oracle permettant
        // de tester l'existence d'un id de commande.
        console.error('[WEBHOOKS] Retour PayPal avec une commande inconnue, capture refusée — commande id:', String(orderId));
        return res.redirect(appUrl);
      }

      const capture = await paypal.captureOrder(String(orderId));
      if (!capture.ok) {
        console.error('[WEBHOOKS] Échec de capture PayPal:', capture.error);
      } else if (capture.status === 'already_captured') {
        // Cas ordinaire, pas une anomalie : le webhook CHECKOUT.ORDER.APPROVED
        // a déjà capturé, ou l'utilisateur a simplement rechargé cette page de
        // retour. Niveau warn pour ne pas polluer les alertes d'erreur.
        console.warn('[WEBHOOKS] Capture PayPal déjà effectuée (webhook ou rechargement de page).');
      } else if (capture.status !== 'COMPLETED') {
        // Réponse 2xx mais règlement non prouvé (PENDING, unknown...) — pas une
        // erreur, mais rien à créditer sur cette seule base. Ligne distincte
        // pour qu'un opérateur retrouve une capture qui n'a pas silencieusement
        // abouti. Le webhook signé reste seul juge.
        console.error('[WEBHOOKS] Capture PayPal non réglée (statut non COMPLETED):', capture.status);
      }
    } catch (err) {
      console.error('[WEBHOOKS] Erreur de capture PayPal:', err);
    }
  }

  // Redirection systématique : que la capture ait réussi ou non, l'utilisateur
  // revient dans l'app, qui interroge déjà le statut du paiement.
  res.redirect(appUrl);
});

// Seuls types d'événements que cette route sait traiter. Sert de pré-filtre
// local (voir ci-dessous) — ce n'est pas un contrôle de sécurité : il ne fait
// que jeter, jamais accepter.
const PAYPAL_HANDLED_EVENTS = new Set([
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.REVERSED'
]);

router.post('/paypal', async (req, res) => {
  try {
    const rawBody = req.rawBody;
    if (!rawBody) return res.status(400).json({ error: 'Corps de requête brut manquant' });

    // Pré-filtre local AVANT la vérification : celle-ci est un aller-retour
    // réseau vers PayPal (OAuth + verify), contrairement au HMAC local de
    // Bictorys/PayTech. PayPal diffuse beaucoup de types d'événements que cette
    // route ne traite pas, et une requête forgée ne doit pas nous coûter deux
    // appels sortants. Aucun événement n'est exploité par ce chemin : il
    // n'aboutit qu'à un rejet, la vérification reste obligatoire (et inchangée)
    // pour tous les types traités.
    if (!PAYPAL_HANDLED_EVENTS.has(String((req.body && req.body.event_type) || ''))) {
      return res.json({ received: true, ignored: true });
    }

    const verify = await paypal.verifyWebhookSignature(req, rawBody);
    if (!verify.ok) {
      console.error('[WEBHOOKS] Signature PayPal invalide:', verify.error);
      // Corps volontairement générique : renvoyer verify.error permettrait à un
      // appelant non authentifié de distinguer en-têtes manquants, webhook id
      // non configuré et échec de signature, donc de sonder notre configuration.
      return res.status(401).json({ error: 'Requête webhook non autorisée.' });
    }

    const event = paypal.parseEvent(req.body);
    if (!event) return res.json({ received: true, ignored: true });

    // PayPal est réservé aux abonnements (ni paiements patients, ni dépôts) :
    // une référence d'un autre type serait routée vers un flux jamais prévu
    // pour lui — on refuse explicitement plutôt que de laisser fulfillEvent
    // décider. Ce contrôle passe AVANT la capture ci-dessous : capturer d'abord
    // et refuser ensuite encaisserait de l'argent que rien ne pourrait créditer.
    if (!String(event.paymentReference || '').startsWith('sub-')) {
      console.error('[WEBHOOKS] Référence PayPal hors périmètre abonnement, événement ignoré:', event.paymentReference);
      return res.json({ received: true, ignored: true });
    }

    // Commande approuvée par l'acheteur mais pas encore capturée : la capture
    // n'est autrement déclenchée que par le retour navigateur, donc un acheteur
    // qui ferme l'onglet ne serait jamais encaissé. On capture ici ; c'est le
    // PAYMENT.CAPTURE.COMPLETED qui suit qui créditera l'abonnement, comme
    // d'habitude. Aucune écriture en base sur ce chemin, et recapturer est sans
    // risque (captureOrder renvoie le sentinel 'already_captured').
    if (event.kind === 'order_approved') {
      const capture = await paypal.captureOrder(event.orderId);
      if (!capture.ok) {
        console.error('[WEBHOOKS] Échec de capture PayPal déclenchée par webhook:', capture.error);
      } else {
        console.log(`[WEBHOOKS] Capture PayPal déclenchée par webhook (commande ${event.orderId}) — statut: ${capture.status}`);
      }
      return res.json({ received: true, captured: true });
    }

    await fulfillEvent('paypal', event);

    // Dédoublonnage APRÈS traitement — à l'inverse de Bictorys/PayTech, où il
    // précède le traitement. La vérification de signature PayPal est un
    // aller-retour réseau de plusieurs secondes : si la fonction serverless est
    // tuée entre l'insertion de dédoublonnage et la fin du crédit, la
    // redistribution PayPal serait répondue « deduped » et l'abonnement resterait
    // impayé sans la moindre trace. Le crédit étant déjà idempotent (ligne
    // exigée 'pending', UPDATE conditionnel), il vaut mieux rejouer que
    // dédoublonner trop tôt.
    if (await isDuplicateEvent('paypal', rawBody)) {
      return res.json({ received: true, deduped: true });
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[WEBHOOKS] Erreur webhook PayPal:', err);
    res.status(500).json({ error: 'Erreur interne' });
  }
});

module.exports = router;
// Exporté pour services/payments/chariowReconcile.js, seul autre endroit
// autorisé à créditer un abonnement.
module.exports.creditSubscription = creditSubscription;
