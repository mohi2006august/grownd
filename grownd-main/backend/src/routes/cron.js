import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { reconcileOverdue } from '../services/orders.js';

function sameSecret(given, expected) {
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Scheduled jobs. Vercel Cron calls these with "Authorization: Bearer <CRON_SECRET>"; any other
// scheduler can do the same. Long-running servers also run the reconciler on a timer (server.js).
export default async function cronRoutes(app) {
  app.get('/api/cron/reconcile', { config: { rateLimit: false } }, async request => {
    if (!config.cronSecret || !sameSecret(request.headers.authorization || '', `Bearer ${config.cronSecret}`)) {
      throw new HttpError(401, 'Not allowed.');
    }
    // Rows are leased while being settled, so each round picks up new ones; stop when a round is short.
    let settled = 0;
    for (let round = 0; round < 20; round++) {
      const n = await reconcileOverdue(100);
      settled += n;
      if (n < 100) break;
    }
    return { settled };
  });
}
