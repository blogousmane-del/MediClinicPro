# PayPal subscription renewal — design

## Problem
Clinics can only renew/upgrade their MediClinic subscription (Clinique/Hôpital) via Mobile Money (Wave/Orange Money/MTN through Bictorys/PayTech). The clinic owner has a PayPal Business account ready and wants it usable as an alternative way to pay their own subscription — not for patient checkout, not for deposits.

## Scope
- New provider `paypal` for `POST /financials/subscription/checkout` only. Patient payments (`payments` table) and deposits (`deposits` table) are untouched — same as before, cash/Bictorys/PayTech only.
- PayPal does not support XOF (FCFA) as a settlement currency. Amount is converted FCFA → USD at checkout time using a fixed, admin-configured rate (`XOF_TO_USD_RATE` env var) — no live forex API dependency.
- Presented as an explicit alternative to Mobile Money, not folded into `initiateCheckoutWithFailover`'s automatic Bictorys→PayTech failover chain. The admin picks one or the other; no automatic PayPal fallback if Mobile Money fails.
- Out of scope: patient checkout, deposits, any UI/config for changing the FCFA↔USD rate from the admin dashboard (it's an env var, same tier as other payment config).

## Architecture

### `backend/services/payments/paypal.js` (new)
Same shape as `bictorys.js`/`paytech.js`:
- `isConfigured()` — true if `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` are set.
- `getAccessToken()` — internal, OAuth2 client-credentials grant against PayPal's `/v1/oauth2/token`, cached in memory until expiry.
- `initiateCheckout(params)` — converts `params.amount` (FCFA) to USD via `XOF_TO_USD_RATE`, creates a PayPal Order (`intent: CAPTURE`, `reference_id: params.reference`), returns `{ok: true, provider: 'paypal', checkoutUrl: <approve link>, providerReference: <orderId>}` matching the existing provider contract.
- `captureOrder(orderId)` — calls PayPal's Capture Order endpoint. Idempotent from PayPal's side (capturing an already-captured order returns its existing status, doesn't double-charge).
- `verifyWebhookSignature(req, rawBody)` — calls PayPal's Verify Webhook Signature API with `PAYPAL_WEBHOOK_ID` + the `PAYPAL-TRANSMISSION-*` headers.
- `parseEvent(body)` — normalizes `PAYMENT.CAPTURE.COMPLETED` (status: paid) / `PAYMENT.CAPTURE.DENIED` (status: failed) into `{status, reportedAmount, paymentReference}`, same shape `fulfillEvent` already expects. `reportedAmount` is in USD.

### `backend/routes/financials.js` — `POST /subscription/checkout`
Gains an optional `provider` field in the request body: `'mobile_money'` (default, current behavior — `initiateCheckoutWithFailover`) or `'paypal'` (new — calls `paypal.initiateCheckout()` directly, no failover). Same pending `subscription_payments` row creation either way.

### `backend/routes/webhooks.js`
- `POST /paypal` (new, alongside `/bictorys`/`/paytech`) — verifies signature, reuses `isDuplicateEvent`/`fulfillEvent` **unchanged**. `fulfillSubscriptionEvent` and `fulfillEvent`'s dispatch-by-reference-prefix logic need no changes at all — they already work in FCFA-agnostic terms via `amountMatches`.
- `amountMatches` gains a `provider === 'paypal'` branch: converts `expected` (FCFA, from the `subscription_payments` row) to USD using the same `XOF_TO_USD_RATE`, compares against `reportedAmount` (USD) with ~2% tolerance (PayPal fees/rounding).
- `GET /paypal/return` (new) — the browser lands here after the buyer approves on PayPal's hosted page (`?token=<orderId>`). Calls `paypal.captureOrder(orderId)` to trigger the actual capture, then redirects the browser to `${APP_URL}/` regardless of outcome (fulfillment itself happens via the webhook above, not here — this route's only job is to trigger the capture, matching the flow's separation of concerns: capture-trigger is unauthenticated/browser-facing, fulfillment is server-to-server and signature-verified).

## Data flow
1. Admin (Settings > Abonnement) clicks "Payer par PayPal" → `POST /financials/subscription/checkout` `{provider: 'paypal', months, planId}` → pending `subscription_payments` row → PayPal Order created (USD) → `checkoutUrl` returned.
2. Frontend's existing `PaymentCheckoutModal` opens `checkoutUrl` (no structural change — it already just opens whatever URL the checkout endpoint returns).
3. Admin approves on PayPal's page → redirected to `GET /api/webhooks/paypal/return?token=<orderId>` → server captures the order → browser redirected back into the app.
4. PayPal sends `POST /api/webhooks/paypal` (`PAYMENT.CAPTURE.COMPLETED`) → signature verified → `fulfillSubscriptionEvent` runs exactly as it does for Bictorys/PayTech today → `clinics.plan`/`subscription_expires_at` updated, `activity_logs` row written.

## Config (`.env`, all optional — feature degrades to "unavailable" with a clear French error if unset, same as Bictorys/PayTech)
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- `PAYPAL_MODE` (`sandbox` | `live`) — selects PayPal's API base URL
- `PAYPAL_WEBHOOK_ID` — required to verify incoming webhook signatures
- `XOF_TO_USD_RATE` — e.g. `600` (1 USD ≈ 600 FCFA), fixed conversion rate

## Frontend
- Subscription renewal screen (Settings' billing tab) gains a "Payer par PayPal" button next to the existing Mobile Money button. Clicking it calls the checkout endpoint with `provider: 'paypal'`; everything downstream (`PaymentCheckoutModal`, success/failure toasts) is unchanged.
- No new component needed — this is a second call site for existing checkout-initiation code, not a new UI pattern.

## Error handling
- `paypal.isConfigured() === false` → checkout endpoint returns the same "not configured yet" French error pattern as Bictorys/PayTech, button can be hidden/disabled client-side if desired (mirrors how Mobile Money is hidden when neither provider is configured).
- Capture failure at the return-URL step (e.g. buyer's PayPal balance issue after approval) → `subscription_payments` row stays `pending`; a manual admin retry via a fresh checkout resolves it.

> **Correction (revue finale, 2026-08-03).** Two claims in the paragraph above were wrong, and the implementation departs from them deliberately:
> 1. *"the webhook (if PayPal still sends a `DENIED` event)"* — PayPal emits no `PAYMENT.CAPTURE.*` event when no capture was ever attempted, so a buyer who approves and then closes the tab would never be captured and never recovered. The implementation therefore also subscribes `CHECKOUT.ORDER.APPROVED` and drives the capture from the signed webhook; the browser return route is a convenience, not the sole trigger.
> 2. *"there's no risk of 'charged but not activated'"* — this is inverted. The webhook confirms *after* the charge, so charged-but-not-activated is precisely the residual risk class this feature introduces (a killed serverless function mid-fulfillment, a conversion-rate change mid-flight, a rejected amount check). The mitigations are: dedup-after-fulfillment on the PayPal route so a redelivery can heal an interrupted request, an explicit `maxDuration`, and the `amount_usd` column freezing the quoted USD figure at checkout. See the plan's "Règles d'exploitation" section for the reconciliation procedure.

## Testing
- `node -c` on all touched backend files.
- Sandbox PayPal account: full round-trip (checkout → approve on PayPal sandbox → capture → webhook → `clinics.plan`/`subscription_expires_at` updated) before going live.
- Confirm existing Mobile Money renewal path is untouched (`provider` defaults to `'mobile_money'` when omitted, matching today's request shape).
