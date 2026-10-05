// The only file that knows about Razorpay. Everything else uses the small, provider-neutral
// interface exported here (via ./provider.js), so another provider can be swapped in by replacing
// this module.
//
// Customers pay on Razorpay's hosted Payment Link page (UPI, cards, netbanking, wallets) and come
// back to the site: card and UPI details never reach GROWND's servers.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { concurrencyLimit } from '../lib/cache.js';

// Signed webhooks are the source of truth, so production refuses to take payments without them.
// Locally the keys are enough: payments are confirmed when the customer comes back to the site,
// and the background reconciler settles anything left over.
export const webhooksEnabled = Boolean(config.razorpayWebhookSecret);
export const paymentsEnabled = Boolean(config.razorpayKeyId && config.razorpayKeySecret) && (webhooksEnabled || !config.production);
export const testMode = config.razorpayKeyId.startsWith('rzp_test_');

/** Thrown when too many checkouts are starting at once in this process; the caller should retry shortly. */
export class ProviderBusyError extends Error {}

/** An error answered by Razorpay's API (or no answer at all, when `status` is 0). */
export class RazorpayError extends Error {
  constructor(status, code, description) {
    super(`Razorpay ${status || 'network error'}: ${description || code || 'no response'}`);
    this.status = status;
    this.code = code;
    this.description = description || '';
  }
}

// Starting a checkout waits on Razorpay and counts against its API rate limit, so cap how many run
// at once per process. Past the cap, callers get a quick "try again" instead of piling up.
const checkoutSlots = concurrencyLimit(100);

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const AUTH = `Basic ${Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64')}`;
const TIMEOUT_MS = 10_000;

/**
 * Calls the Razorpay API. Network failures, 429 and 5xx are retried (twice by default). Retrying is
 * safe for everything sent here: payment links carry a unique reference_id, cancelling twice changes
 * nothing, and Razorpay never refunds more than was paid.
 */
async function api(method, path, body, { retries = 2 } = {}) {
  if (!paymentsEnabled) throw new Error('Online payments are not configured.');
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(`${config.razorpayApiBase}/v1${path}`, {
        method,
        headers: { Authorization: AUTH, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (err) {
      if (attempt < retries) { await pause(attempt); continue; }
      throw Object.assign(new RazorpayError(0, 'NETWORK', err.message), { cause: err });
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if ((res.status === 429 || res.status >= 500) && attempt < retries) { await pause(attempt); continue; }
    throw new RazorpayError(res.status, data.error?.code, data.error?.description);
  }
}
const pause = attempt => new Promise(resolve => setTimeout(resolve, 250 * 2 ** attempt));

// ---------------------------------------------------------------------------
// provider-neutral interface
// ---------------------------------------------------------------------------

/** The provider-neutral view of a payment link. */
function toCheckout(link, paymentId = null) {
  const status = link.status === 'paid' ? 'complete' : link.status === 'cancelled' || link.status === 'expired' ? 'expired' : 'open';
  const captured = (link.payments || []).find(p => p.status === 'captured');
  return {
    id: link.id,
    url: link.short_url,
    status, // 'open' | 'complete' | 'expired'
    paid: link.status === 'paid',
    paymentIntentId: paymentId || captured?.payment_id || null,
    orderId: link.notes?.order_id ?? null,
    expiresAt: link.expire_by ? new Date(link.expire_by * 1000) : null
  };
}

/** Razorpay accepts 10-15 digit phone numbers, optionally with +country code. Anything else is left out. */
function contactNumber(phone) {
  const digits = String(phone || '').replace(/[\s().-]/g, '');
  return /^\+?\d{10,15}$/.test(digits) ? digits : undefined;
}

/**
 * Starts a hosted checkout (a Payment Link) for one order. `attempt` makes the link's reference_id
 * unique per attempt, so a retried request can never create a second link for the same attempt.
 */
export async function createCheckout(params) {
  if (!checkoutSlots.tryAcquire()) throw new ProviderBusyError('Too many checkouts are starting at once.');
  try {
    return await createLink(params);
  } finally {
    checkoutSlots.release();
  }
}

async function createLink({ orderId, attempt, customer, currency, unitAmount, quantity, name, description, successUrl, expiresAt }) {
  const referenceId = `${orderId.replace(/-/g, '')}-${crypto.createHash('sha256').update(String(attempt)).digest('hex').slice(0, 7)}`;
  const body = {
    amount: unitAmount * quantity,
    currency: currency.toUpperCase(),
    accept_partial: false,
    description: [name, description].filter(Boolean).join(' · ').slice(0, 2048),
    reference_id: referenceId,
    customer: { name: customer.name?.slice(0, 120), email: customer.email, contact: contactNumber(customer.phone) },
    // The customer is sent straight to the link, so Razorpay should not text or email it too.
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { order_id: orderId },
    callback_url: successUrl,
    callback_method: 'get',
    expire_by: Math.floor(expiresAt.getTime() / 1000)
  };
  try {
    return toCheckout(await api('POST', '/payment_links', body));
  } catch (err) {
    // A retried request whose first try did reach Razorpay: use the link it already made.
    if (err instanceof RazorpayError && err.status === 400 && /reference/i.test(err.description)) {
      const found = await api('GET', `/payment_links?reference_id=${encodeURIComponent(referenceId)}`);
      const link = found.payment_links?.[0];
      if (link) return toCheckout(link);
    }
    throw err;
  }
}

export async function getCheckout(linkId) {
  return toCheckout(await api('GET', `/payment_links/${encodeURIComponent(linkId)}`));
}

/** Ends an open checkout so it can no longer be paid. Returns the link as it now stands. */
export async function expireCheckout(linkId) {
  try {
    return toCheckout(await api('POST', `/payment_links/${encodeURIComponent(linkId)}/cancel`));
  } catch (err) {
    // Already paid, cancelled or expired: report the real state instead of failing.
    if (err instanceof RazorpayError && err.status === 400) return getCheckout(linkId);
    throw err;
  }
}

/** Refunds a payment in full. */
export async function refundPayment(paymentId, orderId) {
  try {
    const refund = await api('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { speed: 'normal', notes: { order_id: orderId } });
    return { id: refund.id, amount: refund.amount, status: refund.status };
  } catch (err) {
    // A retried refund whose first try went through.
    if (err instanceof RazorpayError && err.status === 400 && /fully refunded/i.test(err.description)) return { id: null, amount: null, status: 'processed' };
    throw err;
  }
}

export function dashboardUrl(paymentId) {
  return paymentId ? `https://dashboard.razorpay.com/app/payments/${paymentId}` : null;
}

/** True when `signature` is the HMAC-SHA256 of `body` with `secret`, compared in constant time. */
function validSignature(body, signature, secret) {
  const expected = Buffer.from(crypto.createHmac('sha256', secret).update(body).digest('hex'));
  const given = Buffer.from(String(signature || ''));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

/**
 * Verifies a webhook delivery and turns it into a provider-neutral event, or null for event
 * types we do not act on. Throws if the signature is not valid.
 */
export function parseWebhook(rawBody, headers) {
  if (!validSignature(rawBody, headers['x-razorpay-signature'], config.razorpayWebhookSecret)) throw new Error('Invalid signature.');
  const event = JSON.parse(rawBody.toString('utf8'));
  // Razorpay sends a unique id per event in a header; fall back to the body's own fingerprint.
  const id = headers['x-razorpay-event-id'] || `body-${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
  const base = { id, providerType: event.event };
  const p = event.payload || {};
  switch (event.event) {
    case 'payment_link.paid':
      return { ...base, type: 'checkout.completed', checkout: toCheckout(p.payment_link.entity, p.payment?.entity?.id) };
    case 'payment_link.expired':
    case 'payment_link.cancelled':
      return { ...base, type: 'checkout.expired', checkout: toCheckout(p.payment_link.entity) };
    case 'refund.processed': {
      const payment = p.payment?.entity, refund = p.refund?.entity;
      const amountRefunded = payment?.amount_refunded ?? refund?.amount ?? 0;
      return {
        ...base, type: 'payment.refunded', paymentIntentId: refund?.payment_id || payment?.id, amountRefunded,
        fullyRefunded: payment ? payment.refund_status === 'full' || amountRefunded >= payment.amount : false
      };
    }
    default:
      return null;
  }
}
