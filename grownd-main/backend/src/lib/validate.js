// Small field checkers with messages written for people, not developers.
// Each returns the cleaned value and records any problem in `errors`.

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function text(errors, key, value, { max, required = false, label = 'This' }) {
  const v = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (required && !v) errors[key] = `${label} is required.`;
  else if (v.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
  return v;
}

export function oneOf(errors, key, value, options, label = 'This') {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!options.includes(v)) errors[key] = `${label} is not one of the options.`;
  return v;
}

export function int(errors, key, value, { min, max, required = false, label = 'This' }) {
  if (value === '' || value == null) {
    if (required) errors[key] = `${label} is required.`;
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) errors[key] = `${label} must be a whole number from ${min} to ${max}.`;
  return n;
}

export function isoDate(errors, key, value, label = 'Date') {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  const d = new Date(v + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    errors[key] = `${label} must be a real date.`;
  }
  return v;
}

export function clockTime(errors, key, value, label = 'Time') {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) errors[key] = `${label} must look like 14:30.`;
  return v;
}

/** Route ids are positive integers; anything else is simply "not found". */
export const isId = value => /^[1-9]\d{0,15}$/.test(String(value));

// Options the site's forms offer.
export const AGE_RANGES = ['', '5-8', '7-11', '8-12', 'mixed'];

/** The contact details every public form collects: name, email, phone, age range, notes, consent. */
export function contactDetails(errors, b, consentMessage) {
  const name = text(errors, 'name', b.name, { max: 120, required: true, label: 'Your name' });
  const email = text(errors, 'email', b.email, { max: 200, required: true, label: 'Email' });
  if (email && !errors.email && !EMAIL.test(email)) errors.email = 'That email does not look quite right. Check for a missing @ or dot.';
  if (b.consent !== true) errors.consent = consentMessage;
  return {
    name,
    email,
    phone: text(errors, 'phone', b.phone, { max: 40, label: 'Phone' }),
    age: oneOf(errors, 'age', b.age ?? '', AGE_RANGES, 'Age range'),
    notes: text(errors, 'notes', b.notes, { max: 2000, label: 'Notes' })
  };
}
