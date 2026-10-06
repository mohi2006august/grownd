// Checks a running copy of the site for search problems: broken internal links and files, missing or
// duplicate titles and descriptions, more or less than one <h1>, missing canonical or share tags,
// invalid structured data, and sitemap entries that do not exist or are not indexable.
// Usage: npm run build && npm start, then in another terminal: npm run check:site
// Another address: npm run check:site -- https://grownd-beige.vercel.app
const BASE = (process.argv[2] || process.env.SITE || 'http://localhost:4000').replace(/\/+$/, '');

const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what}`);
const attr = (html, re) => (re.exec(html) || [])[1];

async function get(path) {
  try {
    const res = await fetch(BASE + path, { redirect: 'manual' });
    return { status: res.status, location: res.headers.get('location'), type: res.headers.get('content-type') || '', robotsHeader: res.headers.get('x-robots-tag') || '', text: await res.text() };
  } catch (err) {
    console.error(`Could not reach ${BASE}${path} (${err.cause?.code || err.message}). Is the site running? Try "npm run build && npm start".`);
    process.exit(1);
  }
}

// ---- crawl every page linked from the home page and the sitemap ----
const sitemapRes = await get('/sitemap.xml');
if (sitemapRes.status !== 200) fail('/sitemap.xml', `answers ${sitemapRes.status}`);
const listed = [...sitemapRes.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);

const pages = {}, files = new Map(), queue = ['/', ...listed], from = new Map();
const seen = { title: new Map(), description: new Map() };
const isAsset = p => /\.[a-z0-9]+$/i.test(p);
while (queue.length) {
  const url = queue.shift();
  if (pages[url]) continue;
  const res = await get(url);
  pages[url] = { status: res.status, robots: '' };
  if (res.status !== 200) {
    fail(from.get(url) || url, `${res.status === 404 ? 'broken link' : `link answers ${res.status}`} ${url}${res.location ? ` -> ${res.location}` : ''}`);
    continue;
  }
  const html = res.text;
  // Count only what people see: drop scripts (structured data, page data) and <template> blocks.
  const visible = html.replace(/<template[\s\S]*?<\/template>/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const title = attr(html, /<title>([^<]*)<\/title>/), description = attr(html, /<meta name="description" content="([^"]*)"/);
  const robots = attr(html, /<meta name="robots" content="([^"]*)"/) || res.robotsHeader || 'index';
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  pages[url].robots = robots;
  const isPage = url !== '/checkout';

  if (!title) fail(url, 'no <title>');
  if (!description) fail(url, 'no meta description');
  if (!/<html lang="/.test(html)) fail(url, 'no lang on <html>');
  if (isPage) {
    const h1s = (visible.match(/<h1[\s>]/g) || []).length;
    if (h1s !== 1) fail(url, `${h1s} <h1> tags (want exactly 1)`);
    if (!canonical) fail(url, 'no canonical link');
    else if (new URL(canonical).pathname !== url) fail(url, `canonical points elsewhere: ${canonical}`);
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
        const data = [JSON.parse(json)].flat();
        if (data.some(d => d['@context'] !== 'https://schema.org')) fail(url, 'structured data without the schema.org context');
      } catch (err) { fail(url, `structured data is not valid JSON (${err.message})`); }
    }
  }
  const og = attr(html, /<meta property="og:image" content="([^"]*)"/);
  if (og) files.set(new URL(og, BASE).pathname, url);
  for (const [, href] of visible.matchAll(/<a [^>]*href="([^"]+)"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    const path = href.replace(/&amp;/g, '&').split(/[?#]/)[0] || '/';
    if (path.startsWith('/api/')) continue;
    if (isAsset(path)) { files.set(path, url); continue; }
    if (!pages[path] && !queue.includes(path)) { queue.push(path); from.set(path, url); }
  }
  for (const [, src] of html.matchAll(/(?:src|href)="(\/(?:og|fonts|_next)\/[^"]+|\/[\w-]+\.(?:png|ico|svg|webmanifest|css|js))"/g)) files.set(src.split(/[?#]/)[0], url);
}

for (const [file, page] of files) {
  const res = await fetch(BASE + file, { method: 'HEAD' });
  if (!res.ok) fail(page, `missing file ${file} (${res.status})`);
}

// ---- sitemap, robots.txt and the not-found page ----
for (const url of listed) {
  if (pages[url]?.status !== 200) fail('sitemap.xml', `lists ${url}, which does not exist`);
  else if (!pages[url].robots.startsWith('index')) fail('sitemap.xml', `lists ${url}, which is noindex`);
}
for (const [url, p] of Object.entries(pages)) {
  if (p.status === 200 && p.robots.startsWith('index') && !listed.includes(url)) fail('sitemap.xml', `misses indexable page ${url}`);
}
const robots = await get('/robots.txt');
if (!/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m.test(robots.text)) fail('robots.txt', 'no Sitemap line');
const missing = await get('/this-page-does-not-exist');
if (missing.status !== 404) fail('not-found page', `answers ${missing.status}, not 404`);
else if (!/<meta name="robots" content="noindex/.test(missing.text)) fail('not-found page', 'not marked noindex');

const crawled = Object.values(pages).filter(p => p.status === 200).length;
console.log(`Checked ${crawled} pages, ${files.size} files and ${listed.length} sitemap entries on ${BASE}.`);
if (problems.length) {
  for (const p of problems) console.log(`  FIX  ${p}`);
  process.exitCode = 1;
} else {
  console.log('No problems found.');
}
