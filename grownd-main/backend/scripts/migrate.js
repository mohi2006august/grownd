// Applies database/migrations/*.sql in filename order, once each.
// Usage: npm run db:migrate
// Uses MIGRATION_DATABASE_URL if set (prefer Supabase's session connection, port 5432), else DATABASE_URL.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const filled = value => (value && !/YOUR-|\[YOUR/.test(value) ? value : '');
const url = filled(process.env.MIGRATION_DATABASE_URL) || filled(process.env.DATABASE_URL);
if (!url) {
  console.error('Fill in DATABASE_URL in backend/.env first (see SETUP.md), then run "npm run check".');
  process.exit(1);
}

const dir = fileURLToPath(new URL('../../database/migrations/', import.meta.url));
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  let applied = 0;
  for (const name of files) {
    const ran = await sql.begin(async tx => {
      // Serialises concurrent runs (e.g. two deploys at once) without a session-level lock.
      await tx`select pg_advisory_xact_lock(7203141)`;
      const [done] = await tx`select 1 from schema_migrations where name = ${name}`;
      if (done) return false;
      await tx.unsafe(fs.readFileSync(path.join(dir, name), 'utf8')).simple();
      await tx`insert into schema_migrations (name) values (${name})`;
      return true;
    });
    if (ran) {
      applied++;
      console.log(`applied ${name}`);
    }
  }
  console.log(applied ? `Done: ${applied} migration(s) applied.` : 'Database is up to date.');
} catch (err) {
  console.error('Migration failed:', err.message);
  console.error('Run "npm run check" for a step-by-step diagnosis.');
  process.exitCode = 1;
} finally {
  await sql.end();
}
