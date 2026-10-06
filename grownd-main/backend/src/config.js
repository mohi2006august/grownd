// All configuration comes from environment variables, read and checked once at startup.

const env = process.env;

// Vercel sets VERCEL=1 for builds and Functions.
const onVercel = Boolean(env.VERCEL);

/** A setting is missing or wrong. Its message is safe to show: it names variables, never values. */
export class ConfigError extends Error {
  name = 'ConfigError';
}

const whereToSet = onVercel
  ? 'Add it in Vercel (Project Settings -> Environment Variables), then redeploy.'
  : 'Fill in backend/.env (see SETUP.md), then run "npm run check".';

function required(name) {
  const value = env[name];
  if (!value) throw new ConfigError(`Missing required setting ${name}. ${whereToSet}`);
  if (/YOUR-/.test(value)) throw new ConfigError(`${name} still has the example placeholder in it. ${whereToSet}`);
  return value;
}

/** The `role` claim of a JWT-style Supabase key, or null. */
function jwtRole(key) {
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role ?? null;
  } catch {
    return null;
  }
}

// The anon key is handed to browsers (the dashboard signs in with it). A secret key there would
// give anyone full access to the database, so refuse to start rather than leak it.
function browserSafeSupabaseKey(name) {
  const key = required(name);
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') {
    throw new ConfigError(`${name} holds a secret (service_role) key. It is sent to browsers, so use the anon / publishable key here.`);
  }
  return key;
}

function razorpayKeyId(name) {
  const key = (env[name] || '').trim();
  if (key && !/^rzp_(test|live)_\w+$/.test(key)) {
    throw new ConfigError(`${name} should look like rzp_test_... or rzp_live_... (Razorpay -> Account & Settings -> API Keys). The key secret goes in RAZORPAY_KEY_SECRET.`);
  }
  return key;
}

const int = (value, fallback) => (value === undefined || value === '' ? fallback : Number.parseInt(value, 10));
const bool = (value, fallback) => (value === undefined || value === '' ? fallback : /^(1|true|yes)$/i.test(value));
const list = value => (value || '').split(',').map(s => s.trim()).filter(Boolean);

function trustProxy(value) {
  if (!value) return false;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  return /^\d+$/.test(value) ? Number(value) : value;
}

const production = env.NODE_ENV === 'production';

/** Where customers come back to after paying. On Vercel it defaults to the deployment's own address. */
function defaultSiteUrl() {
  if (onVercel) {
    const host = env.VERCEL_ENV === 'production'
      ? env.VERCEL_PROJECT_PRODUCTION_URL
      : env.VERCEL_BRANCH_URL || env.VERCEL_URL;
    if (host) return `https://${host}`;
  }
  return `http://localhost:${int(env.PORT, 4000)}`;
}

export const config = Object.freeze({
  production,
  testing: env.NODE_ENV === 'test',
  onVercel,
  port: int(env.PORT, 4000),
  host: env.HOST || '0.0.0.0',
  // Worker processes per machine. Set to the number of CPU cores on a VM; leave at 1 in containers
  // and scale by running more containers instead.
  workers: Math.max(1, int(env.WEB_CONCURRENCY, 1)),
  // Vercel's edge sets X-Forwarded-For itself, so it is trusted there by default.
  trustProxy: env.TRUST_PROXY ? trustProxy(env.TRUST_PROXY) : onVercel,
  logLevel: env.LOG_LEVEL || 'info',

  databaseUrl: required('DATABASE_URL'),
  // Connections per process. Keep (processes x DB_POOL_MAX) under the pooler's limit for your Supabase plan.
  // Vercel runs many small instances, so each keeps fewer.
  dbPoolMax: Math.max(1, int(env.DB_POOL_MAX, onVercel ? 5 : 10)),

  supabaseUrl: required('SUPABASE_URL').replace(/\/+$/, ''),
  supabaseAnonKey: browserSafeSupabaseKey('SUPABASE_ANON_KEY'),
  // Only needed for older projects that still sign tokens with the shared HS256 secret.
  supabaseJwtSecret: env.SUPABASE_JWT_SECRET || '',
  // Admins also enter a code from an authenticator app (two-step sign-in). "off" turns that off.
  adminMfa: env.ADMIN_MFA !== 'off',

  // Public address of the site, used in payment return links and in payment links sent to customers.
  siteUrl: (env.SITE_URL || defaultSiteUrl()).replace(/\/+$/, ''),

  // Online payments (Razorpay). Without the key id and secret the site keeps "register interest" only.
  // The webhook secret is required in production; locally payments also work without it.
  razorpayKeyId: razorpayKeyId('RAZORPAY_KEY_ID'),
  razorpayKeySecret: (env.RAZORPAY_KEY_SECRET || '').trim(),
  razorpayWebhookSecret: (env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
  // Only for pointing at a test double.
  razorpayApiBase: (env.RAZORPAY_API_BASE || 'https://api.razorpay.com').replace(/\/+$/, ''),
  // How long a booking holds its places while the customer pays. Razorpay links need at least 15 minutes.
  bookingHoldMinutes: Math.min(24 * 60, Math.max(20, int(env.BOOKING_HOLD_MINUTES, 30))),
  // How long a payment link sent from the dashboard stays valid.
  paymentLinkDays: Math.min(60, Math.max(1, int(env.PAYMENT_LINK_DAYS, 14))),
  // How often each process checks for unpaid orders past their deadline.
  reconcileSeconds: Math.max(5, int(env.RECONCILE_INTERVAL_SECONDS, 60)),
  // Shared secret for scheduled calls to /api/cron/reconcile (Vercel Cron sends it automatically).
  cronSecret: env.CRON_SECRET || '',

  corsOrigins: list(env.CORS_ORIGINS),
  redisUrl: env.REDIS_URL || '',
  contentCacheSeconds: Math.max(1, int(env.CONTENT_CACHE_SECONDS, 30))
});
