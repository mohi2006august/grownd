import { sql } from '../db.js';
import { paymentsEnabled, testMode, webhooksEnabled } from '../payments/provider.js';
import { STATUSES } from './registrations.js';
import { getSettings, SETTING_KEYS } from './settings.js';

/** Everything the dashboard overview shows, in four parallel queries. */
export async function getStats() {
  const [[totals], missions, revenue, settings] = await Promise.all([
    sql`
      select
        (select coalesce(json_object_agg(status, n), '{}'::json)
           from (select status, count(*)::int as n from registrations group by status) s) as by_status,
        (select count(*)::int from registrations where created_at >= now() - interval '7 days') as this_week,
        (select coalesce(sum(kids), 0)::int from registrations where status <> 'cancelled') as kids,
        (select count(*)::int from registrations where mission_slug is null) as unassigned,
        (select count(*)::int from events where date is null or date >= current_date) as upcoming_total,
        (select count(*)::int from events where (date is null or date >= current_date) and places_left = 0) as sold_out,
        (select coalesce(sum(o.places_held), 0)::int from orders o join events e on e.id = o.event_id
           where o.status in ('paid', 'processing') and e.date >= current_date) as booked_places`,
    sql`
      select m.slug, m.title, m.type, m.price::float8 as price,
        (select count(*)::int from registrations r where r.mission_slug = m.slug) as registrations,
        (select count(*)::int from events e where e.mission_slug = m.slug and (e.date is null or e.date >= current_date)) as upcoming
      from missions m
      order by m.sort`,
    sql`
      select currency, sum(amount - amount_refunded)::bigint as net
      from orders
      where status in ('paid', 'refunded') and paid_at >= now() - interval '30 days'
      group by currency
      order by currency`,
    getSettings()
  ]);

  const byStatus = Object.fromEntries(STATUSES.map(s => [s, totals.by_status[s] || 0]));
  return {
    byStatus,
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    thisWeek: totals.this_week,
    kids: totals.kids,
    unassigned: totals.unassigned,
    upcoming: { total: totals.upcoming_total, soldOut: totals.sold_out },
    bookedPlaces: totals.booked_places,
    revenue30d: revenue.map(r => ({ currency: r.currency, amount: Number(r.net) })),
    payments: { enabled: paymentsEnabled, testMode, webhooks: webhooksEnabled },
    missions,
    setup: {
      settings: SETTING_KEYS.filter(k => !settings[k]),
      unpriced: missions.filter(m => m.price == null).map(m => m.title),
      undated: missions.filter(m => !m.upcoming).map(m => m.title),
      payments: !paymentsEnabled
    }
  };
}
