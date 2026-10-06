// End-to-end tests of booking and paying through Razorpay: the real API and order rules against a
// real Postgres, with a fake Razorpay standing in for the real one (no network, no money).
//
// Needs TEST_DATABASE_URL pointing at a Postgres the tests may wipe (localhost only, unless
// TEST_DATABASE_ALLOW_WIPE=1). Run from the app folder: npm test
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const DB = process.env.TEST_DATABASE_URL;
const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const KEY_ID = 'rzp_test_grownd123', KEY_SECRET = 'test-key-secret', WEBHOOK_SECRET = 'test-webhook-secret';

const localDb = DB && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(DB).hostname);
const skip = !DB ? 'set TEST_DATABASE_URL to run these tests' : !localDb && process.env.TEST_DATABASE_ALLOW_WIPE !== '1'
  ? 'TEST_DATABASE_URL is not on localhost; set TEST_DATABASE_ALLOW_WIPE=1 if it may really be wiped' : false;

// ---------------------------------------------------------------------------
// a fake Razorpay
// ---------------------------------------------------------------------------

const rzp = {
  links: new Map(), payments: new Map(), seq: 0, failNext: 0, loseNextCreate: false,
  pay(linkId) {
    const link = this.links.get(linkId);
    const id = `pay_${++this.seq}`;
    this.payments.set(id, { id, amount: link.amount, amount_refunded: 0, refund_status: null, status: 'captured' });
    link.status = 'paid';
    link.amount_paid = link.amount;
    link.payments = [{ payment_id: id, status: 'captured', amount: link.amount }];
    return id;
  },
  forOrder(orderId) { return [...this.links.values()].filter(l => l.notes.order_id === orderId); }
};

function fakeRazorpay(req, res, body) {
  const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
  const error = (status, description) => send(status, { error: { code: 'BAD_REQUEST_ERROR', description } });
  if (req.headers.authorization !== `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`) return error(401, 'Authentication failed');
  if (rzp.failNext > 0) { rzp.failNext--; return error(500, 'Server error'); }
  const url = new URL(req.url, 'http://x');
  let m;
  if (req.method === 'POST' && url.pathname === '/v1/payment_links') {
    if ([...rzp.links.values()].some(l => l.reference_id === body.reference_id)) return error(400, 'Payment Link with given reference_id already exists');
    if (body.amount < 100) return error(400, 'The amount must be atleast INR 1.00');
    if (body.expire_by < Date.now() / 1000 + 15 * 60) return error(400, 'expire_by should be at least 15 mins after current time');
    const n = ++rzp.seq;
    const link = { id: `plink_${n}`, short_url: `https://rzp.io/i/test${n}`, status: 'created', amount_paid: 0, payments: null, ...body };
    rzp.links.set(link.id, link);
    if (rzp.loseNextCreate) { rzp.loseNextCreate = false; return error(502, 'Bad gateway'); } // created, but the answer is lost
    return send(200, link);
  }
  if (req.method === 'GET' && url.pathname === '/v1/payment_links') {
    const ref = url.searchParams.get('reference_id');
    return send(200, { payment_links: [...rzp.links.values()].filter(l => !ref || l.reference_id === ref) });
  }
  if ((m = /^\/v1\/payment_links\/([^/]+)(\/cancel)?$/.exec(url.pathname))) {
    const link = rzp.links.get(m[1]);
    if (!link) return error(400, 'The id provided does not exist');
    if (m[2]) {
      if (link.status !== 'created') return error(400, `Payment Link cannot be cancelled as it is ${link.status}`);
      link.status = 'cancelled';
    }
    return send(200, link);
  }
  if (req.method === 'POST' && (m = /^\/v1\/payments\/([^/]+)\/refund$/.exec(url.pathname))) {
    const payment = rzp.payments.get(m[1]);
    if (!payment) return error(400, 'The id provided does not exist');
    if (payment.amount_refunded >= payment.amount) return error(400, 'The payment has been fully refunded already');
    const amount = payment.amount - payment.amount_refunded;
    payment.amount_refunded = payment.amount;
    payment.refund_status = 'full';
    return send(200, { id: `rfnd_${++rzp.seq}`, amount, payment_id: payment.id, status: 'processed', notes: body.notes });
  }
  return error(404, 'Not found');
}

// ---------------------------------------------------------------------------
// setup
// ---------------------------------------------------------------------------

let app, orders, sql, server;

async function webhook(event, payload, { eventId = crypto.randomUUID(), secret = WEBHOOK_SECRET } = {}) {
  const body = JSON.stringify({ entity: 'event', event, payload, created_at: Math.floor(Date.now() / 1000) });
  return app.inject({
    method: 'POST', url: '/api/payments/webhook', payload: body,
    headers: {
      'content-type': 'application/json',
      'x-razorpay-signature': crypto.createHmac('sha256', secret).update(body).digest('hex'),
      'x-razorpay-event-id': eventId
    }
  });
}
const paidPayload = (link, paymentId) => ({ payment_link: { entity: link }, payment: { entity: rzp.payments.get(paymentId) } });

let eventId;
async function freshEvent(places = 10) {
  const [e] = await sql`
    insert into events (mission_slug, date, time, timezone, venue, city, places_left)
    values ('slime-chemistry', current_date + 7, '10:00', 'IST', 'Community Hall', 'Mumbai', ${places}) returning id`;
  return Number(e.id);
}
async function book(kids = 3, event = eventId) {
  return app.inject({
    method: 'POST', url: '/api/checkout',
    payload: { eventId: event, kids, name: 'Asha Rao', email: 'asha@example.com', phone: '98765 43210', consent: true }
  });
}
const orderRow = async id => (await sql`select * from orders where id = ${id}`)[0];
const placesLeft = async (id = eventId) => (await sql`select places_left from events where id = ${id}`)[0].places_left;

describe('payments with Razorpay', { skip, concurrency: false }, () => {
  before(async () => {
    server = http.createServer((req, res) => {
      let raw = '';
      req.on('data', c => (raw += c)).on('end', () => fakeRazorpay(req, res, raw ? JSON.parse(raw) : {}));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

    // A clean database with every migration applied.
    sql = postgres(DB, { max: 2, onnotice() {} });
    await sql.unsafe('drop schema if exists public cascade; create schema public; drop schema if exists extensions cascade;');
    execFileSync(process.execPath, ['scripts/migrate.js'], { cwd: BACKEND, env: { ...process.env, MIGRATION_DATABASE_URL: DB }, stdio: 'pipe' });
    await sql`insert into settings (key, value) values ('currency', 'INR'), ('timezone', 'IST')`;
    await sql`update missions set price = 1500 where slug = 'slime-chemistry'`;
    eventId = await freshEvent(10);

    Object.assign(process.env, {
      NODE_ENV: 'test', LOG_LEVEL: 'silent',
      DATABASE_URL: DB, SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'sb_publishable_test',
      SITE_URL: 'https://grownd.test',
      RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET,
      RAZORPAY_API_BASE: `http://127.0.0.1:${server.address().port}`
    });
    const { buildApp } = await import('../src/app.js'); // reads the settings above when first imported
    app = await buildApp();
    orders = await import('../src/services/orders.js');
  });

  after(async () => {
    await app?.close();
    await sql?.end();
    server?.close();
  });

  test('a booking holds its places and sends the customer to a Razorpay link', async () => {
    const res = await book(3);
    assert.equal(res.statusCode, 201, res.body);
    const { orderId, url } = res.json();
    assert.match(url, /^https:\/\/rzp\.io\//);
    const o = await orderRow(orderId);
    assert.equal(o.status, 'pending');
    assert.equal(o.places_held, 3);
    assert.equal(o.provider, 'razorpay');
    assert.equal(await placesLeft(), 7);
    const [link] = rzp.forOrder(orderId);
    assert.equal(link.amount, 1500 * 100 * 3);
    assert.equal(link.currency, 'INR');
    assert.equal(link.customer.contact, '9876543210');
    assert.equal(link.callback_url, `https://grownd.test/checkout?order=${orderId}&result=success`);
    assert.deepEqual(link.notify, { sms: false, email: false });
  });

  test('the paid webhook marks the order paid, and a repeat delivery changes nothing', async () => {
    const { orderId } = (await book(2)).json();
    const [link] = rzp.forOrder(orderId);
    const paymentId = rzp.pay(link.id);
    const eventIdHeader = crypto.randomUUID();
    for (let i = 0; i < 2; i++) {
      const res = await webhook('payment_link.paid', paidPayload(link, paymentId), { eventId: eventIdHeader });
      assert.equal(res.statusCode, 200, res.body);
    }
    const o = await orderRow(orderId);
    assert.equal(o.status, 'paid');
    assert.equal(o.payment_intent_id, paymentId);
    assert.equal(o.places_held, 2);
    const [{ n }] = await sql`select count(*)::int as n from payment_events where id = ${eventIdHeader}`;
    assert.equal(n, 1);
  });

  test('a webhook with a wrong signature is refused', async () => {
    const res = await webhook('payment_link.paid', {}, { secret: 'not-the-secret' });
    assert.equal(res.statusCode, 400);
  });

  test('coming back from Razorpay settles the order even before the webhook arrives', async () => {
    const { orderId } = (await book(1)).json();
    rzp.pay(rzp.forOrder(orderId)[0].id);
    const res = await app.inject({ url: `/api/orders/${orderId}?sync=1` });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().status, 'paid');
  });

  test('cancelling on the way back cancels the link and frees the places', async () => {
    const before = await placesLeft();
    const { orderId } = (await book(2)).json();
    assert.equal(await placesLeft(), before - 2);
    const res = await app.inject({ method: 'POST', url: `/api/orders/${orderId}/cancel` });
    assert.equal(res.json().status, 'cancelled');
    assert.equal(await placesLeft(), before);
    assert.equal(rzp.forOrder(orderId)[0].status, 'cancelled');
  });

  test('an expired link gives the places back', async () => {
    const before = await placesLeft();
    const { orderId } = (await book(1)).json();
    const link = rzp.forOrder(orderId)[0];
    link.status = 'expired';
    await webhook('payment_link.expired', { payment_link: { entity: link } });
    assert.equal((await orderRow(orderId)).status, 'expired');
    assert.equal(await placesLeft(), before);
  });

  test('the reconciler closes unpaid orders past their deadline, and records ones paid without a webhook', async () => {
    const before = await placesLeft();
    const unpaid = (await book(1)).json().orderId;
    const paid = (await book(1)).json().orderId;
    rzp.pay(rzp.forOrder(paid)[0].id);
    await sql`update orders set expires_at = now() - interval '10 minutes' where id in ${sql([unpaid, paid])}`;
    await orders.reconcileOverdue();
    assert.equal((await orderRow(unpaid)).status, 'expired');
    assert.equal(rzp.forOrder(unpaid)[0].status, 'cancelled');
    assert.equal((await orderRow(paid)).status, 'paid');
    assert.equal(await placesLeft(), before - 1);
  });

  test('a date cannot be oversold', async () => {
    const small = await freshEvent(2);
    const res = await book(3, small);
    assert.equal(res.statusCode, 409);
    assert.match(res.json().error, /Only 2 places are left/);
    assert.equal(await placesLeft(small), 2);
  });

  test('if Razorpay is down, the booking is dropped and its places come back', async () => {
    const before = await placesLeft();
    const [{ n: ordersBefore }] = await sql`select count(*)::int as n from orders`;
    rzp.failNext = 3; // the first try and both retries
    const res = await book(2);
    assert.equal(res.statusCode, 502);
    assert.equal(await placesLeft(), before);
    const [{ n }] = await sql`select count(*)::int as n from orders`;
    assert.equal(n, ordersBefore);
  });

  test('a retry after a lost answer reuses the link Razorpay already made', async () => {
    rzp.loseNextCreate = true;
    const res = await book(1);
    assert.equal(res.statusCode, 201, res.body);
    const { orderId, url } = res.json();
    const links = rzp.forOrder(orderId);
    assert.equal(links.length, 1);
    assert.equal(links[0].short_url, url);
  });

  test('a refund from the dashboard frees the places once, even when Razorpay also sends the webhook', async () => {
    const before = await placesLeft();
    const { orderId } = (await book(2)).json();
    const link = rzp.forOrder(orderId)[0];
    const paymentId = rzp.pay(link.id);
    await webhook('payment_link.paid', paidPayload(link, paymentId));
    const refunded = await orders.refundOrder(orderId);
    assert.equal(refunded.status, 'refunded');
    assert.equal(refunded.amountRefunded, refunded.amount);
    assert.equal(await placesLeft(), before);
    const payment = rzp.payments.get(paymentId);
    await webhook('refund.processed', { refund: { entity: { id: 'rfnd_x', payment_id: paymentId, amount: payment.amount } }, payment: { entity: payment } });
    assert.equal(await placesLeft(), before);
    await assert.rejects(orders.refundOrder(orderId), /Only paid orders can be refunded/);
  });

  test('a payment link from the dashboard confirms its registration when paid', async () => {
    const [reg] = await sql`
      insert into registrations (mission_slug, name, email, phone, kids, notes)
      values ('slime-chemistry', 'Green Valley School', 'office@school.example', '+91 22 1234 5678', 30, 'Class 5')
      returning id`;
    const order = await orders.createPaymentRequest(Number(reg.id), { amount: 18000, description: 'Crime Scene Biology for Class 5', days: 14 });
    assert.equal(order.amount, 18000 * 100);
    const first = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/pay` });
    assert.equal(first.statusCode, 200, first.body);
    const again = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/pay` });
    assert.equal(again.json().url, first.json().url, 'an open link is reused');
    const link = rzp.forOrder(order.id)[0];
    await webhook('payment_link.paid', paidPayload(link, rzp.pay(link.id)));
    assert.equal((await orderRow(order.id)).status, 'paid');
    const [{ status }] = await sql`select status from registrations where id = ${reg.id}`;
    assert.equal(status, 'confirmed');
    const paidAgain = await app.inject({ method: 'POST', url: `/api/orders/${order.id}/pay` });
    assert.equal(paidAgain.statusCode, 409);
  });
});
