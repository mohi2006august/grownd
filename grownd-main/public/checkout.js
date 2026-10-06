// Booking and payment pages for the GROWND site. Plain DOM, no build step.
//   /checkout?event=ID                       book places on a date and pay
//   /checkout?order=ID                       pay a payment link, or see an order
//   /checkout?order=ID&result=success        back from the payment page (or result=cancelled)
// Card and UPI details are entered on Razorpay's own page and never reach this site or the GROWND API.

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);

try {
  if (localStorage.getItem('grownd-theme') === 'light') document.documentElement.classList.add('light');
} catch {}

const TYPE_COLOR = { bio: 'var(--bio)', chem: 'var(--chem)', phys: 'var(--phys)', eng: 'var(--eng)' };
const AGE_OPTIONS = [['', 'Choose an age range'], ['5-8', '5-8'], ['7-11', '7-11'], ['8-12', '8-12'], ['mixed', 'Mixed ages, 5-12']];
const ICONS = {
  check: ['M5 12.5l4.5 4.5L19 7'],
  clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7v5l3 2'],
  info: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 11v6', 'M12 7.5v.01'],
  close: ['M6 6l12 12', 'M18 6L6 18'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  arrow: ['M5 12h14', 'M13 6l6 6-6 6']
};

// ---------- helpers ----------

function icon(name, size = 20) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  for (const d of ICONS[name]) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

const PROPS = new Set(['value', 'checked', 'disabled', 'hidden']);

/** h('a', { href, onclick }, ...children). Text is always inserted as text, never as HTML. */
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

function show(...nodes) {
  main.replaceChildren(...nodes.filter(Boolean));
  const heading = main.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    document.title = heading.textContent + ' · GROWND';
  }
}

async function api(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'We could not reach GROWND just now. Check your connection and try again.' } };
  }
}

const digitsCache = {};
function digits(currency) {
  return (digitsCache[currency] ??= new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits);
}
const toMinor = (amount, currency) => Math.round(amount * 10 ** digits(currency));
const money = (minor, currency) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency.toUpperCase() }).format(minor / 10 ** digits(currency.toUpperCase()));

function when(e) {
  const day = e.date
    ? new Date(e.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'Date to be confirmed';
  return [day, [e.time, e.timezone].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
}
const where = e => [e.venue, e.city].filter(Boolean).join(', ') || 'Venue to be confirmed';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const placesPill = n => h('span', { class: 'pill ' + (n <= 5 ? 'low' : 'ok') }, n <= 5 ? `Only ${plural(n, 'place', 'places')} left` : `${n} places left`);

let uid = 0;
/** A labelled field. `input` is the element the label points at, when `control` wraps it (the stepper). */
function field(label, control, { input = control, optional = false, span = false } = {}) {
  const id = 'f' + ++uid;
  const err = h('span', { class: 'err', id: id + '-err', hidden: true, role: 'alert' });
  input.id = id;
  input.setAttribute('aria-describedby', id + '-err');
  const wrap = h('div', { class: 'field' + (span ? ' span-2' : '') },
    h('label', { class: 'label', for: id }, h('span', null, label), optional && h('span', { class: 'opt' }, 'Optional')),
    control, err);
  wrap.setError = msg => {
    err.textContent = msg || '';
    err.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  return wrap;
}

function link(label, href, secondary = false) {
  return h('a', { class: 'btn' + (secondary ? ' secondary' : ''), href }, label, !secondary && icon('arrow', 18));
}

/** A centred result page: paid, cancelled, expired and so on. */
function statusView({ tone = 'info', title, lede, card, actions = [] }) {
  const badgeIcon = { ok: icon('check', 34), wait: h('span', { class: 'spinner', 'aria-hidden': 'true' }), bad: icon('close', 30), info: icon('info', 30), held: icon('clock', 30) }[tone];
  return h('section', { class: 'status' },
    h('div', { class: 'badge' + (tone === 'ok' ? ' ok' : tone === 'bad' ? ' bad' : '') }, badgeIcon),
    h('h1', null, title),
    lede && h('p', { class: 'lede', role: tone === 'wait' ? 'status' : null }, lede),
    card,
    actions.length ? h('div', { class: 'actions' }, actions) : null);
}

function orderCard(order) {
  const rows = [['For', order.description]];
  if (order.event) rows.push(['When', when(order.event)], ['Where', where(order.event)]);
  if (order.kids) rows.push(['Children', String(order.kids)]);
  rows.push(['Amount', money(order.amount, order.currency)]);
  if (order.amountRefunded) rows.push(['Refunded', money(order.amountRefunded, order.currency)]);
  return h('div', { class: 'card summary', style: { '--type': TYPE_COLOR[order.missionType] || 'var(--brand)' } },
    h('dl', null, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])));
}

// ---------- book a date ----------

async function bookingPage(eventId) {
  const { ok, data } = await api('/api/content');
  if (!ok) {
    return show(statusView({ tone: 'bad', title: 'We could not load this date', lede: data.error || 'Please try again in a moment.', actions: [link('Back to GROWND', '/')] }));
  }

  let slug, mission, event;
  for (const [s, m] of Object.entries(data.missions)) {
    const e = m.events.find(x => x.id === eventId);
    if (e) { slug = s; mission = m; event = e; break; }
  }
  if (!event) {
    return show(statusView({ title: 'This date is no longer available', lede: 'It may have passed or been changed. Have a look at what is coming up.', actions: [link('See all missions', '/missions')] }));
  }
  const currency = data.settings.currency;
  if (!data.payments.enabled || mission.price == null || !event.date || !currency) {
    return show(statusView({ title: 'Online booking is not open for this date yet', lede: 'Register your interest and the team will be in touch with dates and a price.', actions: [link('Register interest', `/register/${slug}`)] }));
  }
  if (event.placesLeft === 0) {
    return show(statusView({ tone: 'bad', title: 'This date is sold out', lede: 'Join the waiting list and we will tell you if a place opens up, or pick another date.', actions: [link('Join the waiting list', `/register/${slug}`), link('Other dates', `/missions/${slug}`, true)] }));
  }

  const unitMinor = toMinor(mission.price, currency);
  const perChild = mission.unit === 'child';
  const maxKids = Math.min(event.placesLeft, 200);

  // ---- form controls ----
  const name = h('input', { class: 'input', type: 'text', autocomplete: 'name', required: true, maxlength: '120' });
  const email = h('input', { class: 'input', type: 'email', autocomplete: 'email', required: true, maxlength: '200' });
  const phone = h('input', { class: 'input', type: 'tel', autocomplete: 'tel', maxlength: '40' });
  const kids = h('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '1', max: String(maxKids), step: '1', value: '1' });
  const age = h('select', { class: 'select' }, AGE_OPTIONS.map(([v, l]) => h('option', { value: v }, l)));
  const notes = h('textarea', { class: 'textarea', rows: '3', maxlength: '2000', placeholder: 'Allergies, access needs, one child who is scared of loud bangs, that sort of thing' });
  const consent = h('input', { type: 'checkbox' });
  const consentErr = h('span', { class: 'err', hidden: true, role: 'alert' });

  const minus = h('button', { type: 'button', 'aria-label': 'One fewer child', onclick: () => setKids(kidsValue() - 1) }, '−');
  const plus = h('button', { type: 'button', 'aria-label': 'One more child', onclick: () => setKids(kidsValue() + 1) }, '+');
  const stepper = h('div', { class: 'stepper' }, minus, kids, plus);

  const fields = {
    name: field('Your name', name),
    email: field('Email', email),
    phone: field('Phone', phone, { optional: true }),
    kids: field('Number of children', stepper, { input: kids }),
    age: field('Age range', age, { optional: true }),
    notes: field('Anything we should know', notes, { optional: true, span: true })
  };

  const totalAmount = h('span', { class: 'amount' });
  const totalCalc = h('span', { class: 'calc' });
  const payLabel = h('span');
  const payButton = h('button', { class: 'btn wide', type: 'submit' }, icon('lock', 18), payLabel);
  const alertBox = h('p', { class: 'alert', role: 'alert', tabindex: '-1', hidden: true });

  const kidsValue = () => Math.max(1, Math.min(maxKids, Number.parseInt(kids.value, 10) || 1));
  function setKids(n) {
    kids.value = String(Math.max(1, Math.min(maxKids, n)));
    update();
  }
  function update() {
    const n = kidsValue();
    const total = perChild ? unitMinor * n : unitMinor;
    totalAmount.textContent = money(total, currency);
    totalCalc.textContent = perChild ? `${n} × ${money(unitMinor, currency)}` : 'per class';
    payLabel.textContent = `Pay ${money(total, currency)}`;
    minus.disabled = n <= 1;
    plus.disabled = n >= maxKids;
  }
  kids.addEventListener('input', update);
  kids.addEventListener('blur', () => setKids(kidsValue()));
  update();

  const form = h('form', { class: 'card', novalidate: true, 'aria-labelledby': 'book-title', onsubmit: submit },
    h('div', { class: 'grid' }, fields.name, fields.email, fields.phone, fields.kids, fields.age, fields.notes),
    h('div', null,
      h('label', { class: 'consent' }, consent, h('span', null, 'Yes, GROWND can email me about this booking. We only keep what is on this form.')),
      consentErr),
    alertBox,
    h('div', null,
      payButton,
      h('p', { class: 'pay-note', style: { 'margin-top': '14px' } }, icon('lock', 16),
        `You pay on Razorpay's secure page, by UPI, card, netbanking or wallet. We hold your ${perChild ? 'places' : 'booking'} for ${data.payments.holdMinutes} minutes while you do.`)));

  const summary = h('aside', { class: 'card summary', style: { '--type': TYPE_COLOR[mission.type] || 'var(--brand)' }, 'aria-label': 'Your booking' },
    h('p', { class: 'mono muted' }, 'Your booking'),
    h('h2', null, mission.title),
    h('dl', null,
      h('dt', null, 'When'), h('dd', null, when(event)),
      h('dt', null, 'Where'), h('dd', null, where(event)),
      h('dt', null, 'Price'), h('dd', null, `${money(unitMinor, currency)} ${perChild ? 'per child' : 'per class'}`),
      h('dt', null, 'Places'), h('dd', null, placesPill(event.placesLeft))),
    h('div', { class: 'total' }, h('span', null, h('span', { class: 'mono muted' }, 'Total'), h('br'), totalCalc), totalAmount));

  show(
    h('p', { class: 'eyebrow mono' }, 'Book a date'),
    h('h1', { class: 'title', id: 'book-title' }, mission.title),
    h('p', { class: 'lede' }, `${when(event)} · ${where(event)}`),
    h('div', { class: 'layout' }, form, summary));

  async function submit(e) {
    e.preventDefault();
    Object.values(fields).forEach(f => f.setError(''));
    consentErr.hidden = true;
    alertBox.hidden = true;

    const errors = {};
    if (!name.value.trim()) errors.name = 'Tell us your name so we know who is coming.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) errors.email = 'That email does not look quite right. Check for a missing @ or dot.';
    if (!consent.checked) errors.consent = 'We need a yes here before we can email you about this booking.';
    if (Object.keys(errors).length) return showErrors(errors);

    payButton.disabled = true;
    payLabel.textContent = 'Opening secure payment…';
    const res = await api('/api/checkout', {
      method: 'POST',
      body: { eventId, kids: kidsValue(), name: name.value, email: email.value, phone: phone.value, age: age.value, notes: notes.value, consent: consent.checked }
    });
    if (res.ok && res.data.url) {
      location.assign(res.data.url);
      return;
    }
    payButton.disabled = false;
    update();
    showErrors(res.data.errors || {}, res.data.error || 'Something went wrong. Please try again.');
  }

  function showErrors(errors, fallback) {
    let shown = false;
    for (const [k, msg] of Object.entries(errors)) {
      if (k === 'consent') { consentErr.textContent = msg; consentErr.hidden = false; shown = true; }
      else if (fields[k]) { fields[k].setError(msg); shown = true; }
    }
    if (!shown && fallback) {
      alertBox.textContent = fallback;
      alertBox.hidden = false;
    }
    (main.querySelector('[aria-invalid="true"]') || (consentErr.hidden ? alertBox : consent)).focus?.();
  }
}

// ---------- an existing order ----------

function orderView(order, result) {
  const first = order.firstName;
  const booking = order.kind === 'booking';
  const again = booking && order.event ? [link('Try again', `/checkout?event=${order.event.id}`)] : [];
  const home = link('Back to GROWND', '/', again.length > 0);

  switch (order.status) {
    case 'paid':
      return statusView({
        tone: 'ok',
        title: booking ? `You're booked, ${first}!` : `Payment received. Thank you, ${first}!`,
        lede: `A receipt is on its way to ${order.emailHint}.${booking ? ' See you there.' : ''}`,
        card: orderCard(order),
        actions: [link('Back to GROWND', '/')]
      });
    case 'processing':
      return statusView({
        tone: 'held',
        title: 'Your payment is on its way',
        lede: 'Bank payments can take a few working days to clear. Your booking is held meanwhile, and we will email you once it is confirmed.',
        card: orderCard(order),
        actions: [link('Back to GROWND', '/')]
      });
    case 'refunded':
      return statusView({ title: 'This order was refunded', lede: `${money(order.amountRefunded, order.currency)} has gone back to the card that paid.`, card: orderCard(order), actions: [link('Back to GROWND', '/')] });
    case 'failed':
      return statusView({ tone: 'bad', title: 'The payment did not go through', lede: 'Nothing was taken. You can try again, or contact GROWND if it keeps happening.', card: orderCard(order), actions: [...again, home] });
    case 'expired':
      return statusView({
        title: booking ? 'Your booking timed out' : 'This payment link has expired',
        lede: booking ? 'The places were held while you paid and have now been released. Nothing was charged.' : 'Please ask GROWND for a new link.',
        card: orderCard(order),
        actions: booking ? [...again, home] : [home]
      });
    case 'cancelled':
      return statusView({
        title: booking ? 'Payment cancelled' : 'This payment request was cancelled',
        lede: booking ? 'Nothing was charged and your places were released.' : 'Please contact GROWND if you think this is a mistake.',
        card: orderCard(order),
        actions: booking ? [...again, home] : [home]
      });
    default: // pending
      if (result === 'success') {
        return statusView({ tone: 'wait', title: 'Confirming your payment…', lede: 'This usually takes a few seconds.', card: orderCard(order) });
      }
      if (order.canPay) return payRequestView(order);
      if (order.resumeUrl) {
        const until = new Date(order.expiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        return statusView({ tone: 'held', title: 'Your places are held', lede: `We are keeping them until ${until}. Finish paying to confirm your booking.`, card: orderCard(order), actions: [link('Continue to payment', order.resumeUrl), home] });
      }
      return statusView({ title: 'This order is waiting for payment', lede: 'Please contact GROWND if you need help with it.', card: orderCard(order), actions: [home] });
  }
}

function payRequestView(order) {
  const alertBox = h('p', { class: 'alert', role: 'alert', hidden: true });
  const label = h('span', null, `Pay ${money(order.amount, order.currency)}`);
  const button = h('button', {
    class: 'btn wide', type: 'button',
    onclick: async () => {
      button.disabled = true;
      label.textContent = 'Opening secure payment…';
      alertBox.hidden = true;
      const res = await api(`/api/orders/${order.id}/pay`, { method: 'POST' });
      if (res.ok && res.data.url) return location.assign(res.data.url);
      if (res.status === 409) return loadOrder(order.id); // paid or closed meanwhile: show what it is now
      button.disabled = false;
      label.textContent = `Pay ${money(order.amount, order.currency)}`;
      alertBox.textContent = res.data.error || 'Something went wrong. Please try again.';
      alertBox.hidden = false;
    }
  }, icon('lock', 18), label);
  const until = new Date(order.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  return h('section', { class: 'status' },
    h('p', { class: 'eyebrow mono' }, 'Payment request'),
    h('h1', null, order.description),
    h('p', { class: 'lede' }, `For ${order.firstName}. This link works until ${until}.`),
    orderCard(order),
    h('div', { class: 'card', style: { 'margin-top': '16px', display: 'grid', gap: '14px' } },
      alertBox, button,
      h('p', { class: 'pay-note' }, icon('lock', 16), "You pay on Razorpay's secure page, by UPI, card, netbanking or wallet. GROWND never sees your card or UPI details.")));
}

async function loadOrder(id, result) {
  const res = await api(`/api/orders/${id}?sync=${result === 'success' ? 1 : 0}`);
  if (!res.ok) {
    show(statusView({ tone: 'bad', title: res.status === 404 ? 'We could not find that order' : 'Something went wrong', lede: res.status === 404 ? 'Check the link, or contact GROWND.' : res.data.error, actions: [link('Back to GROWND', '/')] }));
    return null;
  }
  show(orderView(res.data, result));
  return res.data;
}

async function orderPage(id, result) {
  if (result === 'cancelled') await api(`/api/orders/${id}/cancel`, { method: 'POST' }); // frees held places now
  let order = await loadOrder(id, result);

  // Back from a successful payment: the webhook usually lands within seconds. Keep checking for a while.
  for (let i = 0; order && result === 'success' && order.status === 'pending' && i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await api(`/api/orders/${id}?sync=1`);
    if (res.ok && res.data.status !== 'pending') {
      order = res.data;
      show(orderView(order, result));
    }
  }
  if (order && result === 'success' && order.status === 'pending') {
    show(statusView({ tone: 'held', title: 'Still confirming your payment', lede: `This is taking longer than usual. If you paid, you will get a receipt at ${order.emailHint} and we will confirm by email. No need to pay again.`, card: orderCard(order), actions: [link('Back to GROWND', '/')] }));
  }
}

// ---------- start ----------

const eventId = Number.parseInt(params.get('event') || '', 10);
const orderId = params.get('order');
if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) {
  orderPage(orderId, params.get('result'));
} else if (eventId > 0) {
  bookingPage(eventId);
} else {
  show(statusView({ title: 'Nothing to show here', lede: 'Pick a date on a mission page to book it.', actions: [link('See all missions', '/missions')] }));
}
