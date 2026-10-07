// Team emails about registrations and payments, against a real Postgres and a stand-in for Resend:
// each one is emailed exactly once, a rush becomes one email, and a failed send is retried.
//
// Needs TEST_DATABASE_URL like payments.test.js (a Postgres it may wipe). Run: npm test
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const DB = process.env.TEST_DATABASE_URL;
const BACKEND = fileURLToPath(new URL('..', import.meta.url));
const localDb = DB && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(DB).hostname);
const skip = !DB ? 'set TEST_DATABASE_URL to run these tests' : !localDb && process.env.TEST_DATABASE_ALLOW_WIPE !== '1'
  ? 'TEST_DATABASE_URL is not on localhost; set TEST_DATABASE_ALLOW_WIPE=1 if it may really be wiped' : false;

// A stand-in for Resend's POST /emails.
const resend = { sent: [], attempts: 0, failNext: 0 };
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    resend.attempts++;
    if (resend.failNext > 0) {
      resend.failNext--;
      res.writeHead(500, { 'Content-Type': 'application/json' }).end('{"message":"down for a moment"}');
      return;
    }
    resend.sent.push({ headers: req.headers, ...JSON.parse(body) });
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(`{"id":"email_${resend.sent.length}"}`);
  });
});

let sql, app, sendTeamEmail;

const waitFor = async (check, ms = 3000) => {
  for (const end = Date.now() + ms; Date.now() < end; await new Promise(r => setTimeout(r, 20))) if (await check()) return;
  assert.fail('timed out waiting');
};
const register = payload => app.inject({ method: 'POST', url: '/api/registrations', payload: { email: 'parent@example.com', consent: true, ...payload } });

describe('team emails', { skip, concurrency: false }, () => {
  before(async () => {
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    sql = postgres(DB, { max: 2, onnotice() {} });
    await sql.unsafe('drop schema if exists public cascade; create schema public; drop schema if exists extensions cascade;');
    execFileSync(process.execPath, ['scripts/migrate.js'], { cwd: BACKEND, env: { ...process.env, MIGRATION_DATABASE_URL: DB }, stdio: 'pipe' });
    Object.assign(process.env, {
      NODE_ENV: 'test', LOG_LEVEL: 'silent',
      DATABASE_URL: DB, SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'sb_publishable_test',
      SITE_URL: 'https://grownd.test', CRON_SECRET: 'test-cron-secret',
      RESEND_API_KEY: 're_test_key', NOTIFY_EMAIL: 'team@grownd.test, second@grownd.test',
      RESEND_API_BASE: `http://127.0.0.1:${server.address().port}`
    });
    ({ sendTeamEmail } = await import('../src/services/notify.js'));
    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
  });

  after(async () => {
    await app?.close();
    await sql?.end();
    server.close();
  });

  beforeEach(async () => {
    await waitFor(async () => !(await sendTeamEmail({ force: true }))); // flush anything left by the last test
    Object.assign(resend, { sent: [], attempts: 0, failNext: 0 });
    await sql`update notify_state set last_sent_at = 'epoch'`;
  });

  test('a new registration emails the team, with its details and Reply going to the parent', async () => {
    const res = await register({ name: 'Asha <b>Rao</b>', email: 'asha@example.com', phone: '+91 98765 43210', kids: 12, city: 'Pune', notes: 'One child has a nut allergy', mission: 'slime-chemistry' });
    assert.equal(res.statusCode, 201, res.body);
    await waitFor(() => resend.sent.length === 1);
    const [email] = resend.sent;
    assert.deepEqual(email.to, ['team@grownd.test', 'second@grownd.test']);
    assert.equal(email.subject, 'GROWND: 1 new registration');
    assert.equal(email.reply_to, 'asha@example.com');
    assert.equal(email.headers.authorization, 'Bearer re_test_key');
    assert.ok(email.headers['idempotency-key']);
    for (const bit of ['Slime Chemistry', '12 children', 'Pune', 'nut allergy', 'https://grownd.test/admin#/registrations?status=new']) assert.match(email.text, new RegExp(bit.replace(/[?#/]/g, '\\$&')));
    assert.match(email.html, /Asha &lt;b&gt;Rao&lt;\/b&gt;/, 'names are escaped in the HTML');
    const [{ n }] = await sql`select count(*)::int as n from registrations where notified_at is null`;
    assert.equal(n, 0);
  });

  test('a rush of sign-ups becomes one email a minute, and nobody is emailed twice', async () => {
    const names = ['Ben', 'Chitra', 'Dev', 'Esha', 'Farah'];
    await Promise.all(names.map(name => register({ name })));
    await waitFor(() => resend.sent.length >= 1);
    await new Promise(r => setTimeout(r, 200));
    assert.equal(resend.sent.length, 1, 'the rest wait for the next minute');
    await sendTeamEmail({ force: true }); // what the next minute (or the daily cron) does
    const mentioned = resend.sent.flatMap(e => names.filter(n => e.text.includes(n)));
    assert.deepEqual(mentioned.sort(), names, 'each sign-up is in exactly one email');
    assert.equal(await sendTeamEmail({ force: true }), 0);
  });

  test('if the email cannot be sent, nothing is lost: it goes out with the next one', async () => {
    resend.failNext = 1;
    await register({ name: 'Gita' });
    await waitFor(() => resend.attempts === 1);
    await waitFor(async () => (await sql`select count(*)::int as n from registrations where notified_at is null`)[0].n === 1);
    assert.equal(resend.sent.length, 0);
    assert.equal(await sendTeamEmail(), 1, 'a failure does not hold the next email back a minute');
    assert.match(resend.sent[0].text, /Gita/);
  });

  test('a payment is emailed once, with the amount', async () => {
    await sql`
      insert into orders (kind, status, description, unit_amount, amount, currency, name, email, expires_at, paid_at)
      values ('request', 'paid', 'Crime Scene Biology for Class 5', 1500000, 1500000, 'inr', 'Green Valley School', 'office@school.example', now() + interval '1 day', now())`;
    assert.equal(await sendTeamEmail(), 1);
    const [email] = resend.sent;
    assert.equal(email.subject, 'GROWND: 1 payment');
    assert.equal(email.reply_to, 'office@school.example');
    assert.match(email.text, /₹15,000\.00 from Green Valley School/);
    assert.match(email.text, /https:\/\/grownd\.test\/admin#\/payments/);
    assert.equal(await sendTeamEmail({ force: true }), 0);
  });

  test('the daily cron sends whatever is still waiting', async () => {
    await sql`insert into registrations (name, email, notified_at) values ('Hari', 'hari@example.com', null)`;
    await sql`update notify_state set last_sent_at = now()`; // an email just went out
    const res = await app.inject({ method: 'GET', url: '/api/cron/reconcile', headers: { authorization: 'Bearer test-cron-secret' } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(res.json(), { settled: 0, emailed: 1 });
    assert.match(resend.sent[0].text, /Hari/);
  });
});
