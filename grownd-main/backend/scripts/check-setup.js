// Checks backend/.env and that Supabase, the database and Stripe all answer.
// Usage: npm run check
// Never prints your keys or passwords. Exits with code 1 if something must be fixed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { makeStripeClient } from '../src/payments/stripe-client.js';

const env = process.env;
const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const MIGRATIONS = path.join(BACKEND, '..', 'database', 'migrations');
const production = env.NODE_ENV === 'production';

let problems = 0, notes = 0;
const heading = text => console.log(`\n${text}`);
const ok = text => console.log(`  OK    ${text}`);
function fix(text, how) {
  problems++;
  console.log(`  FIX   ${text}`);
  if (how) console.log(`        -> ${how}`);
}
function note(text, how) {
  notes++;
  console.log(`  NOTE  ${text}`);
  if (how) console.log(`        -> ${how}`);
}

const isPlaceholder = v => /YOUR-|\[YOUR|change-me/i.test(v || '');
const set = name => Boolean(env[name]) && !isPlaceholder(env[name]);

function jwtRole(key) {
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
}

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
heading('backend/.env');
if (fs.existsSync(path.join(BACKEND, '.env'))) ok('backend/.env found');
else fix('There is no backend/.env file yet.', 'Copy backend/.env.example to backend/.env and fill it in (see SETUP.md).');

// ---------------------------------------------------------------------------
heading('Supabase');
const supabaseUrl = (env.SUPABASE_URL || '').replace(/\/+$/, '');
const anonKey = env.SUPABASE_ANON_KEY || '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabaseUp = false;

if (!set('SUPABASE_URL')) {
  fix('SUPABASE_URL is not filled in.', 'Supabase -> Project Settings -> Data API -> Project URL. It looks like https://abcdefghijklmnopqrst.supabase.co');
} else if (!/^https:\/\//.test(supabaseUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(supabaseUrl)) {
  fix('SUPABASE_URL should start with https://');
}

if (!set('SUPABASE_ANON_KEY')) {
  fix('SUPABASE_ANON_KEY is not filled in.', 'Supabase -> Project Settings -> API Keys -> the publishable key (sb_publishable_...), or the legacy "anon" key.');
} else if (anonKey.startsWith('sb_secret_') || jwtRole(anonKey) === 'service_role') {
  fix('SUPABASE_ANON_KEY holds a SECRET key. It is sent to browsers, so this would give anyone full access.', 'Put the publishable / anon key here and the secret key in SUPABASE_SERVICE_ROLE_KEY.');
} else if (set('SUPABASE_URL')) {
  try {
    const r = await getJson(`${supabaseUrl}/auth/v1/settings`, { apikey: anonKey });
    if (r.status === 200) {
      supabaseUp = true;
      const host = new URL(supabaseUrl).hostname;
      ok(`Supabase project ${host.endsWith('.supabase.co') ? host.split('.')[0] : host} answers, and the anon key works`);
      if (r.body?.disable_signup) ok('Public sign-ups are off (only admins you create can sign in)');
      else note('Anyone can create an account in your Supabase project.', 'Supabase -> Authentication -> Sign In / Providers -> turn off "Allow new users to sign up". Add admins with npm run create-admin.');
    } else if (r.status === 401 || r.status === 403) {
      fix('Supabase rejected SUPABASE_ANON_KEY.', 'Copy the publishable / anon key again from Project Settings -> API Keys.');
    } else {
      fix(`Supabase answered with status ${r.status}.`, 'Check SUPABASE_URL is the Project URL, with nothing after .supabase.co');
    }
  } catch {
    fix('Could not reach SUPABASE_URL.', 'Check the address (https://<project-ref>.supabase.co) and your internet connection. Paused free projects must be restored in the dashboard first.');
  }
}

if (supabaseUp) {
  try {
    const jwks = await getJson(`${supabaseUrl}/auth/v1/.well-known/jwks.json`, { apikey: anonKey });
    const keys = Array.isArray(jwks.body?.keys) ? jwks.body.keys.length : 0;
    if (keys > 0) {
      ok(`Sign-in tokens use JWT signing keys (${keys} published), checked automatically by the API`);
    } else if (set('SUPABASE_JWT_SECRET')) {
      ok('Sign-in tokens use the legacy JWT secret, and SUPABASE_JWT_SECRET is set');
    } else {
      fix('Your project signs sign-in tokens with the legacy JWT secret, but SUPABASE_JWT_SECRET is empty.', 'Supabase -> Project Settings -> JWT Keys -> copy the legacy JWT secret into SUPABASE_JWT_SECRET (or switch the project to JWT signing keys).');
    }
  } catch {
    note('Could not read the project\'s JWT signing keys.');
  }
}

if (!set('SUPABASE_SERVICE_ROLE_KEY')) {
  note('SUPABASE_SERVICE_ROLE_KEY is empty. That is fine: add admins in Supabase (Authentication -> Users -> Add user), then run "npm run create-admin -- their@email --keep".', 'Only needed to create logins from this computer: Supabase -> Project Settings -> API Keys -> the secret key (sb_secret_...).');
} else if (!(serviceKey.startsWith('sb_secret_') || jwtRole(serviceKey) === 'service_role')) {
  fix('SUPABASE_SERVICE_ROLE_KEY does not look like a secret / service_role key.', 'Supabase -> Project Settings -> API Keys -> the secret key (sb_secret_...).');
} else if (supabaseUp) {
  const headers = { apikey: serviceKey };
  if (serviceKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceKey}`;
  try {
    const r = await getJson(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`, headers);
    if (r.status === 200) ok('The secret key works (used by npm run create-admin)');
    else fix(`Supabase rejected SUPABASE_SERVICE_ROLE_KEY (status ${r.status}).`, 'Copy the secret key again from Project Settings -> API Keys.');
  } catch {
    note('Could not check SUPABASE_SERVICE_ROLE_KEY.');
  }
}

// ---------------------------------------------------------------------------
heading('Database');

function explainDbError(err) {
  const text = String(err?.message || err);
  if (err?.code === '28P01' || /password authentication failed/i.test(text)) {
    return ['the password was not accepted.', 'Use the database password you chose for the project. Forgot it? Supabase -> Project Settings -> Database -> Reset database password.'];
  }
  if (/tenant or user not found/i.test(text)) {
    return ['the pooler did not recognise the user name.', 'For the pooler the user must look like postgres.<project-ref>. Copy the string again from Supabase -> Connect.'];
  }
  if (err?.code === 'ENOTFOUND' || err?.code === 'EAI_AGAIN') {
    return ['the host name was not found.', 'Copy the connection string again from Supabase -> Connect -> Transaction pooler.'];
  }
  if (err?.code === 'CONNECT_TIMEOUT' || err?.code === 'ETIMEDOUT' || err?.code === 'ENETUNREACH') {
    return ['the connection timed out.', 'Check your internet connection. The direct connection (db.<ref>.supabase.co) needs IPv6; the pooler strings work everywhere.'];
  }
  return [text.slice(0, 160), null];
}

async function connect(name, url) {
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
  try {
    await sql`select 1`;
    return sql;
  } catch (err) {
    const [why, how] = explainDbError(err);
    fix(`Could not connect with ${name}: ${why}`, how);
    await sql.end({ timeout: 1 }).catch(() => {});
    return null;
  }
}

if (!set('DATABASE_URL')) {
  fix('DATABASE_URL is not filled in (or still has [YOUR-PASSWORD] in it).', 'Supabase -> Connect -> Transaction pooler. Put your database password where [YOUR-PASSWORD] is, and add ?sslmode=require at the end.');
} else {
  let u = null;
  try { u = new URL(env.DATABASE_URL); } catch { fix('DATABASE_URL is not a valid connection string.'); }
  if (u) {
    if (u.hostname.endsWith('.pooler.supabase.com') && u.port === '6543') ok('DATABASE_URL uses the transaction pooler (port 6543), the right one for the API');
    else if (/^db\..+\.supabase\.co$/.test(u.hostname)) note('DATABASE_URL is the direct connection: IPv6-only on many networks, with a low connection limit.', 'Use the Transaction pooler string from Supabase -> Connect.');
    else if (u.hostname.endsWith('.pooler.supabase.com') && u.port === '5432') note('DATABASE_URL uses the session pooler (port 5432). The API scales better on the transaction pooler (port 6543).');
    if (/supabase\.(com|co)$/.test(u.hostname) && !/sslmode=/.test(u.search)) note('DATABASE_URL has no sslmode.', 'Add ?sslmode=require at the end so the connection is encrypted.');

    const sql = await connect('DATABASE_URL', env.DATABASE_URL);
    if (sql) {
      try {
        const [{ version }] = await sql`select current_setting('server_version') as version`;
        ok(`Connected to Postgres ${version}`);

        const files = fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();
        const [{ tracked }] = await sql`select to_regclass('public.schema_migrations') is not null as tracked`;
        const done = tracked ? new Set((await sql`select name from schema_migrations`).map(r => r.name)) : new Set();
        const missing = files.filter(f => !done.has(f));
        if (missing.length) fix(`${missing.length} of ${files.length} database migrations have not been applied.`, 'npm run db:migrate');
        else ok(`Tables are up to date (${files.length} migrations applied)`);

        const [{ hasAuth }] = await sql`select to_regclass('auth.users') is not null as "hasAuth"`;
        if (hasAuth) {
          const [{ n }] = await sql`select count(*)::int as n from auth.users where raw_app_meta_data->>'role' = 'admin'`;
          if (n) ok(`${n} admin account${n === 1 ? '' : 's'} can sign in to the dashboard`);
          else fix('No admin account yet.', 'npm run create-admin -- you@example.com');
        }

        if (!missing.length) {
          const settings = Object.fromEntries((await sql`select key, value from settings`).map(r => [r.key, r.value]));
          if (settings.currency) ok(`Currency is ${settings.currency}`);
          else note('No currency set yet, so booking buttons stay hidden even with Stripe set up.', 'Dashboard -> Settings -> Currency code (for example INR).');
          const [{ priced }] = await sql`select count(*)::int as priced from missions where price is not null`;
          const [{ dated }] = await sql`select count(*)::int as dated from events where date >= current_date`;
          if (!priced || !dated) note(`${priced} mission(s) have a price and ${dated} upcoming date(s) exist.`, 'Dashboard -> Missions & dates. A date needs a price before it can be booked online.');
        }
      } finally {
        await sql.end({ timeout: 2 });
      }
    }
  }
}

if (set('MIGRATION_DATABASE_URL')) {
  const sql = await connect('MIGRATION_DATABASE_URL', env.MIGRATION_DATABASE_URL);
  if (sql) {
    ok('MIGRATION_DATABASE_URL connects (used by npm run db:migrate)');
    await sql.end({ timeout: 2 });
  }
} else if (env.MIGRATION_DATABASE_URL) {
  note('MIGRATION_DATABASE_URL still has the example value, so npm run db:migrate uses DATABASE_URL instead.', 'Fill it in with the Session pooler string (port 5432), or delete the line.');
}

// ---------------------------------------------------------------------------
heading('Stripe (online payments)');
const stripeKey = env.STRIPE_SECRET_KEY || '';
const webhookSecret = env.STRIPE_WEBHOOK_SECRET || '';

if (!stripeKey) {
  note('No STRIPE_SECRET_KEY, so online payments are off and the site only takes registrations of interest.', 'Stripe dashboard (in a sandbox) -> API keys -> Secret key (sk_test_...). See SETUP.md, Part 2.');
} else if (stripeKey.startsWith('pk_')) {
  fix('STRIPE_SECRET_KEY holds the publishable key (pk_...).', 'Use the secret key (sk_test_...) from the Stripe dashboard -> API keys.');
} else if (!/^(sk|rk)_(test|live)_/.test(stripeKey)) {
  fix('STRIPE_SECRET_KEY does not look like a Stripe secret key (sk_test_..., sk_live_..., rk_...).');
} else {
  const live = /_live_/.test(stripeKey);
  try {
    await makeStripeClient(stripeKey, env.STRIPE_API_BASE).checkout.sessions.list({ limit: 1 });
    ok(`Stripe accepts the key (${live ? 'LIVE mode: real cards will be charged' : 'test mode: no real money moves'})`);
    if (live && !production) note('This is a live Stripe key outside production.', 'Use the test key (sk_test_...) for local work.');
  } catch (err) {
    const why = {
      StripeAuthenticationError: 'Stripe says the key is not valid.',
      StripePermissionError: 'the key works but may not use Checkout Sessions (a restricted key without that permission?).',
      StripeConnectionError: 'could not reach Stripe.'
    }[err?.type] || `Stripe answered with an error (${err?.type || 'unknown'}).`;
    fix(`Stripe check failed: ${why}`, 'Copy the secret key again from the Stripe dashboard -> API keys.');
  }
}

if (webhookSecret) {
  if (/^whsec_/.test(webhookSecret)) ok('STRIPE_WEBHOOK_SECRET is set');
  else fix('STRIPE_WEBHOOK_SECRET should start with whsec_.');
} else if (stripeKey) {
  if (production) {
    fix('Production needs STRIPE_WEBHOOK_SECRET; payments stay off without it.', 'Stripe -> Workbench -> Webhooks -> Create an event destination for https://YOUR-API-HOST/api/payments/webhook, then copy its signing secret (SETUP.md, Part 3).');
  } else {
    note('No STRIPE_WEBHOOK_SECRET. Fine for trying payments locally, but refunds made in Stripe and slow bank payments will not sync.', 'Run "stripe listen --forward-to localhost:4000/api/payments/webhook" and paste the whsec_ secret it prints.');
  }
}

const siteUrl = env.SITE_URL || `http://localhost:${env.PORT || 4000}`;
try {
  const su = new URL(siteUrl);
  if (production && su.protocol !== 'https:') fix('SITE_URL must use https in production.');
  else ok(`SITE_URL is ${su.origin} (where customers return after paying)`);
} catch {
  fix('SITE_URL is not a valid address.');
}

// ---------------------------------------------------------------------------
console.log('');
if (problems) {
  console.log(`${problems} thing${problems === 1 ? '' : 's'} to fix${notes ? `, ${notes} note${notes === 1 ? '' : 's'}` : ''}. Fix them, then run npm run check again.`);
  process.exitCode = 1;
} else {
  console.log(notes ? `Ready, with ${notes} note${notes === 1 ? '' : 's'} above.` : 'All set.');
}
