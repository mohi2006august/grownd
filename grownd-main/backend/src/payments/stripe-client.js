import Stripe from 'stripe';

/** A Stripe client with production-safe defaults. `apiBase` points it at stripe-mock or a test double. */
export function makeStripeClient(secretKey, apiBase = '') {
  const options = {
    maxNetworkRetries: 2, // retried POSTs reuse an idempotency key, so a retry never double-charges
    timeout: 10_000,
    appInfo: { name: 'grownd-api' }
  };
  if (apiBase) {
    const u = new URL(apiBase);
    Object.assign(options, { host: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), protocol: u.protocol.replace(':', '') });
  }
  return new Stripe(secretKey, options);
}
