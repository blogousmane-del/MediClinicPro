// Bictorys hosted-checkout adapter (mobile money + card, XOF/UEMOA).
// https://docs.bictorys.com/
//
// Bictorys is fronted by AWS WAF (Bot Control) which blocks Node's default
// fetch (undici TLS fingerprint) with a 403 + HTML body. We spawn `curl`
// instead, with minimal args — do NOT add flags (-s, -A, --noproxy, etc.),
// that changes the TLS/HTTP fingerprint enough to get re-flagged.
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const crypto = require('node:crypto');

const execFileP = promisify(execFile);

const BICTORYS_API_URL_LIVE = 'https://api.bictorys.com';
const BICTORYS_API_URL_SANDBOX = 'https://api.test.bictorys.com';
const FETCH_TIMEOUT_MS = 15_000;
const MAX_RETRIES_ON_WAF_403 = 3;

function isConfigured() {
  return !!process.env.BICTORYS_API_KEY;
}

function apiUrl() {
  if (process.env.BICTORYS_BASE_URL) return process.env.BICTORYS_BASE_URL;
  const key = process.env.BICTORYS_API_KEY || '';
  return key.startsWith('test_') ? BICTORYS_API_URL_SANDBOX : BICTORYS_API_URL_LIVE;
}

function parseRawHttpResponse(raw) {
  // curl -i emits: STATUS LINE\r\nHEADERS\r\n\r\nBODY
  const sep = raw.indexOf('\r\n\r\n');
  const head = sep >= 0 ? raw.slice(0, sep) : raw;
  const body = sep >= 0 ? raw.slice(sep + 4) : '';
  const statusLine = head.split(/\r?\n/)[0] || '';
  const m = statusLine.match(/^HTTP\/[\d.]+\s+(\d+)/);
  return { status: m ? parseInt(m[1], 10) : 0, body };
}

async function bictorysFetch(url, { method, headers, body }) {
  const args = ['-i', '-X', method];
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (body) args.push('-d', body);
  args.push(url);

  let lastError = '';
  for (let attempt = 0; attempt < MAX_RETRIES_ON_WAF_403; attempt++) {
    try {
      const { stdout } = await execFileP('curl', args, {
        timeout: FETCH_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024
      });
      const { status, body: respBody } = parseRawHttpResponse(stdout);

      if (status === 403 && respBody.includes('Forbidden')) {
        lastError = `Bictorys WAF returned 403 (tentative ${attempt + 1}/${MAX_RETRIES_ON_WAF_403})`;
        if (attempt < MAX_RETRIES_ON_WAF_403 - 1) {
          await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
          continue;
        }
      }

      return { ok: status >= 200 && status < 300, status, text: respBody };
    } catch (err) {
      lastError = err.message;
      if (attempt < MAX_RETRIES_ON_WAF_403 - 1) {
        await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
      }
    }
  }

  return { ok: false, status: 0, text: lastError };
}

/**
 * @param {object} params
 * @param {number} params.amount
 * @param {string} [params.currency]
 * @param {string} params.description
 * @param {string} params.reference - our own reference, e.g. "sub-12" or "pay-45"
 * @param {string} params.returnUrl
 * @param {string} params.cancelUrl
 * @param {string} [params.customerEmail]
 * @param {string} [params.customerName]
 * @param {string} [params.customerPhone]
 */
async function initiateCheckout(params) {
  if (!isConfigured()) {
    return { ok: false, error: 'not_configured' };
  }

  if (params.returnUrl.includes('localhost') || params.cancelUrl.includes('localhost')) {
    return {
      ok: false,
      error: "Bictorys refuse les URL contenant 'localhost'. Utilisez ngrok ou un domaine public en développement."
    };
  }

  const merchantCountry = 'CI';
  const body = {
    amount: params.amount,
    currency: params.currency || 'XOF',
    country: merchantCountry,
    paymentReference: params.reference,
    successRedirectUrl: params.returnUrl,
    // Bictorys is case-sensitive on this field depending on API version — send both casings.
    errorRedirectUrl: params.cancelUrl,
    ErrorRedirectUrl: params.cancelUrl,
    customerObject: {
      name: params.customerName || 'Client MediClinic',
      email: params.customerEmail || '',
      phone: params.customerPhone || '',
      city: 'Abidjan',
      country: merchantCountry,
      locale: 'fr-FR'
    }
  };

  const url = `${apiUrl()}/pay/v1/charges`;
  const res = await bictorysFetch(url, {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.BICTORYS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const isWaf = res.status === 403 && res.text.includes('Forbidden');
    return {
      ok: false,
      error: isWaf
        ? 'Bictorys a bloqué la requête (WAF, 3 tentatives épuisées).'
        : `Bictorys a répondu ${res.status}: ${res.text.slice(0, 300)}`
    };
  }

  let data;
  try {
    data = JSON.parse(res.text);
  } catch {
    return { ok: false, error: 'Bictorys: réponse JSON invalide' };
  }

  const txId = data.transactionId || data.chargeId;
  const checkoutUrl = data.link || data.redirectUrl;
  if (!txId || !checkoutUrl) {
    return { ok: false, error: 'Bictorys: réponse incomplète (transactionId/link manquant)' };
  }

  return { ok: true, providerReference: txId, checkoutUrl, status: 'pending' };
}

function verifyWebhookSignature(req, rawBody) {
  const secret = process.env.BICTORYS_WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: 'BICTORYS_WEBHOOK_SECRET non configuré' };

  const sig = req.headers['x-webhook-signature'];
  const ts = req.headers['x-webhook-timestamp'];

  // Mode 1: HMAC (preferred)
  if (sig && ts) {
    let tsNum = parseInt(ts, 10);
    if (tsNum > 0 && tsNum < 10_000_000_000) tsNum *= 1000;
    if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60_000) {
      return { ok: false, error: 'Bictorys: horodatage hors tolérance (±5min)' };
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${ts}.${rawBody.toString('utf-8')}`)
      .digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, error: 'Bictorys: signature HMAC invalide' };
    }
    return { ok: true };
  }

  // Mode 2: static X-Secret-Key fallback
  const staticKey = req.headers['x-secret-key'];
  if (!staticKey) {
    return { ok: false, error: 'Bictorys: aucun en-tête de signature (X-Webhook-Signature/X-Secret-Key)' };
  }
  const a = Buffer.from(staticKey);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: 'Bictorys: X-Secret-Key invalide' };
  }
  return { ok: true };
}

function parseEvent(body) {
  if (!body) return null;
  const id = body.transactionId || body.chargeId;
  if (!id) return null;

  const rawStatus = String(body.status || body.event || '').toLowerCase();

  if (rawStatus.includes('succeed') || rawStatus === 'succeeded' || rawStatus === 'payment.succeeded') {
    return {
      providerReference: id,
      status: 'completed',
      reportedAmount: typeof body.amount === 'number' ? body.amount : undefined,
      reportedCurrency: body.currency,
      paymentReference: body.paymentReference
    };
  }
  if (rawStatus.includes('fail') || rawStatus.includes('cancel')) {
    return {
      providerReference: id,
      status: 'failed',
      failureReason: rawStatus,
      reportedAmount: typeof body.amount === 'number' ? body.amount : undefined,
      reportedCurrency: body.currency,
      paymentReference: body.paymentReference
    };
  }
  return null; // pending/processing → ignore
}

module.exports = { isConfigured, initiateCheckout, verifyWebhookSignature, parseEvent };
