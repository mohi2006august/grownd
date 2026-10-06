// Copies the browser build of supabase-js into public/, so the admin dashboard loads it from this
// site instead of a CDN. Runs before `npm run dev` and `npm run build`; the version is the one in
// package.json (Dependabot keeps it up to date).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url));
const to = fileURLToPath(new URL('../public/admin/vendor/supabase.js', import.meta.url));
fs.mkdirSync(new URL('../public/admin/vendor/', import.meta.url), { recursive: true });
fs.copyFileSync(from, to);
