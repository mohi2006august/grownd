# Database (Supabase Postgres)

All schema changes live in `migrations/` as plain SQL, applied in filename order. Never edit a migration that has already run; add a new file instead (`YYYYMMDDHHMMSS_what_it_does.sql`).

## Tables

| Table           | What it holds                                                                         |
| --------------- | ------------------------------------------------------------------------------------- |
| `missions`      | The six missions (seeded). The dashboard sets each one's price.                       |
| `events`        | Dated sessions of a mission: date, time, venue, city, places left.                    |
| `registrations` | Every register-form submission, with a status (`new`, `contacted`, `confirmed`, `cancelled`) and internal notes. |
| `settings`      | Site-wide values: currency, timezone label, reply time, safety note.                  |
| `orders`        | Payments. A `booking` is places on a date paid on the site; a `request` is a payment link sent from a registration. Amounts are in the currency's smallest unit (pence). The `id` is a random UUID because it doubles as the customer's private link. |
| `payment_events`| Every Stripe webhook already handled, so a repeated delivery is ignored.             |

How places stay correct: a booking takes its places from `events.places_left` in the same transaction that creates the order, and only if enough are left. `orders.places_held` records how many it holds. When an order is cancelled, expires, fails or is refunded, the places go back and `places_held` drops to 0, so they can only ever be returned once. At any moment, places left plus places held on that date's orders equals the places you set.

Row Level Security is on for every table, and the `anon` and `authenticated` roles get no access. That turns off Supabase's auto-generated REST API for these tables, so only the backend can read or write them. Admin sign-in uses Supabase Auth (`auth.users`). An admin is a user whose `app_metadata.role` is `admin`.

## Apply the migrations

**Option 1: migration runner (recommended).** It records what has run in `schema_migrations`, so it's safe to run again.

```bash
cd backend
npm run db:migrate
```

It uses `MIGRATION_DATABASE_URL` if set, otherwise `DATABASE_URL`. For schema changes, prefer Supabase's **session** connection string (port 5432).

**Option 2: Supabase SQL editor.** Paste each file in `migrations/` in order and run it.

**Option 3: Supabase CLI.** Copy the files into `supabase/migrations/` of a CLI project and run `supabase db push`.
