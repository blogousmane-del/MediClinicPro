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
    // règle pas en XOF). On compare dans la même unité, tolérance 2% pour les
    // arrondis de conversion et les frais.
    // Priorité au montant USD figé au moment du checkout (colonne amount_usd) :
    // le recalculer ici le soumettrait au XOF_TO_USD_RATE courant, qu'un
    // changement d'exploitant pendant qu'une commande est en vol ferait échouer
    // fermé sur un paiement pourtant légitime. Repli sur la reconversion tant
    // que la colonne n'existe pas en base (migration manuelle en attente, voir
    // la section « schema drift » de CLAUDE.md) : une colonne absente ne doit
    // jamais bloquer un paiement qui se vérifierait autrement.
    const storedUsd = row ? row.amount_usd : undefined;
    const expectedUsd =
      storedUsd === undefined || storedUsd === null ? paypal.xofToUsd(expected) : Number(storedUsd);
    if (expectedUsd === null || !Number.isFinite(expectedUsd) || expectedUsd <= 0) return false; // taux non configuré/montant illisible -> refus, pas de confiance aveugle
    return Math.abs(reported - expectedUsd) <= expectedUsd * 0.02;
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

  const { data: updated } = await supabase
    .from('subscription_payments')
    .update({ status: 'paid', paid_at: new Date().toISOString(), provider })
    .eq('id', id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();
  if (!updated) return; // already fulfilled by a concurrent/duplicate webhook

  const { data: clinic } = await supabase
    .from('clinics')
    .select('subscription_expires_at, subscription_status')
    .eq('id', row.clinic_id)
    .single();

  let baseDate = new Date();
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

    // PayPal est réservé aux abonnements (ni paiements patients, ni dépôts) :
    // une référence d'un autre type serait routée vers un flux jamais prévu
    // pour lui — on refuse explicitement plutôt que de laisser fulfillEvent
    // décider.
    if (!String(event.paymentReference || '').startsWith('sub-')) {
      console.error('[WEBHOOKS] Référence PayPal hors périmètre abonnement, événement ignoré:', event.paymentReference);
      return res.json({ received: true, ignored: true });
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
