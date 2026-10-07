// The dashboard's Settings through the real admin API: sign-in rules on a real request, the
// business details (validated, then shown to the public site), against a real Postgres.
//
// Needs TEST_DATABASE_URL like payments.test.js (a Postgres it may wipe). Run: npm test
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { SignJWT } from 'jose';
import postgres from 'postgres';

const DB = process.env.TEST_DATABASE_URL;
const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const localDb = DB && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(DB).hostname);
const skip = !DB ? 'set TEST_DATABASE_URL to run these tests' : !localDb && process.env.TEST_DATABASE_ALLOW_WIPE !== '1'
  ? 'TEST_DATABASE_URL is not on localhost; set TEST_DATABASE_ALLOW_WIPE=1 if it may really be wiped' : false;

const SUPABASE_URL = 'https://grownd-test.supabase.co';
const SECRET = 'a-test-signing-secret-that-is-long-enough-for-hs256';
let sql, app;

const token = aal => new SignJWT({ email: 'admin@grownd.test', aal, app_metadata: { role: 'admin' } })
  .setProtectedHeader({ alg: 'HS256' }).setSubject('11111111-1111-1111-1111-111111111111')
  .setIssuer(`${SUPABASE_URL}/auth/v1`).setAudience('authenticated').setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(SECRET));
const put = async (body, aal = 'aal2') => app.inject({ method: 'PUT', url: '/api/admin/settings', headers: { authorization: `Bearer ${await token(aal)}` }, payload: body });

describe('dashboard settings', { skip, concurrency: false }, () => {
  before(async () => {
    sql = postgres(DB, { max: 2, onnotice() {} });
    await sql.unsafe('drop schema if exists public cascade; create schema public; drop schema if exists extensions cascade;');
    execFileSync(process.execPath, ['scripts/migrate.js'], { cwd: BACKEND, env: { ...process.env, MIGRATION_DATABASE_URL: DB }, stdio: 'pipe' });
    Object.assign(process.env, {
      NODE_ENV: 'test', LOG_LEVEL: 'silent', DATABASE_URL: DB,
      SUPABASE_URL, SUPABASE_ANON_KEY: 'sb_publishable_test', SUPABASE_JWT_SECRET: SECRET
    });
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
  });

  after(async () => {
    await app?.close();
    await sql?.end();
  });

  test('an admin who has only typed their password is asked for their code', async () => {
    const res = await put({ contactEmail: 'hello@grownd.in' }, 'aal1');
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().code, 'mfa_required');
    assert.equal(res.headers['cache-control'], 'no-store');
  });

  test('business details are checked before they are saved', async () => {
    const res = await put({ contactEmail: 'not-an-email', contactPhone: 'call me' });
    assert.equal(res.statusCode, 400);
    assert.ok(res.json().errors.contactEmail);
    assert.ok(res.json().errors.contactPhone);
  });

  test('saved business details reach the public site', async () => {
    const details = { businessName: 'GROWND Science Experiences LLP', contactEmail: 'hello@grownd.in', contactPhone: '+91 98765 43210', address: '12 Lab Lane, Pune 411001' };
    const res = await put({ currency: 'inr', ...details });
    assert.equal(res.statusCode, 200, res.body);
    assert.equal(res.json().currency, 'INR');
    const content = (await app.inject({ method: 'GET', url: '/api/content' })).json();
    assert.deepEqual({ ...content.settings, currency: undefined, timezone: undefined, responseTime: undefined, insuranceNote: undefined }, { ...details, currency: undefined, timezone: undefined, responseTime: undefined, insuranceNote: undefined });
  });
});
