import crypto from 'node:crypto';
import { config } from '../config.js';
import { sql } from '../db.js';
import { formatMoney } from '../lib/money.js';

// Emails the team about new registrations and payments, through Resend (resend.com). Off until
// RESEND_API_KEY and NOTIFY_EMAIL are set.
//
// Rows are claimed in the database before sending (notified_at), so each one is emailed once
// however many servers run; if Resend fails, they are released and go out with the next email.
// At most one email a minute: a rush of sign-ups arrives as one email listing them all, and the
// daily cron sends anything still waiting.

export const notifyEnabled = Boolean(config.resendApiKey && config.notifyEmails.length);

const MAX_ITEMS = 50;
const TIMEOUT_MS = 10_000;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const children = n => (n === 1 ? '1 child' : `${n} children`);
const day = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');

/**
 * Sends one email with everything new since the last one, if there is anything and the last
 * email was over a minute ago (`force` skips that wait). Returns how many items it covered.
 */
export async function sendTeamEmail({ force = false } = {}) {
  if (!notifyEnabled) return 0;
  const [{ waiting }] = await sql`
    select exists (select 1 from registrations where notified_at is null)
        or exists (select 1 from orders where notified_at is null and status = 'paid') as waiting`;
  if (!waiting) return 0;

  // One email a minute across all servers: whoever moves the clock sends it.
  const [slot] = force
    ? await sql`update notify_state set last_sent_at = now() where id = 1 returning 1`
    : await sql`update notify_state set last_sent_at = now() where id = 1 and last_sent_at < now() - interval '1 minute' returning 1`;
  if (!slot) return 0;

  const registrations = await sql`
    update registrations r set notified_at = now()
    from (select id from registrations where notified_at is null order by id limit ${MAX_ITEMS} for update skip locked) c
    where r.id = c.id
    returning r.id, r.name, r.email, r.phone, r.kids, r.age_range, r.preferred_date, r.city, r.venue_type, r.notes,
      (select title from missions m where m.slug = r.mission_slug) as mission`;
  const payments = await sql`
    update orders o set notified_at = now()
    from (select id from orders where notified_at is null and status = 'paid' order by paid_at limit ${MAX_ITEMS} for update skip locked) c
    where o.id = c.id
    returning o.id, o.name, o.email, o.phone, o.kids, o.amount, o.currency, o.description, o.registration_id`;
  if (!registrations.length && !payments.length) return 0;

  try {
    await deliver(compose(registrations, payments));
  } catch (err) {
    // Give them back, so the next email includes them.
    if (registrations.length) await sql`update registrations set notified_at = null where id = any(${registrations.map(r => r.id)}::bigint[])`;
    if (payments.length) await sql`update orders set notified_at = null where id = any(${payments.map(p => p.id)}::uuid[])`;
    await sql`update notify_state set last_sent_at = 'epoch' where id = 1`;
    throw err;
  }
  return registrations.length + payments.length;
}

function compose(registrations, payments) {
  const admin = `${config.siteUrl}/admin`;
  const subject = 'GROWND: ' + [
    registrations.length && plural(registrations.length, 'new registration'),
    payments.length && plural(payments.length, 'payment')
  ].filter(Boolean).join(' and ');

  const regLines = registrations.map(r => [
    `${r.name} <${r.email}>${r.phone ? `, ${r.phone}` : ''}`,
    [r.mission || 'No mission picked yet', r.kids && children(r.kids), r.age_range && `ages ${r.age_range}`,
      r.preferred_date && `around ${day(r.preferred_date)}`, r.city, r.venue_type].filter(Boolean).join(' · '),
    r.notes && `"${r.notes}"`
  ].filter(Boolean));
  const payLines = payments.map(p => [
    `${formatMoney(p.amount, p.currency)} from ${p.name} <${p.email}>${p.phone ? `, ${p.phone}` : ''}`,
    [p.description, p.kids && children(p.kids)].filter(Boolean).join(' · ')
  ]);

  const section = (title, items, link, linkText) => items.length ? {
    text: `${title}\n\n${items.map(lines => lines.join('\n')).join('\n\n')}\n\n${linkText}: ${link}`,
    html: `<h2 style="font:700 18px sans-serif;margin:24px 0 12px">${esc(title)}</h2>` +
      items.map(lines => `<p style="margin:0 0 14px;font:15px/1.5 sans-serif"><strong>${esc(lines[0])}</strong>${lines.slice(1).map(l => `<br>${esc(l)}`).join('')}</p>`).join('') +
      `<p style="margin:0;font:15px sans-serif"><a href="${esc(link)}">${esc(linkText)}</a></p>`
  } : null;
  const parts = [
    section(plural(registrations.length, 'new registration'), regLines, `${admin}#/registrations?status=new`, 'Reply in the dashboard'),
    section(plural(payments.length, 'payment'), payLines, `${admin}#/payments`, 'See payments')
  ].filter(Boolean);

  return {
    subject,
    text: parts.map(p => p.text).join('\n\n---\n\n'),
    html: `<div style="max-width:560px">${parts.map(p => p.html).join('')}</div>`,
    // Just one person to answer: "Reply" in the email client goes straight to them.
    replyTo: registrations.length + payments.length === 1 ? (registrations[0] || payments[0]).email : undefined,
    key: crypto.createHash('sha256').update([...registrations.map(r => `r${r.id}`), ...payments.map(p => `o${p.id}`)].join(',')).digest('hex')
  };
}

async function deliver({ subject, text, html, replyTo, key }) {
  const res = await fetch(`${config.resendApiBase}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key // a retried request never sends the same email twice
    },
    body: JSON.stringify({ from: config.notifyFrom, to: config.notifyEmails, subject, text, html, ...(replyTo && { reply_to: replyTo }) }),
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Resend answered ${res.status}: ${body.message || body.name || 'no details'}`);
  }
}
