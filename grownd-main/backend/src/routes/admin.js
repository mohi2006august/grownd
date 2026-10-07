import { Readable } from 'node:stream';
import { requireAdmin } from '../auth.js';
import { config } from '../config.js';
import { badRequest, HttpError, notFound } from '../lib/errors.js';
import { clockTime, int, isId, isoDate, text } from '../lib/validate.js';
import { contentChanged } from '../services/content.js';
import {
  adjustPlaces, createEvent, deleteEvent, getEvent, listMissionsWithEvents, missionExists, setPrice, updateEvent
} from '../services/missions.js';
import {
  cancelOrder, createPaymentRequest, eventHasActiveOrders, getOrder, isOrderId, listOrders, refundOrder
} from '../services/orders.js';
import {
  deleteRegistration, exportRegistrations, getRegistration, listRegistrations, STATUSES, updateRegistration
} from '../services/registrations.js';
import { getSettings, saveSettings, SETTING_KEYS } from '../services/settings.js';
import { getStats } from '../services/stats.js';

const str = v => (typeof v === 'string' ? v.trim() : '');

function readFilters(query) {
  const status = str(query.status);
  return {
    status: STATUSES.includes(status) ? status : '',
    mission: str(query.mission).slice(0, 80),
    q: str(query.q).slice(0, 100)
  };
}

function cleanEvent(b) {
  const errors = {};
  const e = {
    date: isoDate(errors, 'date', b.date),
    time: clockTime(errors, 'time', b.time),
    timezone: text(errors, 'timezone', b.timezone, { max: 40, label: 'Timezone' }) || null,
    venue: text(errors, 'venue', b.venue, { max: 120, label: 'Venue' }) || null,
    city: text(errors, 'city', b.city, { max: 80, label: 'City' }) || null,
    placesLeft: int(errors, 'placesLeft', b.placesLeft, { min: 0, max: 999, required: true, label: 'Places left' })
  };
  if (Object.keys(errors).length) throw badRequest(errors);
  return e;
}

const csvCell = v => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheets running it as a formula
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const CSV_COLUMNS = [
  ['Received', r => r.createdAt], ['Status', r => r.status], ['Mission', r => r.missionTitle || 'Not picked'],
  ['Name', r => r.name], ['Email', r => r.email], ['Phone', r => r.phone], ['Children', r => r.kids],
  ['Age range', r => r.ageRange], ['Preferred date', r => r.preferredDate], ['City', r => r.city],
  ['Venue', r => r.venueType], ['Their notes', r => r.notes], ['Internal notes', r => r.adminNotes]
];

const registrationGone = () => notFound('That registration does not exist any more.');
const eventGone = () => notFound('That date does not exist any more.');
const orderGone = () => notFound('That order does not exist.');
const pageOf = query => Math.min(10000, Math.max(1, Number.parseInt(str(query.page), 10) || 1));

function orGone(value, gone) {
  if (!value) throw gone();
  return value;
}

export default async function adminRoutes(app) {
  // Public values the dashboard needs to start Supabase Auth. Safe to expose.
  app.get('/api/admin/config', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=300');
    return { supabaseUrl: config.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey };
  });

  // Everything below needs a signed-in admin.
  app.register(async function authed(app) {
    // Customer details: never kept by a browser cache, proxy or CDN, even on a refused request.
    app.addHook('onRequest', async (request, reply) => { reply.header('Cache-Control', 'no-store'); });
    app.addHook('onRequest', requireAdmin);

    app.get('/api/admin/me', async request => request.admin);

    app.get('/api/admin/stats', async () => getStats());

    // ---- registrations ----

    app.get('/api/admin/registrations', async request => listRegistrations(readFilters(request.query), pageOf(request.query)));

    app.get('/api/admin/registrations.csv', async (request, reply) => {
      const filters = readFilters(request.query);
      async function* lines() {
        yield '﻿' + CSV_COLUMNS.map(c => csvCell(c[0])).join(',') + '\r\n';
        for await (const batch of exportRegistrations(filters)) {
          yield batch.map(r => CSV_COLUMNS.map(c => csvCell(c[1](r))).join(',')).join('\r\n') + '\r\n';
        }
      }
      const day = new Date().toISOString().slice(0, 10);
      reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="grownd-registrations-${day}.csv"`);
      return reply.send(Readable.from(lines()));
    });

    app.get('/api/admin/registrations/:id', async request => {
      if (!isId(request.params.id)) throw registrationGone();
      return orGone(await getRegistration(request.params.id), registrationGone);
    });

    app.patch('/api/admin/registrations/:id', async request => {
      if (!isId(request.params.id)) throw registrationGone();
      const b = request.body || {}, errors = {}, changes = {};
      if ('status' in b) {
        if (!STATUSES.includes(b.status)) errors.status = 'Unknown status.';
        changes.status = b.status;
      }
      if ('adminNotes' in b) changes.adminNotes = text(errors, 'adminNotes', b.adminNotes, { max: 5000, label: 'Notes' });
      if (Object.keys(errors).length) throw badRequest(errors);
      return orGone(await updateRegistration(request.params.id, changes), registrationGone);
    });

    app.delete('/api/admin/registrations/:id', async request => {
      if (!isId(request.params.id) || !(await deleteRegistration(request.params.id))) throw registrationGone();
      return { ok: true };
    });

    // ---- missions and dates ----

    app.get('/api/admin/missions', async () => listMissionsWithEvents());

    app.patch('/api/admin/missions/:slug', async request => {
      const raw = (request.body || {}).price;
      const price = raw === '' || raw == null ? null : Number(raw);
      if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000)) {
        throw badRequest({ price: 'Price must be a number from 0 to 100000.' });
      }
      const saved = await setPrice(request.params.slug, price === null ? null : Math.round(price * 100) / 100);
      if (saved === undefined) throw notFound('Unknown mission.');
      return { slug: request.params.slug, price: saved };
    });

    app.post('/api/admin/missions/:slug/events', async (request, reply) => {
      if (!(await missionExists(request.params.slug))) throw notFound('Unknown mission.');
      const event = await createEvent(request.params.slug, cleanEvent(request.body || {}));
      reply.code(201);
      return event;
    });

    app.patch('/api/admin/events/:id', async request => {
      if (!isId(request.params.id)) throw eventGone();
      const current = orGone(await getEvent(request.params.id), eventGone);
      // Partial updates are fine: anything not sent keeps its current value.
      return orGone(await updateEvent(request.params.id, cleanEvent({ ...current, ...(request.body || {}) })), eventGone);
    });

    app.post('/api/admin/events/:id/places', async request => {
      if (!isId(request.params.id)) throw eventGone();
      const errors = {};
      const delta = int(errors, 'delta', (request.body || {}).delta, { min: -999, max: 999, required: true, label: 'Change' });
      if (Object.keys(errors).length) throw badRequest(errors);
      return orGone(await adjustPlaces(request.params.id, delta), eventGone);
    });

    app.delete('/api/admin/events/:id', async request => {
      if (!isId(request.params.id)) throw eventGone();
      if (await eventHasActiveOrders(request.params.id)) {
        throw new HttpError(409, 'This date has bookings. Refund or cancel them in Payments before deleting it.');
      }
      if (!(await deleteEvent(request.params.id))) throw eventGone();
      return { ok: true };
    });

    // ---- payments ----

    app.get('/api/admin/orders', async request => {
      const q = request.query;
      return listOrders({
        group: str(q.status),
        kind: str(q.kind),
        eventId: isId(q.event) ? Number(q.event) : null,
        registrationId: isId(q.registration) ? Number(q.registration) : null,
        q: str(q.q).slice(0, 100)
      }, pageOf(q));
    });

    app.get('/api/admin/orders/:id', async request => {
      if (!isOrderId(request.params.id)) throw orderGone();
      return orGone(await getOrder(request.params.id), orderGone);
    });

    app.post('/api/admin/orders/:id/refund', async request => {
      if (!isOrderId(request.params.id)) throw orderGone();
      return orGone(await refundOrder(request.params.id), orderGone);
    });

    app.post('/api/admin/orders/:id/cancel', async request => {
      if (!isOrderId(request.params.id)) throw orderGone();
      return orGone(await cancelOrder(request.params.id), orderGone);
    });

    // A payment link for a registration, e.g. the agreed price for a party or school visit.
    app.post('/api/admin/registrations/:id/payment-requests', async (request, reply) => {
      if (!isId(request.params.id)) throw registrationGone();
      const b = request.body || {}, errors = {};
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) errors.amount = 'Enter an amount between 0 and 100000.';
      const description = text(errors, 'description', b.description, { max: 300, required: true, label: 'What it is for' });
      const days = int(errors, 'days', b.days ?? config.paymentLinkDays, { min: 1, max: 60, label: 'Days the link works' });
      if (Object.keys(errors).length) throw badRequest(errors);
      const order = await createPaymentRequest(Number(request.params.id), { amount, description, days });
      reply.code(201);
      return order;
    });

    // ---- site settings ----

    app.get('/api/admin/settings', async () => getSettings());

    app.put('/api/admin/settings', async request => {
      const b = request.body || {}, errors = {}, values = {};
      const limits = { currency: 3, timezone: 40, responseTime: 60, insuranceNote: 400, businessName: 120, contactEmail: 120, contactPhone: 30, address: 300 };
      const labels = {
        currency: 'Currency', timezone: 'Timezone', responseTime: 'Reply time', insuranceNote: 'Safety note',
        businessName: 'Business name', contactEmail: 'Contact email', contactPhone: 'Contact phone', address: 'Address'
      };
      for (const k of SETTING_KEYS) if (k in b) values[k] = text(errors, k, b[k], { max: limits[k], label: labels[k] });
      if (values.currency) {
        values.currency = values.currency.toUpperCase();
        if (!/^[A-Z]{3}$/.test(values.currency)) errors.currency = 'Use a three-letter currency code, like INR.';
      }
      if (values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail)) errors.contactEmail = 'That email does not look right.';
      if (values.contactPhone && !/^\+?[\d\s()-]{7,}$/.test(values.contactPhone)) errors.contactPhone = 'Use digits, spaces and an optional + at the start, like +91 98765 43210.';
      if (Object.keys(errors).length) throw badRequest(errors);
      const saved = await saveSettings(values);
      contentChanged();
      return saved;
    });
  });
}
