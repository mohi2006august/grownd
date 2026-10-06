// Admin sign-in checks: only admins get in, and only after two-step sign-in (an authenticator-app
// code, "aal2" in the token). Tokens are signed here with a stand-in for Supabase's signing secret,
// so no network or database is needed.
import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import { SignJWT } from 'jose';

const SUPABASE_URL = 'https://grownd-test.supabase.co';
const SECRET = 'a-test-signing-secret-that-is-long-enough-for-hs256';
let verifyAdmin;

before(async () => {
  Object.assign(process.env, {
    NODE_ENV: 'test', LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:9/none', // never connected to
    SUPABASE_URL, SUPABASE_ANON_KEY: 'sb_publishable_test', SUPABASE_JWT_SECRET: SECRET
  });
  ({ verifyAdmin } = await import('../src/auth.js'));
});

function token({ role = 'admin', aal = 'aal2', secret = SECRET, expiresIn = '1h', issuer = `${SUPABASE_URL}/auth/v1` } = {}) {
  return new SignJWT({ email: 'admin@grownd.test', aal, app_metadata: role ? { role } : {} })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('11111111-1111-1111-1111-111111111111')
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

const refused = (status, code) => err => {
  assert.equal(err.statusCode, status);
  assert.equal(err.code, code);
  return true;
};

describe('admin sign-in', () => {
  test('an admin who passed two-step sign-in gets in', async () => {
    assert.deepEqual(await verifyAdmin(await token()), { id: '11111111-1111-1111-1111-111111111111', email: 'admin@grownd.test' });
  });

  test('a password alone is not enough: the dashboard is asked for a code', async () => {
    await assert.rejects(verifyAdmin(await token({ aal: 'aal1' })), refused(403, 'mfa_required'));
  });

  test('someone who is not an admin is refused, code or not', async () => {
    await assert.rejects(verifyAdmin(await token({ role: null })), refused(403, undefined));
    await assert.rejects(verifyAdmin(await token({ role: 'editor' })), refused(403, undefined));
  });

  test('forged, expired and foreign tokens are refused', async () => {
    await assert.rejects(verifyAdmin(await token({ secret: 'someone-elses-secret-that-is-long-enough!!' })), refused(401));
    await assert.rejects(verifyAdmin(await token({ expiresIn: '-1m' })), refused(401));
    await assert.rejects(verifyAdmin(await token({ issuer: 'https://evil.example/auth/v1' })), refused(401));
    await assert.rejects(verifyAdmin('not-a-token'), refused(401));
    // An unsigned token ("alg": "none") must never be accepted.
    const [, body] = (await token()).split('.');
    const unsigned = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${body}.`;
    await assert.rejects(verifyAdmin(unsigned), refused(401));
  });
});
