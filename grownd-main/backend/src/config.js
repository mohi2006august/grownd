// All configuration comes from environment variables, read and checked once at startup.

const env = process.env;

function required(name) {
  const value = env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. Fill in backend/.env (see SETUP.md), then run "npm run check".`);
  if (/YOUR-/.test(value)) throw new Error(`${name} still has the example placeholder in it. Fill in backend/.env (see SETUP.md), then run "npm run check".`);
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
    throw new Error(`${name} holds a secret (service_role) key. It is sent to browsers, so use the anon / publishable key here.`);
  }
  return key;
}

function stripeSecretKey(name) {
  const key = env[name] || '';
  if (key.startsWith('pk_')) throw new Error(`${name} holds a publishable key (pk_...). Use the secret key (sk_... or rk_...).`);
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

export const config = Object.freeze({
  production,
  port: int(env.PORT, 4000),
  host: env.HOST || '0.0.0.0',
  // Worker processes per machine. Set to the number of CPU cores on a VM; leave at 1 in containers
  // and scale by running more containers instead.
  workers: Math.max(1, int(env.WEB_CONCURRENCY, 1)),
  trustProxy: trustProxy(env.TRUST_PROXY),
  logLevel: env.LOG_LEVEL || 'info',

  databaseUrl: required('DATABASE_URL'),
  // Connections per process. Keep (processes x DB_POOL_MAX) under the pooler's limit for your Supabase plan.
  dbPoolMax: Math.max(1, int(env.DB_POOL_MAX, 10)),

  supabaseUrl: required('SUPABASE_URL').replace(/\/+$/, ''),
  supabaseAnonKey: browserSafeSupabaseKey('SUPABASE_ANON_KEY'),
  // Only needed for older projects that still sign tokens with the shared HS256 secret.
  supabaseJwtSecret: env.SUPABASE_JWT_SECRET || '',

  // Public address of the site, used in payment return links and in payment links sent to customers.
  siteUrl: (env.SITE_URL || `http://localhost:${int(env.PORT, 4000)}`).replace(/\/+$/, ''),

  // Online payments (Stripe). Without the secret key the site keeps "register interest" only.
  // The webhook secret is required in production; locally payments also work without it.
  stripeSecretKey: stripeSecretKey('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
  // Only for pointing at stripe-mock or a test double.
  stripeApiBase: env.STRIPE_API_BASE || '',
  // How long a booking holds its places while the customer pays. Stripe needs at least 30 minutes.
  bookingHoldMinutes: Math.min(24 * 60, Math.max(30, int(env.BOOKING_HOLD_MINUTES, 30))),
  // How long a payment link sent from the dashboard stays valid.
  paymentLinkDays: Math.min(60, Math.max(1, int(env.PAYMENT_LINK_DAYS, 14))),
  // How often each process checks for unpaid orders past their deadline.
  reconcileSeconds: Math.max(5, int(env.RECONCILE_INTERVAL_SECONDS, 60)),

  corsOrigins: list(env.CORS_ORIGINS),
  redisUrl: env.REDIS_URL || '',
  contentCacheSeconds: Math.max(1, int(env.CONTENT_CACHE_SECONDS, 30)),
  // Serve frontend/site and frontend/admin from this process. Handy locally; use a CDN in production.
  serveFrontend: bool(env.SERVE_FRONTEND, !production)
});
