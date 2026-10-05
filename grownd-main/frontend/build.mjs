// Builds the public site into dist/ (run with `npm run build`; Vercel runs it on every deploy).
//
// One HTML file per page (/, /missions, /missions/<slug>, /quiz, ...) so every page has its own
// address, title, description, share image and structured data, plus a plain-HTML version of its
// content for crawlers that do not run JavaScript. The interactive site is the design source
// (frontend/design/GROWND Website v2.dc.html) running on its runtime (support.js) and React, all
// served from this domain with content-hashed names so browsers can cache them for a year.
//
// The canonical address comes from SITE_URL, else Vercel's production domain, else localhost.
// Set GOOGLE_SITE_VERIFICATION to add Search Console's verification tag to every page.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { FRONTEND, DESIGN_DIR, readDesign } from './lib/design.mjs';
import { site, pages, notFoundPage, structuredData, esc } from './seo.mjs';

const ROOT = path.join(FRONTEND, '..');
const DIST = path.join(ROOT, 'dist');
const MODULES = path.join(ROOT, 'node_modules');
const env = process.env;

const origin = (env.SITE_URL || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:4000')).replace(/\/+$/, '');
const verification = (env.GOOGLE_SITE_VERIFICATION || '').trim();

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

// ---- assets, with content hashes in their names -------------------------------------------------

const hashOf = buf => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
/** Copies a file to dist/assets/<dir>/<name>.<hash><ext> and returns its public path. */
function asset(src, dir = '', name = path.basename(src)) {
  const buf = fs.readFileSync(src);
  const ext = name.endsWith('.dc.html') ? '.dc.html' : path.extname(name);
  const out = `${name.slice(0, -ext.length)}.${hashOf(buf)}${ext}`;
  fs.mkdirSync(path.join(DIST, 'assets', dir), { recursive: true });
  fs.writeFileSync(path.join(DIST, 'assets', dir, out), buf);
  return `/assets/${dir ? `${dir}/` : ''}${out}`;
}
function textAsset(text, name) {
  const buf = Buffer.from(text);
  const ext = path.extname(name), out = `${name.slice(0, -ext.length)}.${hashOf(buf)}${ext}`;
  fs.writeFileSync(path.join(DIST, 'assets', out), buf);
  return `/assets/${out}`;
}

// The design tool's runtime ships unminified; minify it when esbuild is available.
async function runtimeScript() {
  const src = fs.readFileSync(path.join(DESIGN_DIR, 'support.js'), 'utf8');
  try {
    const { transform } = await import('esbuild');
    return (await transform(src, { minify: true, target: 'es2020' })).code;
  } catch (err) {
    console.warn(`  warning: runtime not minified (${err.message.split('\n')[0]})`);
    return src;
  }
}

const js = {
  react: asset(path.join(MODULES, 'react/umd/react.production.min.js'), '', 'react.js'),
  reactDom: asset(path.join(MODULES, 'react-dom/umd/react-dom.production.min.js'), '', 'react-dom.js'),
  runtime: textAsset(await runtimeScript(), 'dc-runtime.js'),
  missionCard: asset(path.join(DESIGN_DIR, 'MissionCard.dc.html'))
};

const fontFiles = {};
for (const f of fs.readdirSync(path.join(FRONTEND, 'assets/fonts'))) fontFiles[f] = asset(path.join(FRONTEND, 'assets/fonts', f), 'fonts');
const fontsCss = fs.readFileSync(path.join(FRONTEND, 'assets/fonts.css'), 'utf8').replace(/url\(fonts\/([^)]+)\)/g, (_, f) => `url(${fontFiles[f]})`);
const fontsCssUrl = textAsset(fontsCss, 'fonts.css');
const preloadFonts = ['figtree-latin.woff2', 'space-grotesk-latin.woff2', 'jetbrains-mono-latin.woff2'].map(f => fontFiles[f]);

const ogImages = {};
for (const f of fs.readdirSync(path.join(FRONTEND, 'assets/og'))) ogImages[path.basename(f, '.jpg')] = asset(path.join(FRONTEND, 'assets/og', f), 'og');

for (const f of fs.readdirSync(path.join(FRONTEND, 'public'))) fs.copyFileSync(path.join(FRONTEND, 'public', f), path.join(DIST, f));

// ---- the interactive page -----------------------------------------------------------------------

const design = readDesign();
const { missions, types, order } = design.data;

// Same encoding the runtime applies to template text: the HTML parser lower-cases attribute names
// and drops text inside <select>/<table>, so those are renamed first and restored by the runtime.
function encodeTemplate(html) {
  html = html.replace(/<(x-import|dc-import)((?:[^>"']|"[^"]*"|'[^']*')*)\/>/gi, (_, t, a) => `<${t}${a}></${t}>`);
  html = html.replace(/(\s)([a-z]+[A-Z][A-Za-z0-9]*)(\s*=)/g, (_, sp, name, eq) => `${sp}sc-camel-${name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`)}${eq}`);
  for (const t of ['select', 'table', 'tbody', 'thead', 'tfoot', 'tr', 'td', 'th', 'caption']) {
    html = html.replace(new RegExp(`(</?)${t}(?=[\\s>])`, 'gi'), `$1sc-raw-${t}`);
  }
  return html;
}
// Kept in a <template> so crawlers reading the raw HTML see the plain page, not template markup.
const app = `<template id="gr-app"><x-dc>
${encodeTemplate(design.template)}
</x-dc></template>
<script>document.body.appendChild(document.getElementById('gr-app').content.cloneNode(true))</script>
${design.scriptTag}`;

const allPages = pages(design.data);
const imageUrl = p => ogImages[p.image] || ogImages.default;
const seoMap = {
  origin,
  pages: Object.fromEntries(allPages.map(p => [p.path, { title: p.title, description: p.description, robots: p.robots, image: imageUrl(p), imageAlt: p.imageAlt }])),
  notFound: { title: notFoundPage.title, description: notFoundPage.description, robots: notFoundPage.robots, image: imageUrl(notFoundPage), imageAlt: notFoundPage.imageAlt }
};
const inlineJson = v => JSON.stringify(v).replace(/</g, '\\u003c');

const STATIC_CSS = `.gr-static{max-width:860px;margin:0 auto;padding:28px 20px 64px;font:17px/1.65 Figtree,system-ui,sans-serif;color:#F2F5FF}
.gr-static a{color:#C6F534}.gr-static h1,.gr-static h2{font-family:"Space Grotesk",system-ui,sans-serif;line-height:1.1;letter-spacing:-.01em}
.gr-static h1{font-size:clamp(36px,7vw,60px)}.gr-static nav{display:flex;flex-wrap:wrap;gap:6px 18px;font-weight:600}
.gr-static li{margin:8px 0}.js .gr-static{display:none}x-dc{display:none!important}`;

const staticNav = `<nav aria-label="Main"><a href="/"><strong>GROWND</strong></a><a href="/missions">Missions</a><a href="/quiz">Scientist quiz</a><a href="/lab">The Lab</a><a href="/about">Who we are</a><a href="/register">Register interest</a></nav>`;
const staticFooter = `<footer><p>GROWND: real experiments for ages 5 to 12.</p><nav aria-label="Missions">${missions.map(m => `<a href="/missions/${m.slug}">${esc(m.title)}</a>`).join('')}</nav></footer>`;

function render(page) {
  const url = origin + (page.path || '/');
  const image = origin + imageUrl(page);
  const ld = structuredData(page, { origin, imageUrl: image, logoUrl: `${origin}/icon-512.png` });
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="${page.robots}">
${page.path ? `<link rel="canonical" href="${url}">\n` : ''}<meta name="theme-color" content="${site.themeColor}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${site.name}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(page.imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${image}">
<meta name="twitter:image:alt" content="${esc(page.imageAlt)}">
${verification ? `<meta name="google-site-verification" content="${esc(verification)}">\n` : ''}${preloadFonts.map(f => `<link rel="preload" href="${f}" as="font" type="font/woff2" crossorigin>`).join('\n')}
<style>${fontsCss}${design.css}\n${STATIC_CSS}</style>
<script>(function(d){d.classList.add('js');try{if(localStorage.getItem('grownd-theme')==='light')d.classList.add('gr-light')}catch(e){}setTimeout(function(){if(!document.getElementById('dc-root'))d.classList.remove('js')},10000)})(document.documentElement);
window.__resources=${inlineJson({ './MissionCard.dc.html': js.missionCard })};window.__GROWND_SEO=${inlineJson(seoMap)};</script>
<script type="application/ld+json">${inlineJson(ld)}</script>
<script defer src="${js.react}"></script>
<script defer src="${js.reactDom}"></script>
<script defer src="${js.runtime}"></script>
</head>
<body>
<div class="gr-static">
${staticNav}
<main>
${page.content}
</main>
${staticFooter}
</div>
${app}
</body>
</html>
`;
}

const fileFor = p => (p === '/' ? 'index.html' : `${p.slice(1)}.html`);
for (const page of allPages) {
  const file = path.join(DIST, fileFor(page.path));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, render(page));
}
fs.writeFileSync(path.join(DIST, '404.html'), render(notFoundPage));

// ---- checkout and admin: their own pages, now on the self-hosted fonts ---------------------------

function selfHostFonts(html) {
  return html
    .replace(/<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>\n?/g, '')
    .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, `<link rel="stylesheet" href="${fontsCssUrl}">`)
    .replace(/style-src 'self' https:\/\/fonts\.googleapis\.com/, "style-src 'self'")
    .replace(/font-src https:\/\/fonts\.gstatic\.com/, "font-src 'self'");
}
const icons = '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">';

const SITE = path.join(FRONTEND, 'site');
let checkout = selfHostFonts(fs.readFileSync(path.join(SITE, 'checkout.html'), 'utf8'))
  .replace(/<link rel="icon" href="data:[^>]*>/, icons)
  .replace('href="checkout.css"', `href="${asset(path.join(SITE, 'checkout.css'))}"`)
  .replace('src="checkout.js"', `src="${asset(path.join(SITE, 'checkout.js'))}"`);
fs.writeFileSync(path.join(DIST, 'checkout.html'), checkout);

const ADMIN = path.join(FRONTEND, 'admin');
fs.mkdirSync(path.join(DIST, 'admin'));
for (const f of fs.readdirSync(ADMIN)) fs.copyFileSync(path.join(ADMIN, f), path.join(DIST, 'admin', f));
fs.writeFileSync(path.join(DIST, 'admin', 'index.html'), selfHostFonts(fs.readFileSync(path.join(ADMIN, 'index.html'), 'utf8')));

// ---- search engine files ------------------------------------------------------------------------

const indexed = allPages.filter(p => p.sitemap);
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexed.map(p => `  <url><loc>${origin}${p.path}</loc></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: ${origin}/sitemap.xml
`);
fs.writeFileSync(path.join(DIST, 'site.webmanifest'), `${JSON.stringify({
  name: site.name, short_name: site.name, description: site.description, lang: site.lang, start_url: '/', display: 'browser',
  background_color: site.themeColor, theme_color: site.themeColor,
  icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }]
}, null, 2)}\n`);

// ---- report -------------------------------------------------------------------------------------

const warn = [];
for (const p of allPages) {
  if (p.title.length > 65) warn.push(`title is ${p.title.length} characters (aim for 60): ${p.path}`);
  if (p.description.length > 160) warn.push(`description is ${p.description.length} characters (aim for 160): ${p.path}`);
  if ((p.content.match(/<h1[\s>]/g) || []).length !== 1) warn.push(`plain version needs exactly one <h1>: ${p.path}`);
}
const size = f => fs.statSync(path.join(DIST, f)).size;
console.log(`Built ${allPages.length + 1} pages for ${origin} (${indexed.length} in the sitemap) into dist/.`);
console.log(`Home page: ${Math.round(size('index.html') / 1024)} KB of HTML, before compression.`);
if (!env.SITE_URL && !env.VERCEL_PROJECT_PRODUCTION_URL) console.log('Canonical addresses use localhost. Set SITE_URL to build for the live domain.');
for (const w of warn) console.warn(`  warning: ${w}`);
