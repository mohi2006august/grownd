import { PG, sql, timed } from '../db.js';
import { badRequest } from '../lib/errors.js';

export const STATUSES = ['new', 'contacted', 'confirmed', 'cancelled'];
export const PAGE_SIZE = 50;
const EXPORT_BATCH = 1000;

const COLUMNS = sql`
  r.id, r.mission_slug, m.title as mission_title, m.type as mission_type,
  r.name, r.email, r.phone, r.kids, r.age_range, r.preferred_date::text as preferred_date,
  r.city, r.venue_type, r.notes, r.consent_at, r.status, r.admin_notes, r.created_at, r.updated_at`;

const FROM = sql`registrations r left join missions m on m.slug = r.mission_slug`;

function toRegistration(r) {
  return {
    id: Number(r.id), mission: r.mission_slug, missionTitle: r.mission_title, missionType: r.mission_type,
    name: r.name, email: r.email, phone: r.phone, kids: r.kids, ageRange: r.age_range,
    preferredDate: r.preferred_date, city: r.city, venueType: r.venue_type, notes: r.notes,
    consentAt: r.consent_at, status: r.status, adminNotes: r.admin_notes, createdAt: r.created_at, updatedAt: r.updated_at
  };
}

/** WHERE clause for the dashboard filters. The search expression matches the trigram index exactly. */
function where({ status, mission, q, beforeId }) {
  const parts = [];
  if (status) parts.push(sql`r.status = ${status}`);
  if (mission === 'none') parts.push(sql`r.mission_slug is null`);
  else if (mission) parts.push(sql`r.mission_slug = ${mission}`);
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, c => '\\' + c) + '%';
    parts.push(sql`(r.name || ' ' || r.email || ' ' || r.phone || ' ' || r.city || ' ' || r.notes) ilike ${like}`);
  }
  if (beforeId) parts.push(sql`r.id < ${beforeId}`);
  if (!parts.length) return sql``;
  return parts.slice(1).reduce((acc, p) => sql`${acc} and ${p}`, sql`where ${parts[0]}`);
}

// ---- public write path: group commit ----
// Sign-ups that arrive within a few milliseconds of each other are saved with one multi-row
// INSERT. Under a spike this turns thousands of round trips and commits into a few dozen;
// when it is quiet it adds at most BATCH_WAIT_MS of latency.

const BATCH_MAX = 100;
const BATCH_WAIT_MS = 5;
const INSERT_COLUMNS = ['mission_slug', 'name', 'email', 'phone', 'kids', 'age_range', 'preferred_date', 'city', 'venue_type', 'notes'];
let pending = [];
let flushTimer = null;

const toRow = r => ({
  mission_slug: r.mission, name: r.name, email: r.email, phone: r.phone, kids: r.kids,
  age_range: r.age, preferred_date: r.date, city: r.city, venue_type: r.venue, notes: r.notes
});
const friendly = err => (err.code === PG.FOREIGN_KEY ? badRequest({ mission: 'That mission no longer exists.' }) : err);
const insertRows = rows => timed(sql`insert into registrations ${sql(rows, ...INSERT_COLUMNS)}`, 5000);

async function writeBatch(batch) {
  try {
    await insertRows(batch.map(b => toRow(b.reg)));
    for (const b of batch) b.resolve();
  } catch (err) {
    // Classes 22 (data exception) and 23 (constraint violation) are about a row, not the database.
    const rowProblem = /^2[23]/.test(err.code || '');
    if (batch.length === 1 || !rowProblem) {
      for (const b of batch) b.reject(friendly(err));
      return;
    }
    // One bad row (say, a mission removed a moment ago) must not sink the rest: save them one by one.
    for (const b of batch) insertRows([toRow(b.reg)]).then(() => b.resolve(), e => b.reject(friendly(e)));
  }
}

function flush() {
  clearTimeout(flushTimer);
  flushTimer = null;
  const batch = pending;
  pending = [];
  if (batch.length) writeBatch(batch);
}

/** Resolves once the registration is saved. Cancelled (503) if the database cannot take it within 5s. */
export function createRegistration(reg) {
  return new Promise((resolve, reject) => {
    pending.push({ reg, resolve, reject });
    if (pending.length >= BATCH_MAX) flush();
    else flushTimer ??= setTimeout(flush, BATCH_WAIT_MS);
  });
}

export async function listRegistrations(filters, page) {
  const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
  const [items, [{ total }], perStatus] = await Promise.all([
    sql`select ${COLUMNS} from ${FROM} ${where(filters)}
        order by r.created_at desc, r.id desc
        limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    sql`select count(*)::int as total from registrations r ${where(filters)}`,
    // The status tabs show counts for the other filters, whatever tab is open.
    sql`select r.status, count(*)::int as n from registrations r ${where({ ...filters, status: '' })} group by r.status`
  ]);
  for (const { status, n } of perStatus) counts[status] = n;
  return { items: items.map(toRegistration), total, page, pageSize: PAGE_SIZE, counts };
}

/** Yields matching registrations in batches (newest first) so exports never load everything at once. */
export async function* exportRegistrations(filters) {
  let beforeId = null;
  for (;;) {
    const rows = await sql`select ${COLUMNS} from ${FROM} ${where({ ...filters, beforeId })} order by r.id desc limit ${EXPORT_BATCH}`;
    if (rows.length) yield rows.map(toRegistration);
    if (rows.length < EXPORT_BATCH) return;
    beforeId = rows[rows.length - 1].id;
  }
}

export async function getRegistration(id) {
  const [row] = await sql`select ${COLUMNS} from ${FROM} where r.id = ${id}`;
  return row ? toRegistration(row) : null;
}

export async function updateRegistration(id, { status, adminNotes }) {
  const changes = {};
  if (status !== undefined) changes.status = status;
  if (adminNotes !== undefined) changes.admin_notes = adminNotes;
  if (Object.keys(changes).length) {
    const [row] = await sql`update registrations set ${sql(changes)} where id = ${id} returning id`;
    if (!row) return null;
  }
  return getRegistration(id);
}

export async function deleteRegistration(id) {
  const rows = await sql`delete from registrations where id = ${id} returning id`;
  return rows.length > 0;
}
