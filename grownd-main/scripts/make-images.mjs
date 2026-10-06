// Draws the share images (1200x630, shown when a link is posted on WhatsApp, Instagram, LinkedIn or X)
// and the site icons, using Chrome or Edge on this computer. Run it after changing a mission's title,
// line or colour (lib/missions.ts), or the logo:
//   npm install --no-save puppeteer-core
//   node scripts/make-images.mjs
// It writes public/og/*.jpg and the icons in public/; commit those, then deploy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Node runs the TypeScript file directly (its types are simply ignored).
import { MISSIONS, TYPES, TYPE_ORDER } from '../lib/missions.ts';

let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('This tool needs puppeteer-core. Install it without saving it to package.json:\n  npm install --no-save puppeteer-core');
  process.exit(1);
}

const browser = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium'
].find(p => p && fs.existsSync(p));
if (!browser) {
  console.error('No Chrome or Edge found. Set CHROME_PATH to one.');
  process.exit(1);
}

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const OG_DIR = path.join(PUBLIC_DIR, 'og');
fs.mkdirSync(OG_DIR, { recursive: true });

const data = { order: TYPE_ORDER, types: TYPES, missions: MISSIONS };
const COLOR = { bio: '#35D07F', chem: '#FF5CA8', phys: '#38BDF8', eng: '#FFA03B' };
const BRAND = '#C6F534', DEEP = '#0A0E1A', INK = '#F2F5FF', MUTED = '#9FACC9';

const font = (family, file, weights) => {
  const b64 = fs.readFileSync(path.join(PUBLIC_DIR, 'fonts', file)).toString('base64');
  return `@font-face{font-family:"${family}";font-weight:${weights};src:url(data:font/woff2;base64,${b64}) format("woff2")}`;
};
const FONTS = font('Figtree', 'figtree-latin.woff2', '400 700') + font('Space Grotesk', 'space-grotesk-latin.woff2', '500 700') + font('JetBrains Mono', 'jetbrains-mono-latin.woff2', '500 700');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The GROWND mark: a flask on a lime tile (same drawing as the site header).
const FLASK = '<path d="M9 3h6"/><path d="M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7.2 15h9.6"/>';
const mark = (size, radius) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${BRAND}"/><g transform="translate(12 12) scale(1.6667)" fill="none" stroke="${DEEP}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${FLASK}</g></svg>`;

const CSS = `${FONTS}
*{box-sizing:border-box}html,body{margin:0;background:transparent}
.card{position:relative;width:1200px;height:630px;overflow:hidden;background:${DEEP};color:${INK};font-family:Figtree,sans-serif}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(107,124,171,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(107,124,171,.10) 1px,transparent 1px);background-size:56px 56px}
.glow{position:absolute;right:-220px;top:-260px;width:860px;height:860px;border-radius:50%;background:radial-gradient(circle,var(--accent) 0%,transparent 64%);opacity:.26}
.brand{position:absolute;left:72px;top:60px;display:flex;align-items:center;gap:16px}
.word{font:700 38px/1 "Space Grotesk";letter-spacing:.06em;color:${BRAND}}
.left{position:absolute;left:72px;top:170px;width:660px;display:flex;flex-direction:column;gap:22px}
.eyebrow{font:500 21px/1.2 "JetBrains Mono";letter-spacing:.08em;color:var(--accent);text-transform:uppercase}
.title{font:700 var(--size,80px)/0.96 "Space Grotesk";letter-spacing:-.03em;margin:0}
.title mark{background:${BRAND};color:${DEEP};padding:0 .12em;border-radius:14px;display:inline-block;transform:rotate(-2deg)}
.sub{font:500 27px/1.38 Figtree;color:${MUTED};margin:0}
.facts{position:absolute;left:72px;bottom:54px;font:500 20px/1 "JetBrains Mono";letter-spacing:.08em;color:${INK}}
.tile{position:absolute;right:78px;top:142px;width:340px;height:340px;border-radius:44px;background:var(--accent);color:${DEEP};padding:30px;display:flex;flex-direction:column;justify-content:space-between;transform:rotate(-4deg);box-shadow:0 40px 90px rgba(4,7,16,.6)}
.tile .code{display:flex;justify-content:space-between;font:500 20px/1 "JetBrains Mono";letter-spacing:.08em}
.tile .glyph{font:700 var(--glyph,84px)/0.9 "Space Grotesk";letter-spacing:.02em}
.quad{position:absolute;right:78px;top:132px;display:grid;grid-template-columns:repeat(2,168px);gap:16px;transform:rotate(-4deg)}
.quad span{height:168px;border-radius:32px;color:${DEEP};padding:18px 20px;display:flex;flex-direction:column;justify-content:space-between;font:700 76px/0.9 "Space Grotesk"}
.quad small{font:500 15px/1 "JetBrains Mono";letter-spacing:.08em}`;

const page = body => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
const brand = `<div class="brand">${mark(58, 16)}<span class="word">GROWND</span></div>`;
const quad = `<div class="quad">${data.order.map(k => `<span style="background:${COLOR[k]}">${esc(data.types[k].initial)}<small>${esc(data.types[k].name.toUpperCase())}</small></span>`).join('')}</div>`;
const titleSize = t => (t.length > 34 ? 64 : t.length > 22 ? 72 : 84);

function card({ accent = BRAND, eyebrow, title, titleHtml, sub, facts, right }) {
  return page(`<div class="card" style="--accent:${accent}"><div class="grid"></div><div class="glow"></div>${brand}
<div class="left"><div class="eyebrow">${esc(eyebrow)}</div><h1 class="title" style="--size:${titleSize(title)}px">${titleHtml || esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}</div>
${facts ? `<div class="facts">${esc(facts)}</div>` : ''}${right}</div>`);
}

const cards = [
  ['default', card({
    eyebrow: 'Hands-on science / ages 5-12', title: 'Every child is a scientist. Some just need a lab.',
    titleHtml: 'Every child is a scientist. Some just need a <mark>lab.</mark>',
    facts: 'BIRTHDAYS / WORKSHOPS / SCHOOLS / CODING', right: quad
  })],
  ['quiz', card({
    eyebrow: 'Scientist quiz / 6 questions / 2 minutes', title: 'What kind of scientist is your child?',
    sub: 'Biologist, chemist, physicist or engineer? Find out, then find the mission that fits.', right: quad
  })],
  ...data.missions.map(m => [m.slug, card({
    accent: COLOR[m.type], eyebrow: `Mission ${m.no} / ${m.cat}`, title: m.title, sub: m.line,
    facts: `AGES ${m.ages} / ${m.mins} MIN / UP TO ${m.cap}`,
    right: `<div class="tile" style="--glyph:${m.glyph.length > 6 ? 64 : 84}px"><div class="code"><span>MISSION ${esc(m.no)}</span><span>${esc(data.types[m.type].name.toUpperCase())}</span></div><div class="glyph">${esc(m.glyph)}</div></div>`
  })]),
  ...data.order.map(k => {
    const t = data.types[k];
    return [t.slug, card({
      accent: COLOR[k], eyebrow: 'GROWND scientist type', title: `${t.name}`, sub: t.tag,
      facts: t.traits.join(' / ').toUpperCase(),
      right: `<div class="tile"><div class="code"><span>SCIENTIST ID</span><span>TYPE</span></div><div class="glyph" style="font-size:190px">${esc(t.initial)}</div></div>`
    })];
  })
];

const chrome = await puppeteer.launch({ executablePath: browser, headless: true, args: ['--hide-scrollbars'] });
try {
  const tab = await chrome.newPage();
  await tab.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  for (const [name, html] of cards) {
    await tab.setContent(html, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    const file = path.join(OG_DIR, `${name}.jpg`);
    await tab.screenshot({ path: file, type: 'jpeg', quality: 84 });
    console.log(`og/${name}.jpg`, Math.round(fs.statSync(file).size / 1024), 'KB');
  }

  // Icons: transparent rounded tile for browsers, full-bleed for iOS (which rounds the corners itself).
  const icon = async (size, radius) => {
    await tab.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await tab.setContent(page(`<div style="width:${size}px;height:${size}px">${mark(size, radius)}</div>`), { waitUntil: 'load' });
    return tab.screenshot({ type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), await icon(180, 0));
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-192.png'), await icon(192, 14));
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-512.png'), await icon(512, 14));
  // favicon.ico holds 16, 32 and 48 pixel PNGs (Google asks for a multiple of 48).
  const pngs = [];
  for (const s of [16, 32, 48]) pngs.push([s, Buffer.from(await icon(s, 16))]);
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(([s, png], i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(s, e); head.writeUInt8(s, e + 1); head.writeUInt8(0, e + 2); head.writeUInt8(0, e + 3);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(png.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), Buffer.concat([head, ...pngs.map(p => p[1])]));
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.svg'), mark(64, 16).replace(' width="64" height="64"', ''));
  for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'favicon.ico', 'favicon.svg']) console.log(f, fs.statSync(path.join(PUBLIC_DIR, f)).size, 'bytes');
} finally {
  await chrome.close();
}
