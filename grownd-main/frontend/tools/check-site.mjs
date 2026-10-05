// Checks the built site (dist/) for search problems: broken internal links, missing or duplicate
// titles and descriptions, more or less than one <h1>, missing canonical or share tags, invalid
// structured data, and sitemap entries that do not exist or are not indexable.
// Usage: npm run build && npm run check:site
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../../dist/', import.meta.url));
if (!fs.existsSync(DIST)) {
  console.error('No dist/ folder. Run "npm run build" first.');
  process.exit(1);
}

const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);

const files = [];
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== 'assets' && f.name !== 'admin') walk(p);
    else if (f.name.endsWith('.html')) files.push(p);
  }
})(DIST);

const urlOf = file => {
  const rel = path.relative(DIST, file).replace(/\\/g, '/').replace(/\.html$/, '');
  return rel === 'index' ? '/' : `/${rel}`;
};
const exists = href => {
  const p = href.split(/[?#]/)[0];
  if (p === '/') return true;
  return fs.existsSync(path.join(DIST, `${p}.html`)) || fs.existsSync(path.join(DIST, p));
};
const attr = (html, re) => (re.exec(html) || [])[1];

const seen = { title: new Map(), description: new Map() };
const pages = {};
for (const file of files) {
  const url = urlOf(file), html = fs.readFileSync(file, 'utf8');
  // Only the plain-HTML version counts: the interactive template sits inside <template>.
  const visible = html.replace(/<template[\s\S]*?<\/template>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const title = attr(html, /<title>([^<]*)<\/title>/), description = attr(html, /<meta name="description" content="([^"]*)"/);
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/) || '';
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  pages[url] = { robots, canonical };
  const isPage = !url.endsWith('/404') && url !== '/checkout';

  if (!title) fail(url, 'no <title>');
  if (!description) fail(url, 'no meta description');
  if (!/<html lang="/.test(html)) fail(url, 'no lang on <html>');
  if (isPage) {
    const h1s = (visible.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) fail(url, `${h1s} <h1> tags (want exactly 1)`);
    if (!canonical) fail(url, 'no canonical link');
    else if (!canonical.endsWith(url === '/' ? '/' : url)) fail(url, `canonical points elsewhere: ${canonical}`);
    for (const tag of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) {
      if (!html.includes(`"${tag}"`)) fail(url, `no ${tag}`);
    }
    for (const [kind, value] of [['title', title], ['description', description]]) {
      if (!value || !robots.startsWith('index')) continue;
      if (seen[kind].has(value)) fail(url, `same ${kind} as ${seen[kind].get(value)}`);
      seen[kind].set(value, url);
    }
    const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (!ld.length) fail(url, 'no structured data');
    for (const [, json] of ld) {
      try {
        const data = JSON.parse(json);
        if (data['@context'] !== 'https://schema.org') fail(url, 'structured data without the schema.org context');
      } catch (err) { fail(url, `structured data is not valid JSON (${err.message})`); }
    }
  }
  const og = attr(html, /<meta property="og:image" content="[^"]*?(\/assets\/[^"]*)"/);
  if (og && !fs.existsSync(path.join(DIST, og))) fail(url, `share image missing: ${og}`);
  for (const [, href] of visible.matchAll(/<a [^>]*href="([^"]+)"/g)) {
    if (href.startsWith('/') && !href.startsWith('//') && !exists(href)) fail(url, `broken link ${href}`);
  }
  for (const [, src] of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    if (!fs.existsSync(path.join(DIST, src))) fail(url, `missing file ${src}`);
  }
}

const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
for (const url of listed) {
  if (!pages[url]) fail('sitemap.xml', `lists ${url}, which does not exist`);
  else if (!pages[url].robots.startsWith('index')) fail('sitemap.xml', `lists ${url}, which is noindex`);
}
for (const [url, p] of Object.entries(pages)) {
  if (p.robots.startsWith('index') && !listed.includes(url)) fail('sitemap.xml', `misses indexable page ${url}`);
}
const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
if (!/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(robots)) fail('robots.txt', 'no Sitemap line');

console.log(`Checked ${files.length} pages, ${listed.length} sitemap entries.`);
if (problems.length) {
  for (const p of problems) console.log(`  FIX  ${p}`);
  process.exitCode = 1;
} else {
  console.log('No problems found.');
}
