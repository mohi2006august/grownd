import { config } from '../config.js';
import { concurrencyLimit } from '../lib/cache.js';
import { badRequest, busy } from '../lib/errors.js';
import { contactDetails, int, isoDate, oneOf, text } from '../lib/validate.js';
import { getContentJson } from '../services/content.js';
import { createRegistration } from '../services/registrations.js';

const VENUES = ['Our home', 'A hall we have booked', 'School', 'Not decided yet'];

// Sign-ups waiting to be saved, per process. Past this, new ones get a fast 503 ("try again")
// instead of queueing until memory runs out.
const writes = concurrencyLimit(1000);

function cleanRegistration(body) {
  const b = body || {}, errors = {};
  const contact = contactDetails(errors, b, 'We need a yes here before we can email you about this mission.');
  const reg = {
    ...contact,
    mission: typeof b.mission === 'string' && b.mission ? b.mission.slice(0, 80) : null,
    kids: int(errors, 'kids', b.kids, { min: 1, max: 200, label: 'Number of children' }),
    date: isoDate(errors, 'date', b.date, 'Preferred date'),
    city: text(errors, 'city', b.city, { max: 100, label: 'City' }),
    venue: b.venue ? oneOf(errors, 'venue', b.venue, VENUES, 'Venue type') : ''
  };
  if (Object.keys(errors).length) throw badRequest(errors);
  return reg;
}

export default async function publicRoutes(app) {
  const ttl = config.contentCacheSeconds;

  app.get('/api/content', {
    config: { rateLimit: { max: 1200, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const json = await getContentJson();
    // Browsers keep it briefly; a CDN in front can serve it to everyone and revalidate in the background.
    reply
      .header('Cache-Control', `public, max-age=${ttl}, s-maxage=${ttl * 2}, stale-while-revalidate=300`)
      .type('application/json; charset=utf-8');
    return json;
  });

  app.post('/api/registrations', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } }
  }, async (request, reply) => {
    // "website" is a hidden field on the form that only bots fill in. They get the usual answer, so
    // they move on, but nothing is saved.
    if (typeof request.body?.website === 'string' && request.body.website.trim()) {
      reply.code(201);
      return { ok: true };
    }
    const reg = cleanRegistration(request.body);
    if (!writes.tryAcquire()) throw busy();
    try {
      await createRegistration(reg);
      reply.code(201);
      return { ok: true };
    } finally {
      writes.release();
    }
  });
}
