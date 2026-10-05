// Gives a Supabase Auth user admin access to the dashboard, creating the user if needed.
//   npm run create-admin -- you@example.com            create, or reset the password of, an admin
//   npm run create-admin -- you@example.com --keep     grant admin to an existing user, keep their password
//   npm run create-admin -- you@example.com --revoke   remove admin access
// Needs DATABASE_URL in backend/.env. Creating a user or setting a password also needs SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY. Without the secret key, add the user in the Supabase dashboard
// (Authentication -> Users -> Add user) and run this with --keep.
import postgres from 'postgres';

const [email = '', flag = ''] = process.argv.slice(2).map(s => s.trim());
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL } = process.env;
const MIN_PASSWORD = 10;
const filled = v => Boolean(v) && !/YOUR-|\[YOUR/.test(v);
const hasKey = filled(SUPABASE_URL) && filled(SUPABASE_SERVICE_ROLE_KEY);
const NO_KEY_HELP = 'Creating a login or setting a password needs SUPABASE_SERVICE_ROLE_KEY in backend/.env. Without it: add the user in Supabase (Authentication -> Users -> Add user, tick "Auto Confirm User"), then run this again with --keep.';

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !['', '--keep', '--revoke'].includes(flag)) {
  console.error('Usage: npm run create-admin -- you@example.com [--keep | --revoke]');
  process.exit(1);
}
if (!filled(DATABASE_URL)) {
  console.error('Fill in DATABASE_URL in backend/.env first, then run "npm run check".');
  process.exit(1);
}
if (flag === '' && !hasKey) {
  console.error(NO_KEY_HELP);
  process.exit(1);
}

let pipedLines;
async function readPipedLine() {
  if (!pipedLines) {
    let all = '';
    for await (const chunk of process.stdin) all += chunk;
    pipedLines = all.split(/\r?\n/);
  }
  return pipedLines.shift() || '';
}

/** Reads a line from the terminal without echoing it. */
function askHidden(question) {
  return new Promise(resolve => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setEncoding('utf8');
    if (!stdin.isTTY) {
      readPipedLine().then(line => { stdout.write('\n'); resolve(line); });
      return;
    }
    let value = '';
    const onData = chunk => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          return resolve(value);
        }
        if (ch === '\u0003') process.exit(130);
        value = ch === '\u007f' || ch === '\b' ? value.slice(0, -1) : value + ch;
      }
    };
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function authAdmin(method, path, body) {
  const key = SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`; // legacy JWT-style service_role key
  const res = await fetch(`${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/admin${path}`, { method, headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.message || data.error_description || `Supabase Auth answered ${res.status}`);
  return data;
}

const sql = postgres(DATABASE_URL, { max: 1, prepare: false });

/** Sets or clears the admin role. Through the Auth admin API when the secret key is set, else directly in auth.users. */
async function setRole(id, admin) {
  if (hasKey) return authAdmin('PUT', `/users/${id}`, { app_metadata: { role: admin ? 'admin' : null } });
  if (admin) await sql`update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb where id = ${id}`;
  else await sql`update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role' where id = ${id}`;
}

try {
  const [existing] = await sql`select id from auth.users where lower(email) = lower(${email}) limit 1`;

  if (flag === '--revoke') {
    if (!existing) throw new Error(`No user with the email ${email}.`);
    await setRole(existing.id, false);
    console.log(`Removed admin access from ${email}. Their current session lasts until its token expires (about an hour).`);
  } else if (flag === '--keep' && existing && !hasKey) {
    await setRole(existing.id, true);
    console.log(`${email} is an admin. They sign in with the password set in Supabase.`);
  } else {
    if (!existing && !hasKey) throw new Error(`No user with the email ${email} yet. ${NO_KEY_HELP}`);
    let password;
    if (flag !== '--keep' || !existing) {
      password = await askHidden(`Password for ${email} (at least ${MIN_PASSWORD} characters): `);
      if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`);
      if ((await askHidden('Type it again: ')) !== password) throw new Error('Those did not match. Nothing was changed.');
    }
    if (existing) {
      await authAdmin('PUT', `/users/${existing.id}`, { app_metadata: { role: 'admin' }, ...(password && { password }) });
      console.log(`${email} is an admin${password ? ' with the new password' : ''}.`);
    } else {
      await authAdmin('POST', '/users', { email, password, email_confirm: true, app_metadata: { role: 'admin' } });
      console.log(`Created admin ${email}.`);
    }
  }
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
