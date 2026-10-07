import { sql } from '../db.js';
import { cached } from '../lib/cache.js';

// The business details appear on the contact page and in the terms, privacy and refund policies,
// which Razorpay checks before it activates live payments.
export const SETTING_KEYS = ['currency', 'timezone', 'responseTime', 'insuranceNote', 'businessName', 'contactEmail', 'contactPhone', 'address'];

export async function getSettings() {
  const out = Object.fromEntries(SETTING_KEYS.map(k => [k, '']));
  for (const { key, value } of await sql`select key, value from settings`) {
    if (key in out) out[key] = value;
  }
  return out;
}

/** For hot paths such as checkout: settings change rarely, so read them at most every 30 seconds. */
export const getSettingsCached = cached(getSettings, 30_000);

export async function saveSettings(values) {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value }));
  if (rows.length) {
    await sql`
      insert into settings ${sql(rows, 'key', 'value')}
      on conflict (key) do update set value = excluded.value`;
  }
  getSettingsCached.invalidate();
  return getSettings();
}
