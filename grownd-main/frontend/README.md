# Frontend

Everything here is static. No build step.

| Folder    | What it is                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------- |
| `site/`   | The public website. `index.html` is a self-contained bundle (fonts, React, the page) and works offline. `checkout.html` (+ `.css`, `.js`) is the booking and payment page. |
| `admin/`  | The admin dashboard: `index.html`, `admin.css`, `admin.js`. Sign-in is Supabase Auth.              |
| `design/` | Editable design sources (`.dc.html`) the site is exported from, plus `support.js`, which they need. |

## Booking and payment pages

`site/checkout.html` handles every payment the site takes:

- `checkout.html?event=ID`: book places on a date and pay. Mission pages link here from **Book this date** whenever online payment is on and the date has a price.
- `checkout.html?order=ID`: a payment link sent from the dashboard, or the confirmation page after paying (`&result=success`) or cancelling (`&result=cancelled`).

Customers type their card details on Stripe's own page, never on this site. If payments are switched off in the backend, the buttons fall back to **Register interest**.

## How the site talks to the backend

The site, the checkout page and the dashboard all call the API at the **same origin**, under `/api`. So whatever serves these files must also route `/api/*` to the backend.

- **Locally:** the backend serves both folders for you. Run `npm run dev` in `backend/`, then open http://localhost:4000 and http://localhost:4000/admin/.
- **In production:** put `frontend/` on a CDN or static host and proxy `/api/*` to the API. Files under `admin/` are served as they are; everything else comes from `site/`. Examples:

  **Vercel** (`vercel.json`, with the project root set to `frontend/`; real files such as `/admin/...` are served before rewrites apply):
  ```json
  {
    "rewrites": [
      { "source": "/api/:path*", "destination": "https://YOUR-API-HOST/api/:path*" },
      { "source": "/:path*", "destination": "/site/:path*" }
    ]
  }
  ```

  **Netlify** (`_redirects` in the publish folder `frontend/`):
  ```
  /api/*   https://YOUR-API-HOST/api/:splat   200
  /*       /site/:splat                       200
  ```

  **Cloudflare:** put Cloudflare in front of one origin, or use a Worker route for `/api/*`.

Point Stripe's webhook straight at the API (`https://YOUR-API-HOST/api/payments/webhook`) rather than through the static host.

If you would rather call the API on another domain without a proxy, set `CORS_ORIGINS` on the backend and change the `fetch('/api/...')` calls to absolute URLs.

The dashboard's Content-Security-Policy (in `admin/index.html`) allows connections to `*.supabase.co`. If you use a custom Supabase domain, add it there.

## Placeholders that the dashboard fills

When the API is reachable, the site replaces these with values from the dashboard:

- `[PRICE]` and `[CURRENCY]`
- `[DATE]`, `[TIME]` and `[TIMEZONE]`
- `[VENUE …]` and `[CITY …]` on events
- `[RESPONSE TIME]`
- `[INSURANCE AND DBS DETAILS]`

When the API is not reachable, for example when the file is opened by double-click, they stay as placeholders.

These are still plain copy, and need editing in `design/GROWND Website v2.dc.html`:

- `[TEAM LEAD]`, `[TECH LEAD]` and `[CONTENT LEAD]`
- `MISSION CONTROL / [CITY]`
- `[PHOTO …]` and `[VIDEO …]`

## Changing the site

`site/index.html` is an export of `design/GROWND Website v2.dc.html`. Edit the design source, re-export the standalone bundle from the design tool, and save it as `site/index.html`. The API and payment wiring lives in the design source, so a re-export keeps it.

To work on the design files directly, serve the folder (`npx serve frontend/design`) rather than double-clicking them, because they load their neighbours.
