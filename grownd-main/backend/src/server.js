import { buildApp } from './app.js';
import { config } from './config.js';
import { paymentsEnabled, testMode, webhooksEnabled } from './payments/provider.js';
import { reconcileOverdue } from './services/orders.js';

export async function start() {
  const app = await buildApp();

  // Background safety net for payments: settles unpaid orders past their deadline even if a
  // webhook never arrives. Safe to run in every process; orders are leased, never shared.
  let reconcileTimer = null;
  if (paymentsEnabled) {
    reconcileTimer = setInterval(() => {
      reconcileOverdue().catch(err => app.log.warn({ err }, 'payment reconciliation failed; retrying next round'));
    }, config.reconcileSeconds * 1000);
    reconcileTimer.unref();
    app.log.info({ testMode, webhooks: webhooksEnabled }, 'online payments are on');
    if (!webhooksEnabled) {
      app.log.warn('Razorpay webhooks are off (no RAZORPAY_WEBHOOK_SECRET). Fine for local testing: payments are confirmed when customers return to the site. Production requires webhooks.');
    }
  } else if (config.production && config.razorpayKeyId) {
    app.log.error('online payments are OFF: production needs RAZORPAY_WEBHOOK_SECRET as well as the Razorpay keys');
  } else {
    app.log.warn('online payments are off: set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to turn them on');
  }

  // Graceful shutdown: stop taking new connections, let in-flight requests finish,
  // close the database pool, then exit. Forced after 10 seconds.
  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, 'shutting down');
    clearInterval(reconcileTimer);
    setTimeout(() => {
      app.log.error('forced exit: shutdown took longer than 10s');
      process.exit(1);
    }, 10_000).unref();
    await app.close();
    process.exit(0);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', err => app.log.error({ err }, 'unhandled promise rejection'));
  // Unknown state after an uncaught exception: log it and exit so the supervisor starts a clean process.
  process.on('uncaughtException', err => {
    app.log.fatal({ err }, 'uncaught exception');
    process.exit(1);
  });

  await app.listen({ port: config.port, host: config.host });
}
