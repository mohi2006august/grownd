import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';

// Admins sign in with Supabase Auth in the dashboard and send the access token as a Bearer token.
// Tokens are verified locally (signature, issuer, audience, expiry), so no network or database
// call is needed per request. An admin is a user whose app_metadata.role is "admin"; only the
// service role can set app_metadata, so users cannot grant it to themselves. Admins must also have
// passed two-step sign-in (a code from an authenticator app), which Supabase records as "aal2" in
// the token, so a stolen password alone does not open the dashboard.

const issuer = `${config.supabaseUrl}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { cacheMaxAge: 10 * 60 * 1000 });
const legacySecret = config.supabaseJwtSecret ? new TextEncoder().encode(config.supabaseJwtSecret) : null;

const signIn = () => new HttpError(401, 'Please sign in again.');

export async function verifyAdmin(token) {
  let alg;
  try {
    ({ alg } = decodeProtectedHeader(token));
  } catch {
    throw signIn();
  }
  // Pick the key by algorithm, and only accept that algorithm with it.
  const [key, algorithms] = alg === 'HS256' ? [legacySecret, ['HS256']] : [jwks, ['ES256', 'RS256']];
  if (!key) throw signIn();

  let payload;
  try {
    ({ payload } = await jwtVerify(token, key, { issuer, audience: 'authenticated', algorithms }));
  } catch {
    throw signIn();
  }
  if (payload.app_metadata?.role !== 'admin') throw new HttpError(403, 'This account does not have admin access.');
  if (config.adminMfa && payload.aal !== 'aal2') {
    throw new HttpError(403, 'Enter the code from your authenticator app to continue.', undefined, 'mfa_required');
  }
  return { id: payload.sub, email: payload.email };
}

/** Fastify onRequest hook for every admin route. */
export async function requireAdmin(request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) throw signIn();
  request.admin = await verifyAdmin(header.slice(7).trim());
}
