// Orders: date bookings paid on the site, and payment requests the team sends from the dashboard.
//
// Rules this module keeps, whatever order events arrive in:
// - A booking takes its places in the same transaction that creates it, and only if they exist,
//   so a sold-out date can never be oversold, however many people try at once.
// - Places are given back exactly once (places_held drops to 0 when they are).
// - The payment provider's webhook is the source of truth. Each event is recorded in the same
//   transaction as its effect, so repeated deliveries change nothing.
// - Network calls to the provider happen outside transactions, except the rare duplicate-payment
//   refund, which must roll back with its transaction so a retried webhook retries the refund.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { sql } from '../db.js';
import { busy, HttpError, notFound } from '../lib/errors.js';
import { toMinor } from '../lib/money.js';
import * as provider from '../payments/stripe.js';
import { getSettingsCached } from './settings.js';

export const PAGE_SIZE = 50;
const SYNC_INTERVAL_MS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isOrderId = value => UUID.test(String(value));

const STATUS_GROUPS = {
  paid: ['paid'],
  awaiting: ['pending', 'processing'],
  refunded: ['refunded'],
  closed: ['expired', 'failed', 'cancelled']
};

const COLUMNS = sql`
  o.id, o.kind, o.status, o.event_id, o.mission_slug, o.registration_id, o.description,
  o.unit_amount, o.quantity, o.amount, o.currency, o.amount_refunded,
  o.name, o.email, o.phone, o.kids, o.age_range, o.notes, o.places_held,
  o.checkout_session_id, o.checkout_url, o.payment_intent_id, o.last_synced_at,
  o.expires_at, o.paid_at, o.created_at, o.updated_at,
  m.title as mission_title, m.type as mission_type,
  e.date::text as event_date, to_char(e.time, 'HH24:MI') as event_time,
  coalesce(e.timezone, (select value from settings where key = 'timezone')) as event_timezone,
  e.venue as event_venue, e.city as event_city`;
const FROM = sql`orders o left join missions m on m.slug = o.mission_slug left join events e on e.id = o.event_id`;

// ---------------------------------------------------------------------------
// presentation
// ---------------------------------------------------------------------------

function describeWhen(date, time, timezone) {
  const day = date
    ? new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'Date to be confirmed';
  return [day, [time, timezone].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}

const payUrl = id => `${config.siteUrl}/checkout?order=${id}`;
const returnUrl = (id, result) => `${config.siteUrl}/checkout?order=${id}&result=${result}`;

function maskEmail(email) {
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}•••@${domain}`;
}

function eventView(r) {
  if (!r.event_id) return null;
  return { id: Number(r.event_id), date: r.event_date, time: r.event_time, timezone: r.event_timezone, venue: r.event_venue, city: r.event_city };
}

/** Full view for the dashboard. */
export function toOrder(r) {
  return {
    id: r.id, kind: r.kind, status: r.status, description: r.description,
    mission: r.mission_slug, missionTitle: r.mission_title, missionType: r.mission_type,
    event: eventView(r), registrationId: r.registration_id ? Number(r.registration_id) : null,
    unitAmount: r.unit_amount, quantity: r.quantity, amount: r.amount, amountRefunded: r.amount_refunded, currency: r.currency,
    name: r.name, email: r.email, phone: r.phone, kids: r.kids, ageRange: r.age_range, notes: r.notes,
    placesHeld: r.places_held, payUrl: r.kind === 'request' ? payUrl(r.id) : null,
    providerUrl: provider.dashboardUrl(r.payment_intent_id),
    expiresAt: r.expires_at, paidAt: r.paid_at, createdAt: r.created_at, updatedAt: r.updated_at
  };
}

/** What the customer's own page may show. The order id in the link is the only key, so no phone or notes. */
function toPublicOrder(r) {
  const open = r.status === 'pending' && new Date(r.expires_at) > new Date();
  return {
    id: r.id, kind: r.kind, status: r.status, description: r.description,
    missionTitle: r.mission_title, missionType: r.mission_type, event: eventView(r), kids: r.kids,
    amount: r.amount, amountRefunded: r.amount_refunded, currency: r.currency,
    firstName: r.name.split(/\s+/)[0], emailHint: maskEmail(r.email),
    canPay: r.kind === 'request' && open, expiresAt: r.expires_at,
    // A booking still inside its hold can go back to the same payment page.
    resumeUrl: r.kind === 'booking' && open ? r.checkout_url : null
  };
}

async function fetchOrder(id, db = sql) {
  const [row] = await db`select ${COLUMNS} from ${FROM} where o.id = ${id}`;
  return row || null;
}

const notOpen = () => new HttpError(503, 'Online booking is not switched on yet. Please register your interest instead.');
const startFailed = cause => Object.assign(new HttpError(502, 'We could not start the payment just now. Please try again in a moment.'), { cause });

// ---------------------------------------------------------------------------
// state changes (always inside a transaction, passed in as `tx`)
// ---------------------------------------------------------------------------

/** Moves an order from one of `from` to `to` and gives back any places it holds. */
async function releaseOrder(tx, id, from, to) {
  const [o] = await tx`select status, event_id, places_held from orders where id = ${id} for update`;
  if (!o || !from.includes(o.status)) return false;
  await tx`update orders set status = ${to}, places_held = 0 where id = ${id}`;
  if (o.places_held > 0 && o.event_id) {
    await tx`update events set places_left = least(999, places_left + ${o.places_held}::int) where id = ${o.event_id}`;
  }
  return true;
}

async function markPaid(tx, orderId, paymentIntentId, sessionId) {
  const [o] = await tx`
    select kind, status, event_id, kids, places_held, payment_intent_id, registration_id
    from orders where id = ${orderId} for update`;
  if (!o) return;

  if (o.status === 'paid' || o.status === 'refunded') {
    // Paid twice (for example a payment link opened in two tabs). Refund the extra payment.
    // Done inside the transaction: if it fails, the webhook is retried and so is the refund.
    if (paymentIntentId && o.payment_intent_id && paymentIntentId !== o.payment_intent_id) {
      await provider.refundPayment(paymentIntentId, orderId);
    }
    return;
  }

  let held = o.places_held;
  if (o.kind === 'booking' && held === 0 && o.event_id && o.kids) {
    // Paid after its hold had been released (very rare): take the places again.
    await tx`update events set places_left = greatest(0, places_left - ${o.kids}::int) where id = ${o.event_id}`;
    held = o.kids;
  }
  await tx`
    update orders
    set status = 'paid', paid_at = coalesce(paid_at, now()), places_held = ${held},
        payment_intent_id = ${paymentIntentId}, checkout_session_id = coalesce(${sessionId}, checkout_session_id)
    where id = ${orderId}`;
  if (o.registration_id) {
    await tx`update registrations set status = 'confirmed' where id = ${o.registration_id} and status in ('new', 'contacted')`;
  }
}

/** A checkout the provider reports as complete: paid now, or (bank debits) paid in a few days. */
async function applyCheckout(tx, checkout) {
  if (checkout.status !== 'complete' || !isOrderId(checkout.orderId)) return;
  if (checkout.paid) {
    await markPaid(tx, checkout.orderId, checkout.paymentIntentId, checkout.id);
  } else {
    await tx`
      update orders set status = 'processing', payment_intent_id = ${checkout.paymentIntentId}, checkout_session_id = ${checkout.id}
      where id = ${checkout.orderId} and status = 'pending'`;
  }
}

async function applyExpired(tx, checkout) {
  if (!isOrderId(checkout.orderId)) return;
  const [o] = await tx`select kind, checkout_session_id from orders where id = ${checkout.orderId} for update`;
  // Ignore an older session of an order that has since started a new one.
  if (!o || (o.checkout_session_id && o.checkout_session_id !== checkout.id)) return;
  if (o.kind === 'booking') {
    await releaseOrder(tx, checkout.orderId, ['pending'], 'expired');
  } else {
    // A payment link stays usable until its own deadline; the customer can simply start again.
    await tx`update orders set checkout_session_id = null, checkout_url = null where id = ${checkout.orderId} and status = 'pending'`;
  }
}

async function applyRefund(tx, { paymentIntentId, amountRefunded, fullyRefunded }) {
  if (!paymentIntentId) return;
  const [o] = await tx`select id, amount from orders where payment_intent_id = ${paymentIntentId} for update`;
  if (!o) return; // e.g. the refunded duplicate of a payment, which no order points at
  await tx`update orders set amount_refunded = ${Math.min(o.amount, amountRefunded)} where id = ${o.id}`;
  if (fullyRefunded) await releaseOrder(tx, o.id, ['paid', 'processing'], 'refunded');
}

// ---------------------------------------------------------------------------
// customer actions
// ---------------------------------------------------------------------------

/** Books places on a dated session and returns the provider's payment page. */
export async function createBooking({ eventId, kids, name, email, phone, age, notes }) {
  const settings = await getSettingsCached();
  if (!provider.paymentsEnabled || !settings.currency) throw notOpen();
  const currency = settings.currency.toLowerCase();

  const [ev] = await sql`
    select e.date::text as date, to_char(e.time, 'HH24:MI') as time, coalesce(e.timezone, ${settings.timezone || null}) as timezone,
           e.venue, e.city, e.places_left, (e.date >= current_date) as upcoming,
           m.slug, m.title, m.unit, m.price::float8 as price
    from events e join missions m on m.slug = e.mission_slug
    where e.id = ${eventId}`;
  if (!ev) throw notFound('That date is no longer available.');
  if (!ev.date || !ev.upcoming) throw new HttpError(409, 'This date is not open for booking.');
  if (ev.price == null || ev.price <= 0) throw new HttpError(409, 'This mission does not have a price yet. Please register your interest instead.');

  const unitAmount = toMinor(ev.price, currency);
  const quantity = ev.unit === 'child' ? kids : 1;
  const amount = unitAmount * quantity;
  const when = describeWhen(ev.date, ev.time, ev.timezone);
  const where = [ev.venue, ev.city].filter(Boolean).join(', ');
  // One extra minute so the provider still sees at least the minimum checkout lifetime.
  const expiresAt = new Date(Date.now() + (config.bookingHoldMinutes + 1) * 60_000);

  const order = await sql.begin(async tx => {
    const [held] = await tx`
      update events set places_left = places_left - ${kids}::int
      where id = ${eventId} and date >= current_date and places_left >= ${kids}::int
      returning places_left`;
    if (!held) return null;
    const [row] = await tx`
      insert into orders (kind, event_id, mission_slug, description, unit_amount, quantity, amount, currency,
                          name, email, phone, kids, age_range, notes, consent_at, places_held, expires_at)
      values ('booking', ${eventId}, ${ev.slug}, ${`${ev.title} · ${when}`}, ${unitAmount}, ${quantity}, ${amount}, ${currency},
              ${name}, ${email}, ${phone}, ${kids}, ${age}, ${notes}, now(), ${kids}, ${expiresAt})
      returning id`;
    return row;
  });
  if (!order) {
    const [now] = await sql`select places_left from events where id = ${eventId}`;
    const left = now ? now.places_left : 0;
    const message = left > 0
      ? `Only ${left} ${left === 1 ? 'place is' : 'places are'} left on this date.`
      : 'Sorry, this date has just sold out.';
    throw new HttpError(409, message, { kids: message });
  }

  try {
    const checkout = await provider.createCheckout({
      orderId: order.id, attempt: 1, email, currency, unitAmount, quantity,
      name: ev.title,
      description: [when, where, `${kids} ${kids === 1 ? 'child' : 'children'}`].filter(Boolean).join(' · '),
      successUrl: returnUrl(order.id, 'success'), cancelUrl: returnUrl(order.id, 'cancelled'), expiresAt
    });
    await sql`update orders set checkout_session_id = ${checkout.id}, checkout_url = ${checkout.url} where id = ${order.id}`;
    return { orderId: order.id, url: checkout.url };
  } catch (err) {
    // The customer never got a payment page for this order, so drop it and free its places.
    await discardOrder(order.id);
    if (err instanceof provider.ProviderBusyError) throw busy();
    throw startFailed(err);
  }
}

/** Removes an order that never reached a payment page, giving back its places in the same transaction. */
async function discardOrder(id) {
  await sql.begin(async tx => {
    const [o] = await tx`delete from orders where id = ${id} and status = 'pending' returning event_id, places_held`;
    if (o && o.places_held > 0 && o.event_id) {
      await tx`update events set places_left = least(999, places_left + ${o.places_held}::int) where id = ${o.event_id}`;
    }
  });
}

/** The customer's view of an order. With `sync`, asks the provider directly if the webhook is late. */
export async function getPublicOrder(id, { sync = false } = {}) {
  let row = await fetchOrder(id);
  if (!row) return null;
  const stale = !row.last_synced_at || Date.now() - new Date(row.last_synced_at).getTime() > SYNC_INTERVAL_MS;
  if (sync && provider.paymentsEnabled && row.status === 'pending' && row.checkout_session_id && stale) {
    await sql`update orders set last_synced_at = now() where id = ${id}`;
    try {
      const checkout = await provider.getCheckout(row.checkout_session_id);
      if (checkout.status === 'complete') {
        await sql.begin(tx => applyCheckout(tx, checkout));
        row = await fetchOrder(id);
      }
    } catch {
      // The webhook or the background reconciler will settle it.
    }
  }
  return toPublicOrder(row);
}

/** Customer clicked "Pay" on a payment link. Reuses an open checkout or starts a new one. */
export async function startRequestPayment(id) {
  if (!provider.paymentsEnabled) throw notOpen();
  const row = await fetchOrder(id);
  if (!row || row.kind !== 'request') throw notFound('We could not find that payment.');
  if (row.status === 'paid' || row.status === 'processing') throw new HttpError(409, 'This has already been paid. Thank you!');
  if (row.status !== 'pending') throw new HttpError(409, 'This payment link is no longer active. Please contact GROWND for a new one.');
  if (new Date(row.expires_at) <= new Date()) {
    await sql.begin(tx => releaseOrder(tx, id, ['pending'], 'expired'));
    throw new HttpError(409, 'This payment link has expired. Please contact GROWND for a new one.');
  }

  try {
    if (row.checkout_session_id) {
      let current = await provider.getCheckout(row.checkout_session_id);
      if (current.status === 'open' && current.expiresAt > new Date(Date.now() + 5 * 60_000)) return { url: current.url };
      if (current.status === 'open') current = await provider.expireCheckout(row.checkout_session_id);
      if (current.status === 'complete') {
        await sql.begin(tx => applyCheckout(tx, current));
        throw new HttpError(409, 'This has already been paid. Thank you!');
      }
    }
    const linkEnds = new Date(row.expires_at).getTime();
    const expiresAt = new Date(Math.max(Date.now() + 31 * 60_000, Math.min(linkEnds, Date.now() + 23 * 3600_000)));
    const checkout = await provider.createCheckout({
      orderId: id, attempt: crypto.randomUUID(), email: row.email, currency: row.currency,
      unitAmount: row.unit_amount, quantity: row.quantity, name: row.description, description: null,
      successUrl: returnUrl(id, 'success'), cancelUrl: returnUrl(id, 'cancelled'), expiresAt
    });
    await sql`update orders set checkout_session_id = ${checkout.id}, checkout_url = ${checkout.url} where id = ${id} and status = 'pending'`;
    return { url: checkout.url };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err instanceof provider.ProviderBusyError) throw busy();
    throw startFailed(err);
  }
}

/** Customer came back from the payment page without paying: end the checkout and free the places now. */
export async function cancelBooking(id) {
  const row = await fetchOrder(id);
  if (!row) return null;
  if (row.kind === 'booking' && row.status === 'pending' && provider.paymentsEnabled) {
    const checkout = row.checkout_session_id ? await provider.expireCheckout(row.checkout_session_id) : null;
    if (checkout?.status === 'complete') await sql.begin(tx => applyCheckout(tx, checkout)); // paid after all
    else await sql.begin(tx => releaseOrder(tx, id, ['pending'], 'cancelled'));
  }
  return getPublicOrder(id);
}

// ---------------------------------------------------------------------------
// webhook and background reconciliation
// ---------------------------------------------------------------------------

/** Applies one verified provider event, exactly once. Throws to make the provider retry. */
export async function handleProviderEvent(event) {
  if (!event) return;
  await sql.begin(async tx => {
    const [fresh] = await tx`
      insert into payment_events (id, type) values (${event.id}, ${event.providerType})
      on conflict (id) do nothing returning id`;
    if (!fresh) return; // already handled
    switch (event.type) {
      case 'checkout.completed':
      case 'checkout.async_succeeded':
        return applyCheckout(tx, event.checkout);
      case 'checkout.async_failed':
        if (isOrderId(event.checkout.orderId)) await releaseOrder(tx, event.checkout.orderId, ['processing', 'pending'], 'failed');
        return;
      case 'checkout.expired':
        return applyExpired(tx, event.checkout);
      case 'payment.refunded':
        return applyRefund(tx, event);
    }
  });
}

/**
 * Settles unpaid orders past their deadline in case a webhook never arrived: asks the provider
 * what happened, then records the payment or closes the order and frees its places.
 * Rows are leased for 5 minutes, so several API instances never work on the same order.
 */
export async function reconcileOverdue(limit = 25) {
  if (!provider.paymentsEnabled) return 0;
  const claimed = await sql`
    update orders set reconcile_after = now() + interval '5 minutes'
    where id in (
      select id from orders
      where status = 'pending' and expires_at < now() - interval '2 minutes'
        and (reconcile_after is null or reconcile_after < now())
      order by expires_at
      limit ${limit}
      for update skip locked)
    returning id, checkout_session_id`;
  for (const o of claimed) {
    let checkout = o.checkout_session_id ? await provider.getCheckout(o.checkout_session_id) : null;
    if (checkout?.status === 'open') checkout = await provider.expireCheckout(o.checkout_session_id);
    if (checkout?.status === 'complete') await sql.begin(tx => applyCheckout(tx, checkout));
    else await sql.begin(tx => releaseOrder(tx, o.id, ['pending'], 'expired'));
  }
  return claimed.length;
}

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------

function where({ group, kind, eventId, registrationId, q }) {
  const parts = [];
  if (STATUS_GROUPS[group]) parts.push(sql`o.status in ${sql(STATUS_GROUPS[group])}`);
  if (kind === 'booking' || kind === 'request') parts.push(sql`o.kind = ${kind}`);
  if (eventId) parts.push(sql`o.event_id = ${eventId}`);
  if (registrationId) parts.push(sql`o.registration_id = ${registrationId}`);
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%';
    parts.push(sql`(o.name || ' ' || o.email || ' ' || o.description) ilike ${like}`);
  }
  if (!parts.length) return sql``;
  return parts.slice(1).reduce((acc, p) => sql`${acc} and ${p}`, sql`where ${parts[0]}`);
}

export async function listOrders(filters, page) {
  const counts = Object.fromEntries(Object.keys(STATUS_GROUPS).map(g => [g, 0]));
  const [items, [{ total }], perStatus, money] = await Promise.all([
    sql`select ${COLUMNS} from ${FROM} ${where(filters)} order by o.created_at desc limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    sql`select count(*)::int as total from orders o ${where(filters)}`,
    sql`select o.status, count(*)::int as n from orders o ${where({ ...filters, group: '' })} group by o.status`,
    sql`
      select currency,
        coalesce(sum(amount - amount_refunded) filter (where status in ('paid', 'refunded') and paid_at >= now() - interval '30 days'), 0)::bigint as paid_30d,
        coalesce(sum(amount_refunded) filter (where paid_at >= now() - interval '30 days'), 0)::bigint as refunded_30d,
        coalesce(sum(amount) filter (where status in ('pending', 'processing')), 0)::bigint as awaiting_amount,
        count(*) filter (where status in ('pending', 'processing'))::int as awaiting_count
      from orders group by currency`
  ]);
  for (const { status, n } of perStatus) {
    const group = Object.keys(STATUS_GROUPS).find(g => STATUS_GROUPS[g].includes(status));
    counts[group] += n;
  }
  const summary = money.map(m => ({
    currency: m.currency, paid30d: Number(m.paid_30d), refunded30d: Number(m.refunded_30d),
    awaitingAmount: Number(m.awaiting_amount), awaitingCount: m.awaiting_count
  }));
  return {
    items: items.map(toOrder), total, page, pageSize: PAGE_SIZE, counts, summary,
    payments: { enabled: provider.paymentsEnabled, testMode: provider.testMode, webhooks: provider.webhooksEnabled }
  };
}

export async function getOrder(id) {
  const row = await fetchOrder(id);
  return row ? toOrder(row) : null;
}

/** A payment link for a registration (a quote for a party, a school visit). */
export async function createPaymentRequest(registrationId, { amount, description, days }) {
  const settings = await getSettingsCached();
  if (!provider.paymentsEnabled) throw new HttpError(409, 'Online payments are off. Add the Stripe keys to the backend first.');
  if (!settings.currency) throw new HttpError(409, 'Set the currency in Settings first.');
  const currency = settings.currency.toLowerCase();
  const unitAmount = toMinor(amount, currency);
  if (unitAmount <= 0) throw new HttpError(400, 'The amount must be more than zero.', { amount: 'The amount must be more than zero.' });

  const [r] = await sql`select id, name, email, phone, kids, age_range, notes, mission_slug from registrations where id = ${registrationId}`;
  if (!r) throw notFound('That registration does not exist any more.');
  const [row] = await sql`
    insert into orders (kind, registration_id, mission_slug, description, unit_amount, quantity, amount, currency,
                        name, email, phone, kids, age_range, notes, expires_at)
    values ('request', ${r.id}, ${r.mission_slug}, ${description}, ${unitAmount}, 1, ${unitAmount}, ${currency},
            ${r.name}, ${r.email}, ${r.phone}, ${r.kids}, ${r.age_range}, ${r.notes}, now() + make_interval(days => ${days}::int))
    returning id`;
  return getOrder(row.id);
}

/** Full refund of a paid order. Places on its date are freed. */
export async function refundOrder(id) {
  const row = await fetchOrder(id);
  if (!row) return null;
  if (row.status !== 'paid' || !row.payment_intent_id) throw new HttpError(409, 'Only paid orders can be refunded.');
  try {
    await provider.refundPayment(row.payment_intent_id, id);
  } catch (err) {
    throw Object.assign(new HttpError(502, 'Stripe did not accept the refund. Check the payment in the Stripe dashboard.'), { cause: err });
  }
  await sql.begin(tx => applyRefund(tx, { paymentIntentId: row.payment_intent_id, amountRefunded: row.amount, fullyRefunded: true }));
  return getOrder(id);
}

/** Stops an unpaid order (a booking still in checkout, or a payment link). */
export async function cancelOrder(id) {
  const row = await fetchOrder(id);
  if (!row) return null;
  if (row.status !== 'pending') throw new HttpError(409, 'Only unpaid orders can be cancelled.');
  const checkout = row.checkout_session_id && provider.paymentsEnabled ? await provider.expireCheckout(row.checkout_session_id) : null;
  if (checkout?.status === 'complete') {
    await sql.begin(tx => applyCheckout(tx, checkout));
    throw new HttpError(409, 'This was paid a moment ago, so it was not cancelled.');
  }
  await sql.begin(tx => releaseOrder(tx, id, ['pending'], 'cancelled'));
  return getOrder(id);
}

/** True while a date has bookings that are unpaid-but-held, clearing, or paid. */
export async function eventHasActiveOrders(eventId) {
  const [row] = await sql`select 1 from orders where event_id = ${eventId} and status in ('pending', 'processing', 'paid') limit 1`;
  return Boolean(row);
}
