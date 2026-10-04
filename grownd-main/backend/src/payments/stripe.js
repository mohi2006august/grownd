// The only file that knows about Stripe. Everything else works with the small, provider-neutral
// interface exported here, so a different provider can be swapped in by replacing this module.
//
// Customers pay on Stripe's hosted Checkout page: card details never reach GROWND's servers.
import { config } from '../config.js';
import { concurrencyLimit } from '../lib/cache.js';
import { makeStripeClient } from './stripe-client.js';

// Signed webhooks are the source of truth, so production refuses to take payments without them.
// Locally the secret key is enough: payments are confirmed when the customer comes back to the
// site, and the background reconciler settles anything left over.
export const webhooksEnabled = Boolean(config.stripeWebhookSecret);
export const paymentsEnabled = Boolean(config.stripeSecretKey) && (webhooksEnabled || !config.production);
export const testMode = /^(sk|rk)_test_/.test(config.stripeSecretKey);

/** Thrown when too many checkouts are starting at once in this process; the caller should retry shortly. */
export class ProviderBusyError extends Error {}

// Starting a checkout waits on Stripe and counts against its API rate limit, so cap how many run
// at once per process. Past the cap, callers get a quick "try again" instead of piling up.
const checkoutSlots = concurrencyLimit(100);

const stripe = paymentsEnabled ? makeStripeClient(config.stripeSecretKey, config.stripeApiBase) : null;

function requireStripe() {
  if (!stripe) throw new Error('Online payments are not configured.');
  return stripe;
}

/** The provider-neutral view of a checkout session. */
function toCheckout(session) {
  const pi = session.payment_intent;
  return {
    id: session.id,
    url: session.url,
    status: session.status, // 'open' | 'complete' | 'expired'
    paid: session.payment_status === 'paid',
    paymentIntentId: typeof pi === 'string' ? pi : pi?.id ?? null,
    orderId: session.metadata?.order_id ?? session.client_reference_id ?? null,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null
  };
}

/**
 * Starts a hosted checkout for one order.
 * `attempt` makes the idempotency key unique per attempt, so a network retry of the same
 * attempt can never create a second session.
 */
export async function createCheckout(params) {
  const client = requireStripe();
  if (!checkoutSlots.tryAcquire()) throw new ProviderBusyError('Too many checkouts are starting at once.');
  try {
    return await startSession(client, params);
  } finally {
    checkoutSlots.release();
  }
}

async function startSession(client, { orderId, attempt, email, currency, unitAmount, quantity, name, description, successUrl, cancelUrl, expiresAt }) {
  const session = await client.checkout.sessions.create({
    mode: 'payment',
    customer_email: email,
    client_reference_id: orderId,
    metadata: { order_id: orderId },
    // receipt_email makes Stripe send the receipt in live mode whatever the account's email settings.
    payment_intent_data: { metadata: { order_id: orderId }, description: name, receipt_email: email },
    line_items: [{
      quantity,
      price_data: { currency, unit_amount: unitAmount, product_data: { name, ...(description && { description }) } }
    }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    expires_at: Math.floor(expiresAt.getTime() / 1000)
  }, { idempotencyKey: `order-${orderId}-${attempt}` });
  return toCheckout(session);
}

export async function getCheckout(sessionId) {
  return toCheckout(await requireStripe().checkout.sessions.retrieve(sessionId));
}

/** Ends an open checkout so it can no longer be paid. Returns the session as it now stands. */
export async function expireCheckout(sessionId) {
  try {
    return toCheckout(await requireStripe().checkout.sessions.expire(sessionId));
  } catch (err) {
    // Already complete or expired: report the real state instead of failing.
    if (err?.type === 'StripeInvalidRequestError') return getCheckout(sessionId);
    throw err;
  }
}

/** Refunds a payment in full. */
export async function refundPayment(paymentIntentId, orderId) {
  const refund = await requireStripe().refunds.create(
    { payment_intent: paymentIntentId, metadata: { order_id: orderId } },
    { idempotencyKey: `refund-${paymentIntentId}` }
  );
  return { id: refund.id, amount: refund.amount, status: refund.status };
}

export function dashboardUrl(paymentIntentId) {
  return paymentIntentId ? `https://dashboard.stripe.com/${testMode ? 'test/' : ''}payments/${paymentIntentId}` : null;
}

/**
 * Verifies a webhook delivery and turns it into a provider-neutral event, or null for event
 * types we do not act on. Throws if the signature is not valid.
 */
export function parseWebhook(rawBody, signature) {
  const event = requireStripe().webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
  const obj = event.data.object;
  const base = { id: event.id, providerType: event.type };
  switch (event.type) {
    case 'checkout.session.completed':
      return { ...base, type: 'checkout.completed', checkout: toCheckout(obj) };
    case 'checkout.session.async_payment_succeeded':
      return { ...base, type: 'checkout.async_succeeded', checkout: toCheckout(obj) };
    case 'checkout.session.async_payment_failed':
      return { ...base, type: 'checkout.async_failed', checkout: toCheckout(obj) };
    case 'checkout.session.expired':
      return { ...base, type: 'checkout.expired', checkout: toCheckout(obj) };
    case 'charge.refunded': {
      const pi = obj.payment_intent;
      return { ...base, type: 'payment.refunded', paymentIntentId: typeof pi === 'string' ? pi : pi?.id, amountRefunded: obj.amount_refunded, fullyRefunded: obj.refunded === true };
    }
    default:
      return null;
  }
}
