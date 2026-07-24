// PayTech hosted-checkout adapter (Wave, Orange Money, MTN/Free Money, card — SN/CI/ML/BJ).
// https://docs.intech.sn/doc_paytech.php
//
// Two quirks vs Bictorys:
//   1. Auth uses two custom headers: API_KEY and API_SECRET (uppercase). Not "Authorization: Bearer".
//   2. The IPN ships as application/x-www-form-urlencoded by default, not JSON.
const crypto = require('node:crypto');

const PAYTECH_API_URL = 'https://paytech.sn/api';
const FETCH_TIMEOUT_MS = 15_000;

function isConfigured() {
  return !!(process.env.PAYTECH_API_KEY && process.env.PAYTECH_API_SECRET);
}

async function paytechFetch(path, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(`${PAYTECH_API_URL}${path}`, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {object} params
 * @param {number} params.amount - integer XOF
 * @param {string} params.description
 * @param {string} params.itemName
 * @param {string} params.reference - our own reference, e.g. "sub-12" or "pay-45"
 * @param {string} params.returnUrl
 * @param {string} params.cancelUrl
 * @param {string} params.ipnUrl - public HTTPS URL, no localhost
 * @param {string} [params.customerEmail]
 * @param {string} [params.customerName]
 * @param {string} [params.customerPhone]
 */
async function initiateCheckout(params) {
  if (!isConfigured()) {
    return { ok: false, error: 'not_configured' };
  }

  const env = process.env.PAYTECH_ENV || (process.env.NODE_ENV === 'production' ? 'prod' : 'test');

  const body = {
    item_name: params.itemName,
    item_price: Math.floor(params.amount),
    currency: 'XOF',
    ref_command: params.reference,
    command_name: (params.description || params.itemName).slice(0, 200),
    env,
    ipn_url: params.ipnUrl,
    success_url: params.returnUrl,
    cancel_url: params.cancelUrl,
    custom_field: JSON.stringify({
      reference: params.reference,
      customer_email: params.customerEmail || '',
      customer_name: params.customerName || '',
      customer_phone: params.customerPhone || ''
    })
  };

  let res;
  try {
    res = await paytechFetch('/payment/request-payment', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        API_KEY: process.env.PAYTECH_API_KEY,
        API_SECRET: process.env.PAYTECH_API_SECRET
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    return { ok: false, error: `Erreur réseau vers PayTech: ${err.message}` };
  }

  let parsed;
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, error: `PayTech a répondu ${res.status} (réponse non JSON)` };
  }

  if (parsed.success !== 1 || !parsed.token) {
    return { ok: false, error: parsed.message || `PayTech a répondu ${res.status} (success=${parsed.success})` };
  }

  const checkoutUrl = parsed.redirect_url || parsed.redirectUrl;
  if (!checkoutUrl) {
    return { ok: false, error: 'PayTech: réponse sans redirect_url' };
  }

  return { ok: true, providerReference: parsed.token, checkoutUrl, status: 'pending' };
}

/**
 * Parses the IPN body (form-encoded by default, JSON possible) and verifies
 * the dual signature scheme (HMAC preferred, SHA256-of-keys fallback).
 */
function verifyAndParseIPN(req, rawBody) {
  const apiKey = process.env.PAYTECH_API_KEY;
  const apiSecret = process.env.PAYTECH_API_SECRET;
  if (!apiKey || !apiSecret) {
    return { ok: false, error: 'PAYTECH_API_KEY/PAYTECH_API_SECRET non configurés' };
  }

  const ct = req.headers['content-type'] || '';
  let body;
  if (ct.includes('application/x-www-form-urlencoded')) {
    body = Object.fromEntries(new URLSearchParams(rawBody.toString('utf-8')));
  } else {
    try {
      body = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      return { ok: false, error: 'PayTech: corps de requête illisible' };
    }
  }

  // Method 1: HMAC mode (preferred, present only if dashboard toggle is on)
  if (body.hmac_compute) {
    const message = `${body.item_price}|${body.ref_command}|${apiKey}`;
    const expected = crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
    const a = Buffer.from(body.hmac_compute);
    const b = Buffer.from(expected);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return { ok: true, body };
    }
    // fall through to method 2 in case both modes are active
  }

  // Method 2: SHA256-of-keys (default mode, always present)
  const expectedKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const expectedSecretHash = crypto.createHash('sha256').update(apiSecret).digest('hex');
  const aK = Buffer.from(body.api_key_sha256 || '');
  const bK = Buffer.from(expectedKeyHash);
  const aS = Buffer.from(body.api_secret_sha256 || '');
  const bS = Buffer.from(expectedSecretHash);
  const keyOk = aK.length === bK.length && crypto.timingSafeEqual(aK, bK);
  const secretOk = aS.length === bS.length && crypto.timingSafeEqual(aS, bS);
  if (keyOk && secretOk) return { ok: true, body };

  return { ok: false, error: 'PayTech: signature IPN invalide' };
}

/** Normalizes a verified IPN body into the same shape as bictorys.parseEvent(). */
function parseIPNEvent(body) {
  const status = String(body.type_event || '').toLowerCase();
  const amount = typeof body.item_price === 'string' ? parseFloat(body.item_price) : body.item_price;

  if (status === 'sale_complete') {
    return {
      providerReference: body.token,
      status: 'completed',
      reportedAmount: amount,
      reportedCurrency: body.currency,
      paymentReference: body.ref_command
    };
  }
  if (status === 'sale_canceled') {
    return {
      providerReference: body.token,
      status: 'failed',
      failureReason: status,
      reportedAmount: amount,
      reportedCurrency: body.currency,
      paymentReference: body.ref_command
    };
  }
  return null;
}

module.exports = { isConfigured, initiateCheckout, verifyAndParseIPN, parseIPNEvent };
