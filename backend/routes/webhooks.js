// Public webhook receivers for payment providers — NOT behind the `auth`
// middleware (these are server-to-server calls from Bictorys/PayTech, not
// authenticated MediClinic users). Signature verification replaces auth.
const express = require('express');
const router = express.Router();
const crypto = require('node:crypto');
const { supabase } = require('../database');
const bictorys = require('../services/payments/bictorys');
const paytech = require('../services/payments/paytech');

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
function amountMatches(provider, expected, reported) {
  if (reported === undefined || reported === null) return false; // no amount to verify against — fail closed, needs manual review
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

  if (!amountMatches(provider, row.amount, event.reportedAmount)) {
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

  if (!amountMatches(provider, row.amount_total, event.reportedAmount)) {
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

  if (!amountMatches(provider, row.amount, event.reportedAmount)) {
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

module.exports = router;
