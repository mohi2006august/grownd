# GROWND

The GROWND science-experience website, its booking and payments API, and the admin dashboard the team uses to manage registrations, payments, prices and dates.

```
frontend/          static files, served from a CDN
  site/            public website (index.html) and the booking/payment page (checkout.html)
  admin/           admin dashboard (plain HTML/CSS/JS, Supabase Auth sign-in)
  design/          editable design sources the site is exported from
backend/           API: Node + Fastify, stateless, talks to Supabase Postgres and Stripe
  src/
    routes/        HTTP layer: public, payments, admin, health. Validation and status codes only
    services/      business logic; all SQL lives here (orders.js holds the payment rules)
    payments/      the only code that knows about Stripe, behind a small provider-neutral interface
    lib/           cache, errors, money, validation helpers
    app.js         plugins, protection, error handling
    server.js      start-up, payment reconciliation, graceful shutdown
    index.js       entry point; optional multi-core worker supervisor
  scripts/         check (setup checker), db:migrate, create-admin
  Dockerfile
database/
  migrations/      SQL schema for Supabase, applied in order
```

Each folder has its own README with the details. **New here? Start with [SETUP.md](SETUP.md).**

## How it fits together

```mermaid
flowchart LR
  V[Visitors] --> CDN[CDN / static host<br/>frontend/site + admin]
  A[Admins] --> CDN
  CDN -- "/api/*" --> LB[Load balancer]
  LB --> API1[API instance]
  LB --> API2[API instance]
  LB --> APIn[API instance ...]
  API1 & API2 & APIn --> POOL[Supabase pooler<br/>Supavisor]
  POOL --> PG[(Supabase Postgres)]
  A -. sign in .-> AUTH[Supabase Auth]
  V -. card details .-> STRIPE[Stripe Checkout]
  API1 & API2 & APIn <-. sessions, refunds, webhooks .-> STRIPE
  API1 & API2 & APIn -. shared rate limits, optional .-> R[(Redis)]
```

- **Visitors** load static pages from a CDN. The site calls `GET /api/content` (prices, dates, site details), `POST /api/registrations` (register interest) and the checkout endpoints.
- **Payments** happen on Stripe's hosted Checkout page, so card details never touch GROWND's servers (the lightest PCI compliance level, SAQ A). Stripe tells the API what happened through signed webhooks.
- **Admins** sign in with Supabase Auth in the dashboard. The API verifies the token on every request and requires `app_metadata.role = "admin"`.
- **The database** is only reachable through the API. Row Level Security blocks Supabase's auto-generated REST API for these tables.

## Payments

There are two ways customers pay, and both go through the website:

1. **Book a date.** On a mission page, **Book this date** opens `checkout.html`. The customer enters their details and the number of children, then pays on Stripe. Their places are **held for 30 minutes** while they pay. If they cancel or time runs out, the places go straight back.
2. **Payment links (quotes).** For parties and school visits, an admin opens the registration in the dashboard, enters the agreed amount and creates a link to copy or email. When the customer pays it, the registration is marked **confirmed** automatically.

The dashboard's **Payments** page lists everything with totals. You can refund in full there (any held places are freed) or cancel unpaid orders. Each date in **Missions & dates** shows how many places are booked. Stripe emails the receipts.

How it stays correct under pressure:

| Risk | What prevents it |
| --- | --- |
| Overselling a popular date | Places are taken in the same database statement that checks they exist. In a test, 200 people tried for 10 places at once: exactly 10 got them, and 190 were told it sold out. |
| Paying but not being recorded | Stripe's signed webhook is the source of truth. If it is late, the confirmation page asks Stripe directly. If it never arrives, a background reconciler settles overdue orders with Stripe every minute. |
| Webhooks delivered twice or out of order | Every event is recorded in the same transaction as its effect, and status changes are guarded, so repeats change nothing. |
| A customer paying twice (link open in two tabs) | The second payment is detected and refunded automatically. |
| Places never coming back | Each order records how many places it holds, and gives them back exactly once (cancel, expiry, failure or refund). |
| Stripe slow or down | Calls time out after 10 s with safe retries (idempotency keys). If a checkout cannot start, the order is discarded and its places freed. A per-process cap answers "busy, try again" instead of piling up. |
| Bank payments that take days | Supported: the booking shows as "clearing" with places held, then becomes paid, or frees its places if the payment fails. |
| Forged webhooks | Rejected by signature check. |

### Set up Stripe

[SETUP.md](SETUP.md), Parts 2 and 3, walks through it: a sandbox (test) key, webhooks on your machine with the Stripe CLI, a test booking, and going live with a restricted key and a webhook endpoint.

Locally, the secret key alone is enough to take test payments: a payment is recorded the moment the customer returns to the site. In production the API refuses to take payments until signed webhooks are configured too. Payment receipts are always emailed in live mode, because the API asks Stripe for them on every payment. Stripe doesn't email receipts for test payments.

## Built for traffic spikes

| Concern | What the system does |
| --- | --- |
| Lots of visitors | The site is static on a CDN. `/api/content` is built once per 30 s per instance, kept as a ready-made JSON string, and shared by concurrent requests (no stampede on a cold cache). It also sends CDN cache headers, so the CDN absorbs most traffic. Database load stays flat however many people visit. |
| Lots of sign-ups at once | **Group commit:** sign-ups arriving within 5 ms of each other are saved in one multi-row INSERT. A spike costs dozens of database round trips instead of thousands. If the database rejects one row, the rest of its batch is still saved. |
| A rush for one date | Place holds are single conditional UPDATEs on one row. Once a date is full, further attempts fail fast without waiting on Stripe. |
| More traffic than one machine | API instances are stateless; add more behind a load balancer. On a VM, `WEB_CONCURRENCY` runs one worker per CPU core and restarts any that die. |
| Database connections | Each process keeps a small pool (`DB_POOL_MAX`) through Supabase's pooler, so many instances share a bounded number of real Postgres connections. |
| Overload | Instead of crashing, the API answers `503` with `Retry-After`: when the event loop or memory is saturated, when too many sign-ups or checkouts are queued in a process, or when a query can't finish within 5 s. |
| Abuse | Per-IP rate limits: 30 sign-ups and 30 checkouts per hour, 1,200 content reads/minute, 300 other API calls/minute; Stripe webhooks are never throttled. With several instances, set `REDIS_URL` so they share counters. If Redis goes down, requests are allowed rather than blocked. |
| Operations | `/healthz` (liveness, still answers under load) and `/readyz` (checks the database). Graceful shutdown drains requests on deploy. Structured JSON logs record only slow and failed requests. |
| Security | Strict input validation with friendly messages; small body limits; no secrets in the browser; Bearer tokens verified locally against Supabase's signing keys; signed webhooks; unguessable order links that never expose phone numbers or notes; CSV export defused against spreadsheet formulas; Content-Security-Policy on the dashboard and checkout. |

### Measured

These are from **one Node process on a laptop** against a local Postgres 18, driven by autocannon from thousands of simulated client IPs. Payment tests used a stand-in for Stripe that signs webhooks like Stripe does.

| Test | Result |
| --- | --- |
| `GET /api/content`, 500 concurrent visitors, 20 s | 22,400 req/s, p99 46 ms, 0 errors |
| `POST /api/registrations`, 300 concurrent sign-ups, 15 s | 14,700 saved per second, p99 66 ms, 0 errors; every acknowledged row present in the database, no duplicates |
| `POST /api/checkout`, 300 concurrent buyers on a 999-place date, 10 s | about 1,480 attempts/s, 0 errors; every place sold exactly once (0 left + 999 held = 999) |
| 200 people at once for 10 places | 10 booked, 190 told "sold out", none oversold |
| One IP hammering the form | throttled with 429 in 2 ms; server stayed healthy |

On that basis, one million visitors loading the site is mostly CDN traffic, and the API side is a handful of instances. Real checkout throughput is also bounded by Stripe's API rate limit (around 100 requests per second by default), so ask Stripe for a higher limit before a very large launch. Production numbers depend on your Supabase compute size and pooler connection limit; load-test your real setup before a big launch.

## Run it locally

You need Node 22+ and a Supabase project (the free tier is fine). Stripe is optional at first: without its key the site simply takes registrations of interest.

**[SETUP.md](SETUP.md)** walks through creating the Supabase project and Stripe account and filling in `backend/.env`. In short:

```bash
cd backend
npm install
npm run check                            # checks backend/.env and every service, says what to fix
npm run db:migrate                       # creates the tables
npm run create-admin -- you@example.com  # your dashboard login
npm run dev
```

Then open http://localhost:4000 for the site and http://localhost:4000/admin/ for the dashboard.

## Deploy

1. **Database:** run `npm run db:migrate` against your Supabase project.
2. **API:** build `backend/Dockerfile` on any container host (Render, Railway, Fly.io, Google Cloud Run, AWS ECS).
   - Set the variables from `backend/.env.example`, plus `NODE_ENV=production` and `TRUST_PROXY=1`.
   - Use `/readyz` as the health check.
   - Autoscale on CPU.
   - Add `REDIS_URL` once you run more than one instance.
3. **Stripe:** live key and webhook endpoint at `https://YOUR-API-HOST/api/payments/webhook` (see [SETUP.md](SETUP.md), Part 3). Run `npm run check` with the production values.
4. **Frontend:** upload `frontend/` to a static host or CDN and proxy `/api/*` to the API. See `frontend/README.md`.

## Before launch

- Fill in prices, dates and site details in the dashboard. The overview's **Before launch** panel lists what is missing.
- Switch Stripe to live keys and a live webhook only after a full test-mode run-through.
- Publish booking terms and a cancellation and refund policy, and link them from the site. Stripe Checkout can require customers to accept your terms.
- Check with an accountant whether prices need VAT shown or added. Tax is not calculated yet.
- Edit the copy placeholders the dashboard does not manage, listed in `frontend/README.md`.
- New registrations and bookings show up in the dashboard, and Stripe emails customers their receipts, but the GROWND team is not emailed about them yet. That is the next feature worth adding.
