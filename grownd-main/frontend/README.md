# Frontend

The public site, the booking page and the admin dashboard. `npm run build` (in the app folder) turns this folder into `dist/`, which is what Vercel serves.

| Folder / file | What it is |
| --- | --- |
| `design/` | **The site's source.** `GROWND Website v2.dc.html` holds every page (template + logic + mission data), `MissionCard.dc.html` the mission card, and `support.js` the runtime that renders them with React. Edit these. |
| `seo.mjs` | Search and sharing copy for every page: titles, descriptions, share images, structured data, and the plain-HTML version for crawlers. See [SEO.md](../SEO.md). |
| `build.mjs` | Builds `dist/`: one HTML file per page, hashed assets, sitemap, robots.txt. |
| `assets/` | Self-hosted fonts and the share images (`og/`), copied into `dist/assets/` with content hashes. |
| `public/` | Icons copied to the site root as they are (`favicon.ico`, `apple-touch-icon.png`, ...). |
| `site/` | The booking and payment page: `checkout.html`, `.css`, `.js`. |
| `admin/` | The admin dashboard: `index.html`, `admin.css`, `admin.js`. Sign-in is Supabase Auth. |
| `lib/design.mjs` | Reads the design source and its mission data, for the build and the tools. |
| `tools/` | `check-site.mjs` (`npm run check:site`) checks the build for SEO problems; `make-images.mjs` redraws the share images and icons. |

## Pages and addresses

| Address | Page |
| --- | --- |
| `/` | Home |
| `/missions` (`?cat=birthday`, `&city=…` filter it) | All missions |
| `/missions/<slug>` | One mission, e.g. `/missions/slime-chemistry` |
| `/quiz`, `/quiz/<type>` | Scientist quiz, and each result (`biologist`, `chemist`, `physicist`, `engineer`) |
| `/about`, `/lab` | Who we are; The Lab |
| `/register`, `/register/<slug>`, `/thank-you` | Register interest |
| `/checkout?event=ID`, `/checkout?order=ID` | Book a date and pay; a payment link or an order's confirmation (`&result=success` or `cancelled`) |
| `/admin` | Dashboard |

Each page is its own HTML file with its own title, description, share image and structured data. Moving between pages inside the site happens without a reload, and the tab title and share tags follow along. Old `/#/mission/…` style links redirect to the clean address.

Customers type their card details on the payment provider's own page, never on this site. If payments are switched off in the backend, the buttons fall back to **Register interest**.

## Working on the site

```bash
npm run dev
```

(in the app folder) builds the site and starts the API, which serves it at http://localhost:4000 with the same addresses as Vercel. After editing anything in `frontend/`, run `npm run build` again and refresh.

- **Words, layout, missions:** edit `design/GROWND Website v2.dc.html` (in the design tool, or by hand). In the design tool, pages switch with `#/` addresses; on the real site they are clean paths.
- **Search titles and descriptions:** `seo.mjs`.
- **Share images**, after changing a mission's title, line or colour: `npm install --no-save puppeteer-core`, then `node frontend/tools/make-images.mjs`.
- Before you push: `npm run build && npm run check:site`.

To preview the design files on their own, serve the folder (`npx serve frontend/design`) rather than double-clicking them, because they load their neighbours.

## How the site talks to the backend

The site, the checkout page and the dashboard all call the API at the **same origin**, under `/api`.

- **Locally:** `npm run dev` serves everything from one address.
- **On Vercel:** `vercel.json` serves `dist/` from the CDN and sends `/api/*` to the backend function (SETUP.md, Part 3).
- **Other static hosts:** run `npm run build`, publish `dist/` with "clean URLs" (`/missions` serves `missions.html`), use `dist/404.html` as the not-found page, and proxy `/api/*` to the API. On Netlify, for example (`_redirects` in `dist/`): `/api/*  https://YOUR-API-HOST/api/:splat  200`.

Point the payment webhook straight at the API (`https://YOUR-API-HOST/api/payments/webhook`) rather than through the static host. If you would rather call the API on another domain without a proxy, set `CORS_ORIGINS` on the backend and change the `fetch('/api/...')` calls to absolute URLs.

The dashboard's Content-Security-Policy (in `admin/index.html`) allows connections to `*.supabase.co`. If you use a custom Supabase domain, add it there.

## Placeholders that the dashboard fills

When the API is reachable, the site replaces these with values from the dashboard: `[PRICE]` and `[CURRENCY]`; `[DATE]`, `[TIME]` and `[TIMEZONE]`; `[VENUE …]` and `[CITY …]` on events; `[RESPONSE TIME]`; `[INSURANCE AND DBS DETAILS]`.

These are still plain copy, to edit in `design/GROWND Website v2.dc.html`: `[TEAM LEAD]`, `[TECH LEAD]` and `[CONTENT LEAD]`; `MISSION CONTROL / [CITY]`; `[PHOTO …]` and `[VIDEO …]` (see "Adding photos" in [SEO.md](../SEO.md)).
