import { config } from '../config.js';
import { sql } from '../db.js';
import { cached } from '../lib/cache.js';
import { paymentsEnabled } from '../payments/provider.js';
import { getSettings } from './settings.js';

// What the public site needs to fill its placeholders and take bookings: prices, upcoming dates,
// site details, and whether online payment is on. This is the hottest endpoint (every visitor
// hits it), so it is built once per cache period and kept as a ready-to-send JSON string.
async function buildContent() {
  const [missions, events, settings] = await Promise.all([
    sql`select slug, title, type, unit, price::float8 as price from missions order by sort`,
    sql`
      select id, mission_slug, date::text as date, to_char(time, 'HH24:MI') as time,
             timezone, venue, city, places_left
      from events
      where date is null or date >= current_date
      order by date nulls last, time nulls last, id`,
    getSettings()
  ]);

  const byMission = {};
  for (const m of missions) byMission[m.slug] = { title: m.title, type: m.type, unit: m.unit, price: m.price, events: [] };
  for (const e of events) {
    byMission[e.mission_slug]?.events.push({
      id: Number(e.id),
      date: e.date,
      time: e.time,
      timezone: e.timezone || settings.timezone || null,
      venue: e.venue,
      city: e.city,
      placesLeft: e.places_left
    });
  }
  return JSON.stringify({
    settings,
    payments: { enabled: paymentsEnabled && Boolean(settings.currency), holdMinutes: config.bookingHoldMinutes },
    missions: byMission
  });
}

export const getContentJson = cached(buildContent, config.contentCacheSeconds * 1000);

/** Call after any admin change to prices, dates or settings. */
export const contentChanged = () => getContentJson.invalidate();
