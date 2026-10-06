// GROWND admin dashboard. Plain DOM, no build step.
// Sign-in is Supabase Auth; every API call to /api/admin carries the Supabase access token.

// Pinned so a new release can never change the dashboard under you.
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

const app = document.getElementById('app');
const toastHost = document.getElementById('toast');

const TYPES = {
  bio: { name: 'Biologist', color: 'var(--bio)' },
  chem: { name: 'Chemist', color: 'var(--chem)' },
  phys: { name: 'Physicist', color: 'var(--phys)' },
  eng: { name: 'Engineer', color: 'var(--eng)' }
};
const STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['confirmed', 'Confirmed'], ['cancelled', 'Cancelled']];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const AGE_LABEL = { '5-8': '5-8', '7-11': '7-11', '8-12': '8-12', mixed: 'Mixed ages, 5-12' };
const SETTING_LABEL = { currency: 'currency', timezone: 'timezone label', responseTime: 'reply time', insuranceNote: 'safety and checks note' };
const NAV = [
  ['overview', 'Overview', 'grid'],
  ['registrations', 'Registrations', 'inbox'],
  ['payments', 'Payments', 'card'],
  ['missions', 'Missions & dates', 'cal'],
  ['settings', 'Settings', 'sliders']
];
const ORDER_STATUS = {
  pending: 'Awaiting payment', processing: 'Clearing', paid: 'Paid', failed: 'Failed',
  expired: 'Expired', cancelled: 'Cancelled', refunded: 'Refunded'
};
const ORDER_GROUPS = [['', 'All'], ['paid', 'Paid'], ['awaiting', 'Awaiting'], ['refunded', 'Refunded'], ['closed', 'Closed']];

// Same 24px stroke icon style as the public site.
const ICONS = {
  flask: ['M9 3h6', 'M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3', 'M7.2 15h9.6'],
  grid: ['M4 4h7v7H4z', 'M13 4h7v7h-7z', 'M4 13h7v7H4z', 'M13 13h7v7h-7z'],
  inbox: ['M4 13l2.5-8h11L20 13', 'M4 13v6h16v-6', 'M4 13h4.5l1 2.5h5l1-2.5H20'],
  cal: ['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4'],
  sliders: ['M4 7h9', 'M17 7h3', 'M15 5v4', 'M4 17h3', 'M11 17h9', 'M9 15v4', 'M4 12h13', 'M20 12h0'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  warn: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17v.01'],
  download: ['M12 4v11', 'M7 10l5 5 5-5', 'M5 20h14'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'M20 20l-4-4'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5H5V6h5'],
  plus: ['M12 6v12', 'M6 12h12'],
  minus: ['M6 12h12'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M13 7l4 4'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3'],
  mail: ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  phone: ['M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6'],
  card: ['M3 6h18v12H3z', 'M3 10h18', 'M7 15h4'],
  copy: ['M9 9h11v11H9z', 'M5 15H4V4h11v1'],
  link: ['M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  undo: ['M9 14L4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-3']
};

// ---------- tiny DOM helpers ----------

function icon(name, size = 18, strokeWidth = 2) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  const attrs = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' };
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, v);
  for (const d of ICONS[name]) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'open']);

/** h('a', { href, onclick }, ...children). Text children are always inserted as text, never HTML. */
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k));
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') for (const [p, val] of Object.entries(v)) el.style.setProperty(p, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (PROPS.has(k)) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  return el;
}

/** replaceChildren that skips null/false children, like h() does. */
const fill = (el, ...kids) => el.replaceChildren(...kids.filter(k => k != null && k !== false));

let uid = 0;
/** A labelled form field with an optional hint and an error slot (field.setError). */
function field(label, control, { hint, span } = {}) {
  const id = 'f' + ++uid;
  const err = h('span', { class: 'err', id: id + '-err', hidden: true });
  const hintEl = hint ? h('span', { class: 'hint', id: id + '-hint' }, hint) : null;
  control.setAttribute('aria-describedby', [hintEl && id + '-hint', id + '-err'].filter(Boolean).join(' '));
  const el = h('label', { class: 'field' + (span ? ' span-2' : '') }, h('span', { class: 'label' }, label), control, hintEl, err);
  el.setError = msg => {
    err.textContent = msg || '';
    err.hidden = !msg;
    control.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  return el;
}

function pageHead(eyebrow, title, lede, ...actions) {
  return h('header', { class: 'page-head' },
    h('div', null, h('p', { class: 'eyebrow mono' }, eyebrow), h('h1', { tabindex: '-1' }, title), lede && h('p', { class: 'lede' }, lede)),
    actions.length ? h('div', { class: 'head-actions' }, actions) : null);
}

const errorBox = e => h('div', { class: 'error-box', role: 'alert' }, e.message || String(e));
const loading = () => h('p', { class: 'muted' }, 'Loading…');

function toast(message, bad = false) {
  const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, icon(bad ? 'warn' : 'check'), message);
  toastHost.append(t);
  setTimeout(() => t.remove(), 3600);
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- formatting ----------

const fmtDay = d => d
  ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  : 'Date to be confirmed';
const fmtStamp = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function ago(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'Just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  const d = Math.floor(s / 86400);
  if (d < 7) return d === 1 ? 'Yesterday' : d + ' days ago';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function money(n, currency) {
  if (n == null) return 'Not set';
  try {
    if (currency) return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {}
  return n.toFixed(n % 1 ? 2 : 0);
}

const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const typeColor = type => (TYPES[type] ? TYPES[type].color : 'var(--hair-strong)');
const missionChip = (title, type) => title
  ? h('span', { class: 'chip', style: { '--type': typeColor(type) } }, title)
  : h('span', { class: 'chip none' }, 'Not picked');
const statusPill = s => h('span', { class: 'pill s-' + s }, STATUS_LABEL[s]);

/** Formats an amount held in the currency's smallest unit (pence, cents). */
function moneyMinor(minor, currency) {
  const format = new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency.toUpperCase() });
  return format.format(minor / 10 ** format.resolvedOptions().maximumFractionDigits);
}
const sumsText = (list, key) => (list.length ? list.map(x => moneyMinor(x[key], x.currency)).join(' + ') : '–');
function orderPill(o) {
  const partly = o.status === 'paid' && o.amountRefunded > 0;
  return h('span', { class: 'pill o-' + (partly ? 'partial' : o.status) }, partly ? 'Part refunded' : ORDER_STATUS[o.status]);
}

async function copyText(text, what = 'Link') {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`);
  } catch {
    toast('Could not copy. Select the text and copy it yourself.', true);
  }
}

/** A read-only payment link with Copy and "Email it" buttons. */
function payLinkBox(order) {
  const input = h('input', { class: 'input', type: 'text', readonly: true, value: order.payUrl, 'aria-label': 'Payment link', onfocus: e => e.target.select() });
  const subject = `Payment for ${order.description}`;
  const body = `Hi ${order.name.split(/\s+/)[0]},\n\nHere is the link to pay ${moneyMinor(order.amount, order.currency)} for ${order.description}:\n${order.payUrl}\n\nThank you,\nThe GROWND team`;
  return h('div', { class: 'pay-link' },
    input,
    h('div', { class: 'contact' },
      h('button', { class: 'btn small', type: 'button', onclick: () => copyText(order.payUrl) }, icon('copy', 16), 'Copy link'),
      h('a', { class: 'btn small', href: `mailto:${order.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` }, icon('mail', 16), 'Email it')));
}
const byDate = (a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || '') || a.id - b.id;

// ---------- API ----------

class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || {};
  }
}

let supabase = null;
let me = null;

/** fetch() to /api/admin with the current access token (supabase-js refreshes it as needed). */
async function authedFetch(path, init = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = { ...init.headers };
  if (data.session) headers.Authorization = 'Bearer ' + data.session.access_token;
  let res;
  try {
    res = await fetch('/api/admin' + path, { ...init, headers });
  } catch {
    throw new ApiError('Could not reach the server. Check it is running and try again.', 0);
  }
  if (res.status === 401) signedOut('Your session ended. Please sign in again.');
  return res;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await authedFetch(path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong.', res.status, data.errors);
  return data;
}

async function downloadCsv(query) {
  const res = await authedFetch('/registrations.csv' + query);
  if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).error || 'Export failed.', res.status);
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'grownd-registrations.csv';
  const url = URL.createObjectURL(await res.blob());
  const a = h('a', { href: url, download: name, hidden: true });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
let shell = null;
const cache = {};

async function getSettings(fresh = false) {
  if (fresh || !cache.settings) cache.settings = await api('/settings');
  return cache.settings;
}

async function getMissionList() {
  if (!cache.missions) cache.missions = (await api('/missions')).missions.map(({ slug, title, type }) => ({ slug, title, type }));
  return cache.missions;
}

// ---------- sign in / out ----------

function brand() {
  return [h('span', { class: 'mark' }, icon('flask', 22, 2.2)), h('span', { class: 'brand-name' }, 'GROWND', h('small', null, 'ADMIN'))];
}

function renderLogin(message) {
  shell = null;
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'username', required: true, spellcheck: 'false' });
  const password = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true });
  const err = h('p', { class: 'form-error', role: 'alert' }, message || '');
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Sign in');
  const form = h('form', {
    class: 'login-card',
    onsubmit: async e => {
      e.preventDefault();
      err.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: email.value.trim(), password: password.value });
        if (error) throw new Error(/invalid login/i.test(error.message) ? 'That email and password do not match.' : error.message);
        try {
          me = await api('/me');
        } catch (x) {
          await supabase.auth.signOut({ scope: 'local' });
          throw x;
        }
        start();
      } catch (x) {
        err.textContent = x.message;
        btn.disabled = false;
        btn.textContent = 'Sign in';
        password.select();
      }
    }
  },
    h('div', { class: 'brand' }, brand()),
    h('div', null, h('h1', null, 'Sign in'), h('p', { class: 'muted' }, 'Registrations, dates and prices for the GROWND site.')),
    field('Email', email),
    field('Password', password),
    err,
    btn);
  app.replaceChildren(h('main', { class: 'login' }, form));
  document.title = 'Sign in · GROWND Admin';
  email.focus();
}

function signedOut(message) {
  if (!me) return;
  me = null;
  for (const k of Object.keys(cache)) delete cache[k];
  document.querySelectorAll('.drawer, .backdrop').forEach(n => n.remove());
  renderLogin(message);
  supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

async function signOut() {
  me = null;
  for (const k of Object.keys(cache)) delete cache[k];
  document.querySelectorAll('.drawer, .backdrop').forEach(n => n.remove());
  await supabase.auth.signOut().catch(() => {});
  history.replaceState(null, '', location.pathname);
  renderLogin();
}

// ---------- shell and routing ----------

function renderShell() {
  const links = {};
  const badge = h('span', { class: 'badge', hidden: true });
  const nav = h('nav', { class: 'nav', 'aria-label': 'Admin sections' },
    NAV.map(([key, label, ic]) => (links[key] = h('a', { href: '#/' + key }, icon(ic, 20), label, key === 'registrations' ? badge : null))));
  const main = h('main', { class: 'main', id: 'main', tabindex: '-1' });
  const testPill = h('span', { class: 'test-pill', hidden: true, title: 'Payments use Razorpay test keys: no real money moves.' }, 'Razorpay test mode');
  app.replaceChildren(h('div', { class: 'shell' },
    h('aside', { class: 'side' },
      h('a', { class: 'brand', href: '#/overview', 'aria-label': 'GROWND admin overview' }, brand()),
      nav,
      h('div', { class: 'side-foot' },
        testPill,
        h('span', { class: 'who', title: me.email }, me.email),
        h('a', { class: 'view-site', href: '/', target: '_blank', rel: 'noopener' }, icon('external', 16), h('span', null, 'View site')),
        h('button', { class: 'btn small', type: 'button', onclick: signOut }, 'Sign out'))),
    main));
  shell = { main, links, badge, testPill, view: null, name: null };
}

const refreshBadge = debounce(async () => {
  if (!shell) return;
  try {
    const s = await api('/stats');
    const n = s.byStatus.new;
    shell.badge.hidden = !n;
    shell.badge.replaceChildren(String(n), h('span', { class: 'sr-only' }, ' new'));
    cache.payments = s.payments;
    shell.testPill.hidden = !(s.payments.enabled && s.payments.testMode);
  } catch {}
}, 150);

const VIEWS = { overview: OverviewView, registrations: RegistrationsView, payments: PaymentsView, missions: MissionsView, settings: SettingsView };

function parseHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: VIEWS[path] ? path : 'overview', query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

async function route() {
  if (!me || !shell) return;
  const { name, query } = parseHash();
  const fresh = shell.name !== name;
  if (fresh) {
    if (shell.view && shell.view.destroy) shell.view.destroy();
    shell.name = name;
    shell.view = VIEWS[name]();
    shell.main.replaceChildren(shell.view.el);
    for (const [key, a] of Object.entries(shell.links)) {
      if (key === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    document.title = NAV.find(n => n[0] === name)[1] + ' · GROWND Admin';
    window.scrollTo(0, 0);
  }
  refreshBadge();
  await shell.view.update(query);
  if (fresh && !query.open) shell.view.el.querySelector('h1')?.focus({ preventScroll: true });
}

function start() {
  renderShell();
  route();
}

// ---------- overview ----------

function OverviewView() {
  const body = h('div', null, loading());
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const el = h('div', null, pageHead('OVERVIEW', hello, 'What needs a reply, what is booked, and what the site is still missing.'), body);

  function tile(label, value, sub, href, hot) {
    return h('a', { class: 'tile' + (hot ? ' hot' : ''), href }, h('p', { class: 'mono' }, label), h('p', { class: 'value' }, value), h('p', { class: 'sub' }, sub));
  }

  function setupPanel(setup) {
    const items = [];
    for (const k of setup.settings) items.push(['Set the ' + SETTING_LABEL[k] + '. The site still shows a placeholder for it.', '#/settings', 'Open settings']);
    if (setup.unpriced.length) items.push([`No price yet for ${setup.unpriced.join(', ')}.`, '#/missions', 'Add prices']);
    if (setup.undated.length) items.push([`No upcoming dates for ${setup.undated.join(', ')}. These show “Register interest” on the site.`, '#/missions', 'Add dates']);
    if (setup.payments) items.push(['Online payments are off. Add the Razorpay keys to the backend (see SETUP.md) to take bookings and send payment links.', '#/payments', 'Payments']);
    if (!items.length) return null;
    return h('section', { class: 'panel setup', 'aria-labelledby': 'setup-h' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'setup-h' }, 'Before launch'), h('span', { class: 'muted' }, plural(items.length, 'thing') + ' to fill in')),
      h('ul', null, items.map(([text, href, cta]) => h('li', null, icon('warn'), h('span', null, text + ' ', h('a', { href }, cta))))));
  }

  function replyPanel(list) {
    return h('section', { class: 'panel', 'aria-labelledby': 'reply-h' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'reply-h' }, 'Needs a reply'), list.total > 0 && h('a', { href: '#/registrations?status=new' }, 'See all ' + list.total)),
      list.items.length
        ? h('ul', { class: 'reply-list' }, list.items.slice(0, 6).map(r => h('li', null,
          h('a', { href: '#/registrations?status=new&open=' + r.id },
            h('span', { class: 'name' }, r.name),
            h('span', { class: 'meta' }, [r.missionTitle || 'No mission picked', r.kids ? plural(r.kids, 'child', 'children') : null, r.city].filter(Boolean).join(' · ')),
            h('span', { class: 'when' }, ago(r.createdAt))))))
        : h('p', { class: 'empty' }, 'Nothing waiting. New sign-ups from the site land here.'));
  }

  function missionPanel(s) {
    const rows = s.missions.map(m => ({ label: m.title, n: m.registrations, color: typeColor(m.type), href: '#/registrations?mission=' + m.slug }));
    if (s.unassigned) rows.push({ label: 'Not picked', n: s.unassigned, color: 'var(--hair-strong)', href: '#/registrations?mission=none' });
    const max = Math.max(1, ...rows.map(r => r.n));
    return h('section', { class: 'panel', 'aria-labelledby': 'interest-h' },
      h('div', { class: 'panel-head' }, h('h2', { id: 'interest-h' }, 'Interest by mission'), h('span', { class: 'muted' }, plural(s.total, 'registration'))),
      h('ul', { class: 'bars' }, rows.map(r => h('li', null,
        h('a', { class: 'bar-row', href: r.href, 'aria-label': `${r.label}: ${plural(r.n, 'registration')}` },
          h('span', { class: 'bar-label' }, r.label),
          h('span', { class: 'bar-count' }, r.n),
          h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill', style: { width: (r.n / max) * 100 + '%', '--type': r.color } })))))));
  }

  return {
    el,
    async update() {
      try {
        const [s, fresh] = await Promise.all([api('/stats'), api('/registrations?status=new')]);
        fill(body,
          h('div', { class: 'tiles' },
            tile('NEEDS A REPLY', s.byStatus.new, s.byStatus.new ? 'New registrations waiting' : 'All caught up', '#/registrations?status=new', s.byStatus.new > 0),
            tile('PAID · 30 DAYS', sumsText(s.revenue30d, 'amount'),
              !s.payments.enabled ? 'Online payments are off' : s.payments.testMode ? 'Razorpay test mode' : 'After refunds', '#/payments?status=paid', false),
            tile('PLACES BOOKED', s.bookedPlaces, 'Paid places on upcoming dates', '#/payments?status=paid', false),
            tile('UPCOMING DATES', s.upcoming.total, s.upcoming.soldOut ? s.upcoming.soldOut + ' sold out' : 'None sold out', '#/missions', false)),
          setupPanel(s.setup),
          h('div', { class: 'grid-2' }, replyPanel(fresh), missionPanel(s)));
      } catch (e) {
        body.replaceChildren(errorBox(e));
      }
    }
  };
}

// ---------- registrations ----------

function RegistrationsView() {
  let query = {}, listKey = null, seq = 0, data = null, drawer = null;
  const KEYS = ['status', 'mission', 'q', 'page', 'open'];

  const params = (patch = {}) => {
    const merged = { ...query, ...patch }, p = new URLSearchParams();
    for (const k of KEYS) if (merged[k]) p.set(k, merged[k]);
    return p;
  };
  const hrefFor = patch => {
    const p = params(patch).toString();
    return '#/registrations' + (p ? '?' + p : '');
  };
  const go = patch => { location.hash = hrefFor(patch); };

  const search = h('input', {
    class: 'input', type: 'search', placeholder: 'Search name, email, phone, city or notes', 'aria-label': 'Search registrations',
    oninput: debounce(() => go({ q: search.value.trim(), page: '' }), 250)
  });
  const missionSelect = h('select', { class: 'select', 'aria-label': 'Filter by mission', onchange: () => go({ mission: missionSelect.value, page: '' }) },
    h('option', { value: '' }, 'All missions'));
  let exportQuery = '';
  const exportButton = h('button', {
    class: 'btn', type: 'button',
    onclick: async () => {
      exportButton.disabled = true;
      try {
        await downloadCsv(exportQuery);
      } catch (e) {
        toast(e.message, true);
      } finally {
        exportButton.disabled = false;
      }
    }
  }, icon('download'), 'Export CSV');
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Filter by status' });
  const table = h('div', { class: 'panel table-panel' }, h('p', { class: 'empty' }, 'Loading…'));
  const el = h('div', null,
    pageHead('REGISTRATIONS', 'Registrations', 'Everyone who sent the register form on the site. Click someone to see the details and update their status.', exportButton),
    h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icon('search'), search), missionSelect),
    tabs,
    table);

  async function loadList(force = false) {
    const key = params({ open: '' }).toString();
    if (!force && key === listKey) return;
    listKey = key;
    const mine = ++seq;
    try {
      const d = await api('/registrations?' + key);
      if (mine !== seq) return;
      data = d;
      renderTabs();
      renderTable();
    } catch (e) {
      if (mine === seq) table.replaceChildren(errorBox(e));
    }
  }

  function renderTabs() {
    const all = Object.values(data.counts).reduce((a, b) => a + b, 0);
    tabs.replaceChildren(...[['', 'All', all], ...STATUSES.map(([k, label]) => [k, label, data.counts[k]])].map(([k, label, n]) =>
      h('a', { href: hrefFor({ status: k, page: '', open: '' }), 'aria-current': (query.status || '') === k ? 'page' : null }, label, h('span', { class: 'n' }, n))));
  }

  function renderTable() {
    if (!data.items.length) {
      const filtered = query.q || query.status || query.mission;
      table.replaceChildren(h('p', { class: 'empty' }, filtered ? 'Nothing matches these filters.' : 'No registrations yet. When someone sends the form on the site, they show up here.'));
      return;
    }
    const rows = data.items.map(r => {
      const href = hrefFor({ open: r.id });
      return h('tr', {
        class: 'clickable' + (String(r.id) === query.open ? ' is-open' : ''), 'data-id': r.id,
        onclick: e => { if (!e.target.closest('a')) location.hash = href; }
      },
        h('td', { class: 'nowrap', title: fmtStamp(r.createdAt) }, ago(r.createdAt)),
        h('td', null, h('a', { class: 'primary-link', href }, r.name), h('span', { class: 'sub' }, r.email)),
        h('td', null, missionChip(r.missionTitle, r.missionType)),
        h('td', { class: 'num' }, r.kids ?? '–'),
        h('td', { class: 'hide-sm nowrap' }, r.preferredDate ? fmtDay(r.preferredDate) : '–'),
        h('td', { class: 'hide-sm' }, r.city || '–'),
        h('td', null, statusPill(r.status)));
    });
    const from = (data.page - 1) * data.pageSize + 1, to = from + data.items.length - 1;
    const pages = Math.ceil(data.total / data.pageSize);
    table.replaceChildren(
      h('div', { class: 'table-scroll' }, h('table', null,
        h('thead', null, h('tr', null,
          h('th', null, 'Received'), h('th', null, 'Parent'), h('th', null, 'Mission'), h('th', null, 'Children'),
          h('th', { class: 'hide-sm' }, 'Preferred date'), h('th', { class: 'hide-sm' }, 'City'), h('th', null, 'Status'))),
        h('tbody', null, rows))),
      h('div', { class: 'pager' },
        h('span', null, `${from}–${to} of ${data.total}`),
        pages > 1 && h('div', { class: 'btns' },
          h('button', { class: 'btn small', type: 'button', disabled: data.page <= 1, onclick: () => go({ page: data.page > 2 ? data.page - 1 : '' }) }, 'Previous'),
          h('button', { class: 'btn small', type: 'button', disabled: data.page >= pages, onclick: () => go({ page: data.page + 1 }) }, 'Next'))));
  }

  // ---- detail drawer ----

  async function openDrawer(id) {
    if (drawer && drawer.id === id) return;
    closeDrawer(false);
    let r;
    try {
      r = await api('/registrations/' + id);
    } catch (e) {
      toast(e.message, true);
      go({ open: '' });
      return;
    }
    if (query.open !== String(id)) return; // the person moved on while it loaded
    drawer = { id, r };
    renderDrawer();
  }

  function closeDrawer(restoreFocus = true) {
    if (!drawer) return;
    drawer.nodes.forEach(n => n.remove());
    const id = drawer.id;
    drawer = null;
    if (restoreFocus) table.querySelector(`tr[data-id="${id}"] .primary-link`)?.focus();
  }

  function renderDrawer() {
    const { r } = drawer;
    const close = () => go({ open: '' });
    const dd = (label, value) => [h('dt', null, label), h('dd', null, value)];
    const notes = h('textarea', { class: 'textarea', value: r.adminNotes, placeholder: 'Calls made, dates offered, quotes sent…', 'aria-label': 'Internal notes' });
    const statusButtons = STATUSES.map(([k, label]) => h('button', {
      type: 'button', class: 's-' + k, 'data-status': k, 'aria-pressed': String(r.status === k), onclick: () => setStatus(k)
    }, label));
    const heading = h('h2', { id: 'drawer-title', tabindex: '-1' }, r.name);

    async function setStatus(k) {
      if (drawer.r.status === k) return;
      try {
        drawer.r = await api('/registrations/' + drawer.id, { method: 'PATCH', body: { status: k } });
        statusButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.status === drawer.r.status)));
        toast('Marked as ' + STATUS_LABEL[k].toLowerCase());
        loadList(true);
        refreshBadge();
      } catch (e) {
        toast(e.message, true);
      }
    }

    async function saveNotes() {
      try {
        drawer.r = await api('/registrations/' + drawer.id, { method: 'PATCH', body: { adminNotes: notes.value } });
        toast('Notes saved');
      } catch (e) {
        toast(e.message, true);
      }
    }

    async function remove() {
      if (!confirm(`Delete ${r.name}'s registration? This cannot be undone.`)) return;
      try {
        await api('/registrations/' + drawer.id, { method: 'DELETE' });
        toast('Registration deleted');
        listKey = null;
        closeDrawer(false);
        go({ open: '' });
        refreshBadge();
      } catch (e) {
        toast(e.message, true);
      }
    }

    const panel = h('aside', {
      class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'drawer-title',
      onkeydown: e => {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key !== 'Tab') return;
        const f = [...panel.querySelectorAll('a[href], button:not([disabled]), textarea, input, select')];
        if (!f.length) return;
        if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === heading)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    },
      h('div', { class: 'drawer-head' },
        h('div', null, heading, h('p', { class: 'sub' }, 'Received ' + fmtStamp(r.createdAt))),
        h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Close details', onclick: close }, icon('close', 20))),
      h('div', { class: 'drawer-body' },
        h('section', null, h('p', { class: 'section-label mono' }, 'Status'), h('div', { class: 'status-set', role: 'group', 'aria-label': 'Status' }, statusButtons)),
        h('section', null, h('p', { class: 'section-label mono' }, 'Contact'),
          h('div', { class: 'contact' },
            h('a', { class: 'btn small', href: 'mailto:' + r.email }, icon('mail', 16), r.email),
            r.phone && h('a', { class: 'btn small', href: 'tel:' + r.phone.replace(/[^\d+]/g, '') }, icon('phone', 16), r.phone))),
        h('section', null, h('p', { class: 'section-label mono' }, 'Details'),
          h('dl', { class: 'details' },
            dd('Mission', missionChip(r.missionTitle, r.missionType)),
            dd('Children', r.kids ?? 'Not given'),
            dd('Age range', AGE_LABEL[r.ageRange] || 'Not given'),
            dd('Preferred date', r.preferredDate ? fmtDay(r.preferredDate) : 'Not given'),
            dd('City', r.city || 'Not given'),
            dd('Venue', r.venueType || 'Not given'),
            dd('Consent', 'Yes, ' + fmtStamp(r.consentAt)))),
        r.notes && h('section', null, h('p', { class: 'section-label mono' }, 'Their notes'), h('p', { class: 'quote' }, r.notes)),
        h('section', null, h('p', { class: 'section-label mono' }, 'Internal notes'), notes,
          h('div', { class: 'form-actions' }, h('button', { class: 'btn', type: 'button', onclick: saveNotes }, 'Save notes'), h('span', { class: 'muted' }, 'Only admins see these.'))),
        RegistrationPayments(r),
        h('section', { class: 'danger-zone' }, h('button', { class: 'btn danger', type: 'button', onclick: remove }, icon('trash', 16), 'Delete registration'))));
    const backdrop = h('div', { class: 'backdrop', onclick: close });
    drawer.nodes = [backdrop, panel];
    document.body.append(backdrop, panel);
    heading.focus();
  }

  return {
    el,
    async update(q) {
      query = q;
      if (missionSelect.options.length === 1) {
        try {
          const missions = await getMissionList();
          missionSelect.append(...missions.map(m => h('option', { value: m.slug }, m.title)), h('option', { value: 'none' }, 'No mission picked'));
        } catch {}
      }
      if (document.activeElement !== search) search.value = query.q || '';
      missionSelect.value = query.mission || '';
      const exportParams = params({ page: '', open: '' }).toString();
      exportQuery = exportParams ? '?' + exportParams : '';
      await loadList();
      table.querySelectorAll('tr[data-id]').forEach(tr => tr.classList.toggle('is-open', tr.dataset.id === query.open));
      if (query.open) openDrawer(Number(query.open));
      else closeDrawer();
    },
    destroy() { closeDrawer(false); }
  };
}

// ---------- payments ----------

/** The "Payment" block in a registration's drawer: links already sent, and a form to send one. */
function RegistrationPayments(r) {
  const body = h('div', { class: 'pay-block' }, h('p', { class: 'muted' }, 'Loading…'));
  const section = h('section', null, h('p', { class: 'section-label mono' }, 'Payment'), body);
  let items = [], settings = null;

  function render() {
    const existing = items.map(o => h('div', { class: 'pay-item' },
      h('div', { class: 'pay-item-top' }, orderPill(o), h('strong', null, moneyMinor(o.amount, o.currency)), h('a', { href: '#/payments?open=' + o.id }, 'Details')),
      h('p', { class: 'muted' }, o.description),
      o.kind === 'request' && o.status === 'pending' ? payLinkBox(o) : null));
    const amount = h('input', { class: 'input', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', placeholder: '0.00' });
    const description = h('input', { class: 'input', type: 'text', maxlength: '300', value: `${r.missionTitle || 'GROWND session'} for ${r.name}` });
    const days = h('select', { class: 'select' }, [7, 14, 30].map(d => h('option', { value: String(d) }, `${d} days`)));
    days.value = '14';
    const fields = {
      description: field('What it is for', description, { span: true, hint: 'They see this on the payment page and on their receipt.' }),
      amount: field(`Amount (${settings.currency})`, amount),
      days: field('Link works for', days)
    };
    const formError = h('p', { class: 'form-error', role: 'alert' });
    const button = h('button', { class: 'btn primary', type: 'submit' }, icon('link', 16), 'Create payment link');
    const form = h('form', {
      novalidate: true,
      onsubmit: async e => {
        e.preventDefault();
        Object.values(fields).forEach(f => f.setError(''));
        formError.textContent = '';
        button.disabled = true;
        try {
          const order = await api(`/registrations/${r.id}/payment-requests`, {
            method: 'POST', body: { amount: amount.value, description: description.value, days: Number(days.value) }
          });
          items = [order, ...items];
          render();
          toast('Payment link created. Copy it or email it to them.');
          body.querySelector('.pay-link input')?.focus();
        } catch (err) {
          for (const [k, msg] of Object.entries(err.errors)) fields[k]?.setError(msg);
          formError.textContent = err.message;
          button.disabled = false;
        }
      }
    }, h('div', { class: 'form-grid' }, fields.description, fields.amount, fields.days), formError, h('div', { class: 'form-actions' }, button));
    fill(body, ...existing,
      h('p', { class: 'muted' }, existing.length ? 'Ask for another payment:' : 'Send a link they can pay by card. Once it is paid, this registration is marked confirmed.'),
      form);
  }

  (async () => {
    try {
      const [orders, s] = await Promise.all([api('/orders?registration=' + r.id), getSettings()]);
      if (!orders.payments.enabled) return body.replaceChildren(h('p', { class: 'muted' }, 'Online payments are off. Add the Razorpay keys to the backend to send payment links.'));
      if (!s.currency) return body.replaceChildren(h('p', { class: 'muted' }, 'Set the currency in Settings to send payment links.'));
      items = orders.items;
      settings = s;
      render();
    } catch (e) {
      body.replaceChildren(errorBox(e));
    }
  })();
  return section;
}

function PaymentsView() {
  let query = {}, listKey = null, seq = 0, data = null, drawer = null;
  const KEYS = ['status', 'kind', 'event', 'q', 'page', 'open'];

  const params = (patch = {}) => {
    const merged = { ...query, ...patch }, p = new URLSearchParams();
    for (const k of KEYS) if (merged[k]) p.set(k, merged[k]);
    return p;
  };
  const hrefFor = patch => {
    const p = params(patch).toString();
    return '#/payments' + (p ? '?' + p : '');
  };
  const go = patch => { location.hash = hrefFor(patch); };

  const search = h('input', {
    class: 'input', type: 'search', placeholder: 'Search name, email or what it was for', 'aria-label': 'Search payments',
    oninput: debounce(() => go({ q: search.value.trim(), page: '' }), 250)
  });
  const kindSelect = h('select', { class: 'select', 'aria-label': 'Filter by type', onchange: () => go({ kind: kindSelect.value, page: '' }) },
    h('option', { value: '' }, 'Bookings and payment links'),
    h('option', { value: 'booking' }, 'Date bookings'),
    h('option', { value: 'request' }, 'Payment links'));
  const notice = h('div');
  const tiles = h('div', { class: 'tiles three' });
  const eventBar = h('div');
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Filter by status' });
  const table = h('div', { class: 'panel table-panel' }, h('p', { class: 'empty' }, 'Loading…'));
  const el = h('div', null,
    pageHead('PAYMENTS', 'Payments', 'Dates booked and paid on the site, and payment links sent from registrations. Card and UPI details stay with Razorpay.'),
    notice, tiles,
    h('div', { class: 'toolbar spaced' }, h('div', { class: 'search' }, icon('search'), search), kindSelect),
    eventBar, tabs, table);

  const statTile = (label, value, sub) => h('div', { class: 'tile' }, h('p', { class: 'mono' }, label), h('p', { class: 'value small' }, value), h('p', { class: 'sub' }, sub));

  async function loadList(force = false) {
    const key = params({ open: '' }).toString();
    if (!force && key === listKey) return;
    listKey = key;
    const mine = ++seq;
    try {
      const d = await api('/orders?' + key);
      if (mine !== seq) return;
      data = d;
      renderTop();
      renderTabs();
      renderTable();
    } catch (e) {
      if (mine === seq) table.replaceChildren(errorBox(e));
    }
  }

  function renderTop() {
    const s = data.summary;
    fill(notice,
      !data.payments.enabled && h('div', { class: 'notice warn' }, icon('warn'), h('span', null, 'Online payments are off. Add the Razorpay keys to the backend (see SETUP.md). Until then the site only takes registrations of interest.')),
      data.payments.enabled && !data.payments.webhooks && h('div', { class: 'notice warn' }, icon('warn'), h('span', null, 'Razorpay webhooks are off. Payments are confirmed when customers return to the site, but refunds made in the Razorpay dashboard will not show here. Set RAZORPAY_WEBHOOK_SECRET (production needs it).')),
      data.payments.enabled && data.payments.testMode && h('div', { class: 'notice' }, icon('warn'), h('span', null, 'Razorpay test mode: pay by Netbanking (choose Success on the test bank page) or with the UPI ID success@razorpay. No real money moves.')));
    tiles.replaceChildren(
      statTile('PAID · 30 DAYS', sumsText(s, 'paid30d'), 'After refunds'),
      statTile('AWAITING PAYMENT', sumsText(s, 'awaitingAmount'), plural(s.reduce((a, x) => a + x.awaitingCount, 0), 'order')),
      statTile('REFUNDED · 30 DAYS', sumsText(s, 'refunded30d'), 'Back to customers'));
    if (query.event) {
      const ev = data.items.find(o => o.event)?.event;
      fill(eventBar, h('div', { class: 'notice' }, icon('cal'),
        h('span', null, ev ? `Bookings for ${fmtDay(ev.date)}${ev.city ? ' in ' + ev.city : ''}. ` : 'Bookings for one date. ',
          h('a', { href: hrefFor({ event: '', page: '', open: '' }) }, 'Show all payments'))));
    } else {
      eventBar.replaceChildren();
    }
  }

  function renderTabs() {
    const all = Object.values(data.counts).reduce((a, b) => a + b, 0);
    tabs.replaceChildren(...ORDER_GROUPS.map(([k, label]) =>
      h('a', { href: hrefFor({ status: k, page: '', open: '' }), 'aria-current': (query.status || '') === k ? 'page' : null }, label, h('span', { class: 'n' }, k ? data.counts[k] : all))));
  }

  function renderTable() {
    if (!data.items.length) {
      const filtered = query.q || query.status || query.kind || query.event;
      table.replaceChildren(h('p', { class: 'empty' }, filtered ? 'Nothing matches these filters.' : 'No payments yet. Dates paid for on the site and payment links you send show up here.'));
      return;
    }
    const rows = data.items.map(o => {
      const href = hrefFor({ open: o.id });
      return h('tr', {
        class: 'clickable' + (o.id === query.open ? ' is-open' : ''), 'data-id': o.id,
        onclick: e => { if (!e.target.closest('a')) location.hash = href; }
      },
        h('td', { class: 'nowrap', title: fmtStamp(o.createdAt) }, ago(o.createdAt)),
        h('td', null, h('a', { class: 'primary-link', href }, o.name), h('span', { class: 'sub' }, o.email)),
        h('td', null, h('span', { class: 'chip', style: { '--type': typeColor(o.missionType) } }, o.kind === 'booking' ? 'Date booking' : 'Payment link'), h('span', { class: 'sub' }, o.description)),
        h('td', { class: 'num hide-sm' }, o.kids ?? '–'),
        h('td', { class: 'num nowrap' }, moneyMinor(o.amount, o.currency)),
        h('td', null, orderPill(o)));
    });
    const from = (data.page - 1) * data.pageSize + 1, to = from + data.items.length - 1;
    const pages = Math.ceil(data.total / data.pageSize);
    table.replaceChildren(
      h('div', { class: 'table-scroll' }, h('table', null,
        h('thead', null, h('tr', null,
          h('th', null, 'Created'), h('th', null, 'Customer'), h('th', null, 'For'), h('th', { class: 'hide-sm' }, 'Children'), h('th', null, 'Amount'), h('th', null, 'Status'))),
        h('tbody', null, rows))),
      h('div', { class: 'pager' },
        h('span', null, `${from}–${to} of ${data.total}`),
        pages > 1 && h('div', { class: 'btns' },
          h('button', { class: 'btn small', type: 'button', disabled: data.page <= 1, onclick: () => go({ page: data.page > 2 ? data.page - 1 : '' }) }, 'Previous'),
          h('button', { class: 'btn small', type: 'button', disabled: data.page >= pages, onclick: () => go({ page: data.page + 1 }) }, 'Next'))));
  }

  // ---- order drawer ----

  async function openDrawer(id) {
    if (drawer && drawer.id === id) return;
    closeDrawer(false);
    let o;
    try {
      o = await api('/orders/' + id);
    } catch (e) {
      toast(e.message, true);
      go({ open: '' });
      return;
    }
    if (query.open !== id) return;
    drawer = { id, o };
    renderDrawer(true);
  }

  function closeDrawer(restoreFocus = true) {
    if (!drawer) return;
    drawer.nodes?.forEach(n => n.remove());
    const id = drawer.id;
    drawer = null;
    if (restoreFocus) table.querySelector(`tr[data-id="${id}"] .primary-link`)?.focus();
  }

  function renderDrawer(focus) {
    drawer.nodes?.forEach(n => n.remove());
    const { o } = drawer;
    const close = () => go({ open: '' });
    const label = text => h('p', { class: 'section-label mono' }, text);
    const dd = (term, value) => [h('dt', null, term), h('dd', null, value)];
    const heading = h('h2', { id: 'drawer-title', tabindex: '-1' }, o.name);
    const refundable = o.status === 'paid' && o.amountRefunded < o.amount;

    async function act(path, question, done) {
      if (!confirm(question)) return;
      try {
        drawer.o = await api(`/orders/${o.id}/${path}`, { method: 'POST' });
        toast(done);
        loadList(true);
        renderDrawer(false);
      } catch (e) {
        toast(e.message, true);
      }
    }

    const panel = h('aside', {
      class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'drawer-title',
      onkeydown: e => {
        if (e.key === 'Escape') { e.preventDefault(); close(); return; }
        if (e.key !== 'Tab') return;
        const f = [...panel.querySelectorAll('a[href], button:not([disabled]), textarea, input, select')];
        if (!f.length) return;
        if (e.shiftKey && (document.activeElement === f[0] || document.activeElement === heading)) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    },
      h('div', { class: 'drawer-head' },
        h('div', null, heading, h('p', { class: 'sub' }, (o.kind === 'booking' ? 'Booked on the site ' : 'Payment link created ') + fmtStamp(o.createdAt))),
        h('button', { class: 'btn icon ghost', type: 'button', 'aria-label': 'Close details', onclick: close }, icon('close', 20))),
      h('div', { class: 'drawer-body' },
        h('section', { class: 'amount-row' }, h('span', { class: 'big-amount' }, moneyMinor(o.amount, o.currency)), orderPill(o)),
        h('section', null, label('For'),
          h('dl', { class: 'details' },
            dd('What', o.description),
            o.event && dd('When', [fmtDay(o.event.date), [o.event.time, o.event.timezone].filter(Boolean).join(' ')].filter(Boolean).join(' · ')),
            o.event && dd('Where', [o.event.venue, o.event.city].filter(Boolean).join(', ') || '–'),
            dd('Children', o.kids ?? 'Not given'),
            o.quantity > 1 && dd('Price', `${o.quantity} × ${moneyMinor(o.unitAmount, o.currency)}`),
            o.registrationId && dd('Registration', h('a', { href: '#/registrations?open=' + o.registrationId }, 'Open registration')))),
        o.kind === 'request' && o.status === 'pending' && h('section', null, label('Payment link'), payLinkBox(o), h('p', { class: 'muted' }, 'Works until ' + fmtStamp(o.expiresAt))),
        h('section', null, label('Payment'),
          h('dl', { class: 'details' },
            dd('Status', ORDER_STATUS[o.status]),
            o.paidAt && dd('Paid', fmtStamp(o.paidAt)),
            o.amountRefunded > 0 && dd('Refunded', moneyMinor(o.amountRefunded, o.currency)),
            o.kind === 'booking' && o.status === 'pending' && dd('Places held until', fmtStamp(o.expiresAt)),
            o.providerUrl && dd('Razorpay', h('a', { href: o.providerUrl, target: '_blank', rel: 'noopener' }, 'Open in Razorpay ', icon('external', 14))))),
        h('section', null, label('Contact'),
          h('div', { class: 'contact' },
            h('a', { class: 'btn small', href: 'mailto:' + o.email }, icon('mail', 16), o.email),
            o.phone && h('a', { class: 'btn small', href: 'tel:' + o.phone.replace(/[^\d+]/g, '') }, icon('phone', 16), o.phone))),
        (o.ageRange || o.notes) && h('section', null, label('Their details'),
          o.ageRange && h('dl', { class: 'details' }, dd('Age range', AGE_LABEL[o.ageRange] || o.ageRange)),
          o.notes && h('p', { class: 'quote' }, o.notes)),
        (refundable || o.status === 'pending') && h('section', { class: 'danger-zone contact' },
          refundable && h('button', {
            class: 'btn danger', type: 'button',
            onclick: () => act('refund', `Refund ${moneyMinor(o.amount - o.amountRefunded, o.currency)} to ${o.name}? It goes back to the card, UPI or bank account that paid${o.kind === 'booking' ? ', and their places are freed' : ''}.`, 'Refund sent to Razorpay')
          }, icon('undo', 16), 'Refund in full'),
          o.status === 'pending' && h('button', {
            class: 'btn danger', type: 'button',
            onclick: () => act('cancel', o.kind === 'booking' ? 'Cancel this unpaid booking? Its held places are freed.' : 'Cancel this payment link? It stops working straight away.', 'Cancelled')
          }, icon('close', 16), o.kind === 'booking' ? 'Cancel booking' : 'Cancel payment link'))));
    const backdrop = h('div', { class: 'backdrop', onclick: close });
    drawer.nodes = [backdrop, panel];
    document.body.append(backdrop, panel);
    if (focus) heading.focus();
  }

  return {
    el,
    async update(q) {
      query = q;
      if (document.activeElement !== search) search.value = query.q || '';
      kindSelect.value = query.kind || '';
      await loadList();
      table.querySelectorAll('tr[data-id]').forEach(tr => tr.classList.toggle('is-open', tr.dataset.id === query.open));
      if (query.open) openDrawer(query.open);
      else closeDrawer();
    },
    destroy() { closeDrawer(false); }
  };
}

// ---------- missions and dates ----------

function MissionsView() {
  const body = h('div', { class: 'stack' }, loading());
  const el = h('div', null,
    pageHead('MISSIONS & DATES', 'Missions and dates', 'Prices and dates you set here show on the public site the next time someone loads it. Past dates drop off the site by themselves.'),
    body);
  return {
    el,
    async update() {
      try {
        const [{ missions, today }, settings] = await Promise.all([api('/missions'), getSettings()]);
        body.replaceChildren(...missions.map((m, i) => MissionCard(m, i, today, settings)));
      } catch (e) {
        body.replaceChildren(errorBox(e));
      }
    }
  };
}

function MissionCard(m, index, today, settings) {
  const card = h('section', { class: 'panel mission', style: { '--type': typeColor(m.type) }, 'aria-labelledby': 'm-' + m.slug });
  const unitLabel = 'per ' + m.unit;
  let editing = null; // an event id, or 'new'

  const priceInput = h('input', { class: 'input', type: 'number', min: '0', step: '0.01', inputmode: 'decimal', value: m.price ?? '', placeholder: 'Not set' });
  const priceForm = h('form', {
    class: 'price-form',
    onsubmit: async e => {
      e.preventDefault();
      try {
        const r = await api('/missions/' + m.slug, { method: 'PATCH', body: { price: priceInput.value } });
        m.price = r.price;
        toast(r.price == null ? `Price cleared for ${m.title}` : `${m.title}: ${money(r.price, settings.currency)} ${unitLabel}`);
      } catch (err) {
        toast(err.message, true);
      }
    }
  },
    h('label', { class: 'field' }, h('span', { class: 'label' }, 'Price ' + unitLabel),
      h('span', { class: 'price-input' }, h('span', { class: 'cur', 'aria-hidden': 'true' }, settings.currency || '¤'), priceInput)),
    h('button', { class: 'btn', type: 'submit' }, 'Save price'));

  function stepper(e) {
    const out = h('output', { class: e.placesLeft === 0 ? 'sold' : '', 'aria-live': 'polite' }, e.placesLeft);
    const minus = h('button', { class: 'btn small icon', type: 'button', 'aria-label': 'One fewer place', disabled: e.placesLeft === 0, onclick: () => change(-1) }, icon('minus', 16));
    const plus = h('button', { class: 'btn small icon', type: 'button', 'aria-label': 'One more place', onclick: () => change(1) }, icon('plus', 16));
    async function change(delta) {
      try {
        Object.assign(e, await api(`/events/${e.id}/places`, { method: 'POST', body: { delta } }));
        out.textContent = e.placesLeft;
        out.className = e.placesLeft === 0 ? 'sold' : '';
        minus.disabled = e.placesLeft === 0;
        if (e.placesLeft === 0) toast(`${fmtDay(e.date)} is now sold out`);
      } catch (err) {
        toast(err.message, true);
      }
    }
    return h('span', { class: 'stepper', role: 'group', 'aria-label': 'Places left' }, minus, out, plus);
  }

  async function removeEvent(e) {
    if (!confirm(`Delete the ${fmtDay(e.date)} date${e.city ? ' in ' + e.city : ''}? It disappears from the site straight away.`)) return;
    try {
      await api('/events/' + e.id, { method: 'DELETE' });
      m.events = m.events.filter(x => x.id !== e.id);
      render();
      toast('Date deleted');
    } catch (err) {
      toast(err.message, true);
    }
  }

  function eventForm(e) {
    const inputs = {
      date: h('input', { class: 'input', type: 'date', value: e ? e.date || '' : '' }),
      time: h('input', { class: 'input', type: 'time', value: e ? e.time || '' : '' }),
      timezone: h('input', { class: 'input', type: 'text', maxlength: '40', value: e ? e.timezone || '' : '', placeholder: settings.timezone || 'e.g. UK time' }),
      venue: h('input', { class: 'input', type: 'text', maxlength: '120', value: e ? e.venue || '' : '', placeholder: 'e.g. Hyde Park Community Hall' }),
      city: h('input', { class: 'input', type: 'text', maxlength: '80', value: e ? e.city || '' : '', placeholder: 'e.g. Leeds' }),
      placesLeft: h('input', { class: 'input', type: 'number', min: '0', max: '999', step: '1', inputmode: 'numeric', value: e ? e.placesLeft : '' })
    };
    const fields = {
      date: field('Date', inputs.date, { hint: 'Leave empty if it is not fixed yet' }),
      time: field('Start time', inputs.time),
      timezone: field('Timezone', inputs.timezone, { hint: settings.timezone ? 'Empty uses ' + settings.timezone : 'Set a default in Settings' }),
      venue: field('Venue', inputs.venue),
      city: field('City', inputs.city, { hint: 'Feeds the city filter on the site' }),
      placesLeft: field('Places left', inputs.placesLeft, { hint: '0 shows as sold out' })
    };
    const formError = h('p', { class: 'form-error', role: 'alert' });
    return h('form', {
      class: 'event-form', novalidate: true, 'aria-label': e ? 'Edit date' : 'Add a date',
      onsubmit: async ev => {
        ev.preventDefault();
        Object.values(fields).forEach(f => f.setError(''));
        formError.textContent = '';
        const body = Object.fromEntries(Object.entries(inputs).map(([k, input]) => [k, input.value]));
        try {
          const saved = await api(e ? '/events/' + e.id : `/missions/${m.slug}/events`, { method: e ? 'PATCH' : 'POST', body });
          if (e) Object.assign(e, saved);
          else m.events.push(saved);
          m.events.sort(byDate);
          editing = null;
          render();
          toast(e ? 'Date updated' : 'Date added');
        } catch (err) {
          for (const [k, msg] of Object.entries(err.errors)) fields[k]?.setError(msg);
          formError.textContent = err.message;
        }
      },
      onkeydown: ev => { if (ev.key === 'Escape') { editing = null; render(); } }
    },
      h('div', { class: 'form-grid' }, Object.values(fields)),
      formError,
      h('div', { class: 'form-actions' },
        h('button', { class: 'btn primary', type: 'submit' }, e ? 'Save date' : 'Add date'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { editing = null; render(); } }, 'Cancel')));
  }

  function eventRow(e, isPast) {
    return h('tr', { class: isPast ? 'past' : null },
      h('td', { class: 'nowrap' }, fmtDay(e.date)),
      h('td', { class: 'nowrap' }, [e.time, e.timezone || settings.timezone].filter(Boolean).join(' ') || '–'),
      h('td', { class: 'hide-sm' }, e.venue || '–'),
      h('td', null, e.city || '–'),
      h('td', { class: 'num' }, e.booked || e.held
        ? h('a', { href: '#/payments?event=' + e.id, title: `${e.booked} paid${e.held ? `, ${e.held} in checkout` : ''}` }, String(e.booked), e.held ? h('span', { class: 'muted held' }, ` +${e.held}`) : null)
        : '0'),
      h('td', null, isPast ? e.placesLeft : stepper(e)),
      h('td', null, h('div', { class: 'row-actions' },
        h('button', { class: 'btn small icon ghost', type: 'button', 'aria-label': 'Edit ' + fmtDay(e.date), title: 'Edit', onclick: () => { editing = e.id; render(); } }, icon('edit', 16)),
        h('button', { class: 'btn small icon ghost', type: 'button', 'aria-label': 'Delete ' + fmtDay(e.date), title: 'Delete', onclick: () => removeEvent(e) }, icon('trash', 16)))));
  }

  function datesTable(events, isPast) {
    return h('div', { class: 'dates-wrap' }, h('table', { class: 'dates' },
      h('thead', null, h('tr', null,
        h('th', null, 'Date'), h('th', null, 'Time'), h('th', { class: 'hide-sm' }, 'Venue'), h('th', null, 'City'),
        h('th', { title: 'Paid places, plus any held in checkout' }, 'Booked'), h('th', null, 'Places left'), h('th', null, h('span', { class: 'sr-only' }, 'Actions')))),
      h('tbody', null, events.map(e => editing === e.id
        ? h('tr', null, h('td', { colspan: '7' }, eventForm(e)))
        : eventRow(e, isPast)))));
  }

  function render() {
    const upcoming = m.events.filter(e => !e.date || e.date >= today);
    const past = m.events.filter(e => e.date && e.date < today).reverse();
    fill(card,
      h('div', { class: 'mission-top' },
        h('div', null,
          h('p', { class: 'mono muted' }, 'MISSION ' + String(index + 1).padStart(2, '0')),
          h('h2', { id: 'm-' + m.slug }, m.title),
          h('div', { class: 'meta' }, h('span', { class: 'chip' }, TYPES[m.type].name), h('span', null, plural(upcoming.length, 'upcoming date')))),
        priceForm),
      upcoming.length ? datesTable(upcoming, false) : h('p', { class: 'muted' }, 'No upcoming dates. The site shows “Register interest” for this mission.'),
      editing === 'new' ? eventForm(null) : null,
      h('div', { class: 'dates-foot' },
        editing !== 'new' && h('button', {
          class: 'btn small', type: 'button',
          onclick: () => { editing = 'new'; render(); card.querySelector('.event-form input')?.focus(); }
        }, icon('plus', 16), 'Add a date')),
      past.length ? h('details', { class: 'past-dates' }, h('summary', null, plural(past.length, 'past date')), datesTable(past, true)) : null);
    if (typeof editing === 'number') card.querySelector('.event-form input')?.focus();
  }

  render();
  return card;
}

// ---------- settings ----------

function SettingsView() {
  const body = h('div', null, loading());
  const el = h('div', null, pageHead('SETTINGS', 'Settings', 'Details the public site fills in, and your own account.'), body);

  function siteForm(s) {
    const inputs = {
      currency: h('input', { class: 'input', type: 'text', maxlength: '3', value: s.currency, placeholder: 'INR', autocapitalize: 'characters', spellcheck: 'false' }),
      timezone: h('input', { class: 'input', type: 'text', maxlength: '40', value: s.timezone, placeholder: 'UK time' }),
      responseTime: h('input', { class: 'input', type: 'text', maxlength: '60', value: s.responseTime, placeholder: 'one working day' }),
      insuranceNote: h('textarea', { class: 'textarea', maxlength: '400', value: s.insuranceNote, placeholder: 'e.g. Fully insured. Every GROWND scientist holds an enhanced DBS check.' })
    };
    const fields = {
      currency: field('Currency code', inputs.currency, { hint: 'Three letters, like INR for rupees. Every price on the site uses it.' }),
      timezone: field('Timezone label', inputs.timezone, { hint: 'Shown after event times. A single date can override it.' }),
      responseTime: field('Reply time', inputs.responseTime, { hint: 'Completes “We reply within …” on the register page.', span: true }),
      insuranceNote: field('Safety and checks', inputs.insuranceNote, { hint: 'Shown on the home page and on every mission page.', span: true })
    };
    const formError = h('p', { class: 'form-error', role: 'alert' });
    return h('section', { class: 'panel', 'aria-labelledby': 'site-h' },
      h('h2', { id: 'site-h' }, 'Public site details'),
      h('p', null, 'Anything left empty keeps its placeholder on the site, like [PRICE].'),
      h('form', {
        novalidate: true,
        onsubmit: async e => {
          e.preventDefault();
          Object.values(fields).forEach(f => f.setError(''));
          formError.textContent = '';
          try {
            cache.settings = await api('/settings', { method: 'PUT', body: Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value])) });
            inputs.currency.value = cache.settings.currency;
            toast('Site details saved');
          } catch (err) {
            for (const [k, msg] of Object.entries(err.errors)) fields[k]?.setError(msg);
            formError.textContent = err.message;
          }
        }
      },
        h('div', { class: 'form-grid' }, Object.values(fields)),
        formError,
        h('div', { class: 'form-actions' }, h('button', { class: 'btn primary', type: 'submit' }, 'Save details'))));
  }

  function passwordForm() {
    const current = h('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
    const next = h('input', { class: 'input', type: 'password', autocomplete: 'new-password', minlength: '10' });
    const again = h('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    const fields = { current: field('Current password', current), next: field('New password', next, { hint: 'At least 10 characters' }), again: field('New password again', again) };
    const form = h('form', {
      novalidate: true,
      onsubmit: async e => {
        e.preventDefault();
        Object.values(fields).forEach(f => f.setError(''));
        if (next.value !== again.value) return fields.again.setError('These do not match.');
        if (next.value.length < 10) return fields.next.setError('Use at least 10 characters.');
        const check = await supabase.auth.signInWithPassword({ email: me.email, password: current.value });
        if (check.error) return fields.current.setError('Your current password is not right.');
        const { error } = await supabase.auth.updateUser({ password: next.value });
        if (error) return fields.next.setError(error.message);
        form.reset();
        toast('Password changed');
      }
    },
      h('div', { class: 'form-grid' }, h('div', { class: 'span-2' }, fields.current), fields.next, fields.again),
      h('div', { class: 'form-actions' }, h('button', { class: 'btn', type: 'submit' }, 'Change password')));
    return h('section', { class: 'panel', 'aria-labelledby': 'pw-h' }, h('h2', { id: 'pw-h' }, 'Password'), h('p', null, 'Signed in as ' + me.email + '.'), form);
  }

  function accountPanel() {
    return h('section', { class: 'panel', 'aria-labelledby': 'acct-h' },
      h('h2', { id: 'acct-h' }, 'Other admins'),
      h('p', null, 'To add someone, or reset a forgotten password, run this in the backend folder:'),
      h('code', { class: 'quote code' }, 'npm run create-admin -- name@example.com'),
      h('p', { class: 'muted' }, 'Add --revoke to take access away.'),
      h('div', { class: 'form-actions' }, h('button', { class: 'btn', type: 'button', onclick: signOut }, 'Sign out')));
  }

  return {
    el,
    async update() {
      try {
        const s = await getSettings(true);
        body.replaceChildren(h('div', { class: 'settings-grid' }, siteForm(s), h('div', { class: 'stack' }, passwordForm(), accountPanel())));
      } catch (e) {
        body.replaceChildren(errorBox(e));
      }
    }
  };
}

// ---------- boot ----------

window.addEventListener('hashchange', route);
(async () => {
  try {
    const res = await fetch('/api/admin/config');
    if (!res.ok) throw new Error();
    const { supabaseUrl, supabaseAnonKey } = await res.json();
    const { createClient } = await import(SUPABASE_JS);
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'grownd-admin-auth' }
    });
  } catch {
    app.replaceChildren(h('main', { class: 'login' }, errorBox(new Error('The dashboard could not start. Check the API is running and its Supabase settings are filled in.'))));
    return;
  }
  // Signed out in another tab, or the refresh token was revoked. Deferred: supabase-js asks
  // callers not to call back into auth from inside this listener.
  supabase.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') setTimeout(() => signedOut('You were signed out.'), 0);
  });
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    try {
      me = await api('/me');
    } catch {
      me = null;
    }
  }
  if (me) start();
  else renderLogin();
})();
