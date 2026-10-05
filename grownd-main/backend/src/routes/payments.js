import { badRequest, notFound } from '../lib/errors.js';
import { contactDetails, int, isId } from '../lib/validate.js';
import { parseWebhook, webhooksEnabled } from '../payments/provider.js';
import { cancelBooking, createBooking, getPublicOrder, handleProviderEvent, isOrderId, startRequestPayment } from '../services/orders.js';

function cleanBooking(body) {
  const b = body || {}, errors = {};
  const contact = contactDetails(errors, b, 'We need a yes here before we can email you about this booking.');
  const booking = {
    ...contact,
    eventId: isId(b.eventId) ? Number(b.eventId) : null,
    kids: int(errors, 'kids', b.kids, { min: 1, max: 200, required: true, label: 'Number of children' })
  };
  if (!booking.eventId) errors.eventId = 'Pick a date to book.';
  if (Object.keys(errors).length) throw badRequest(errors);
  return booking;
}

const orderGone = () => notFound('We could not find that order.');

export default async function paymentRoutes(app) {
  // Book places on a dated session and get the payment page to send the customer to.
  app.post('/api/checkout', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } }
  }, async (request, reply) => {
    const result = await createBooking(cleanBooking(request.body));
    reply.code(201);
    return result;
  });

  // The customer's own page for an order (confirmation, or a payment link). The id is unguessable.
  app.get('/api/orders/:id', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    if (!isOrderId(request.params.id)) throw orderGone();
    const order = await getPublicOrder(request.params.id, { sync: request.query.sync === '1' });
    if (!order) throw orderGone();
    reply.header('Cache-Control', 'no-store');
    return order;
  });

  // Pay a payment link the team sent.
  app.post('/api/orders/:id/pay', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } }
  }, async request => {
    if (!isOrderId(request.params.id)) throw orderGone();
    return startRequestPayment(request.params.id);
  });

  // Came back from the payment page without paying: release the held places straight away.
  app.post('/api/orders/:id/cancel', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } }
  }, async request => {
    if (!isOrderId(request.params.id)) throw orderGone();
    const order = await cancelBooking(request.params.id);
    if (!order) throw orderGone();
    return order;
  });

  // Payment provider webhooks. Verified by signature, so they need the exact raw body.
  app.register(async function webhook(app) {
    app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 1024 * 1024 }, (request, body, done) => done(null, body));
    app.post('/api/payments/webhook', {
      bodyLimit: 1024 * 1024,
      config: { rateLimit: false } // never throttle the payment provider
    }, async (request, reply) => {
      if (!webhooksEnabled) return reply.code(503).send({ error: 'Webhooks are not configured: set RAZORPAY_WEBHOOK_SECRET.' });
      let event;
      try {
        event = parseWebhook(request.body, request.headers);
      } catch {
        return reply.code(400).send({ error: 'Invalid signature.' });
      }
      await handleProviderEvent(event); // a thrown error answers 500, and the provider retries later
      return { received: true };
    });
  });
}
