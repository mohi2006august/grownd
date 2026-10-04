import { sql } from '../db.js';
import { contentChanged } from './content.js';

const EVENT_COLUMNS = sql`id, mission_slug, date::text as date, to_char(time, 'HH24:MI') as time, timezone, venue, city, places_left`;

export function toEvent(e) {
  const event = { id: Number(e.id), date: e.date, time: e.time, timezone: e.timezone, venue: e.venue, city: e.city, placesLeft: e.places_left };
  if (e.booked !== undefined) Object.assign(event, { booked: e.booked, held: e.held });
  return event;
}

export async function listMissionsWithEvents() {
  const [missions, events, [{ today }]] = await Promise.all([
    sql`select slug, title, type, unit, price::float8 as price from missions order by sort`,
    // booked: places on paid (or clearing) bookings; held: places in checkouts not yet paid.
    sql`
      select e.id, e.mission_slug, e.date::text as date, to_char(e.time, 'HH24:MI') as time, e.timezone, e.venue, e.city, e.places_left,
             coalesce(sum(o.places_held) filter (where o.status in ('paid', 'processing')), 0)::int as booked,
             coalesce(sum(o.places_held) filter (where o.status = 'pending'), 0)::int as held
      from events e left join orders o on o.event_id = e.id
      group by e.id
      order by e.date nulls last, e.time nulls last, e.id`,
    sql`select current_date::text as today`
  ]);
  return {
    today,
    missions: missions.map(m => ({ ...m, events: events.filter(e => e.mission_slug === m.slug).map(toEvent) }))
  };
}

export async function missionExists(slug) {
  const [row] = await sql`select 1 from missions where slug = ${slug}`;
  return Boolean(row);
}

/** Returns the saved price, or undefined if the mission does not exist. */
export async function setPrice(slug, price) {
  const [row] = await sql`update missions set price = ${price} where slug = ${slug} returning price::float8 as price`;
  if (row) contentChanged();
  return row ? row.price : undefined;
}

export async function getEvent(id) {
  const [row] = await sql`select ${EVENT_COLUMNS} from events where id = ${id}`;
  return row ? toEvent(row) : null;
}

export async function createEvent(slug, e) {
  const [row] = await sql`
    insert into events (mission_slug, date, time, timezone, venue, city, places_left)
    values (${slug}, ${e.date}, ${e.time}, ${e.timezone}, ${e.venue}, ${e.city}, ${e.placesLeft})
    returning ${EVENT_COLUMNS}`;
  contentChanged();
  return toEvent(row);
}

export async function updateEvent(id, e) {
  const [row] = await sql`
    update events
    set date = ${e.date}, time = ${e.time}, timezone = ${e.timezone}, venue = ${e.venue}, city = ${e.city}, places_left = ${e.placesLeft}
    where id = ${id}
    returning ${EVENT_COLUMNS}`;
  if (row) contentChanged();
  return row ? toEvent(row) : null;
}

/** Atomic +/- so two admins clicking at once never overwrite each other. */
export async function adjustPlaces(id, delta) {
  const [row] = await sql`
    update events set places_left = greatest(0, least(999, places_left + ${delta}::int))
    where id = ${id}
    returning ${EVENT_COLUMNS}`;
  if (row) contentChanged();
  return row ? toEvent(row) : null;
}

export async function deleteEvent(id) {
  const rows = await sql`delete from events where id = ${id} returning id`;
  if (rows.length) contentChanged();
  return rows.length > 0;
}
