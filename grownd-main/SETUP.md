# Setting up Supabase and Stripe

About 20 minutes. You create the accounts and paste the keys into **`backend/.env`**, then run **`npm run check`**. It checks every value, talks to Supabase, the database and Stripe, and tells you exactly what is missing and where to find it. It never prints your keys.

Keep keys out of chat, email and git. `backend/.env` is already git-ignored.

> **OneDrive note:** this project sits in a OneDrive folder, so `backend/.env` (with your keys) syncs to your OneDrive. If that's not OK, move the project folder somewhere outside OneDrive before you add keys.

---

## Part 1: Supabase (database and admin sign-in)

### 1. Create the project
1. Go to <https://supabase.com/dashboard> and sign up or sign in.
2. Click **New project**:
   - **Name:** `grownd`
   - **Database password:** click **Generate a password** and save it in your password manager. You need it in step 3.
   - **Region:** closest to your customers (for the UK: *London*).
   - **Plan:** Free is fine to start. Free projects pause after about a week without activity; restore them from the dashboard.
3. Wait a minute or two while it sets up.

### 2. Copy the keys into `backend/.env`
Open **Project Settings → API Keys**.

| `.env` line | What to copy |
| --- | --- |
| `SUPABASE_URL` | The **Project URL**, `https://<project-ref>.supabase.co`. It's shown on the project home page, or under **Project Settings → Data API**. |
| `SUPABASE_ANON_KEY` | The **Publishable key** (`sb_publishable_...`). Safe to share; the dashboard uses it to sign admins in. |
| `SUPABASE_SERVICE_ROLE_KEY` | A **Secret key** (`sb_secret_...`): reveal it, then copy. Full access to everything, so keep it on the server only. |

The older long keys starting with `eyJ` (`anon`, `service_role`) also work, but Supabase is retiring them, so prefer the new ones. If you paste the secret key into `SUPABASE_ANON_KEY` by mistake, the API refuses to start, because that key is sent to browsers.

### 3. Copy the database connection strings
Click **Connect** (top of the dashboard).

1. Choose **Transaction pooler**, copy the string, and paste it as `DATABASE_URL`.
   - Replace `[YOUR-PASSWORD]` with the password from step 1.
   - Add `?sslmode=require` at the end.

   It should look like `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require`.
2. Choose **Session pooler** and do the same for `MIGRATION_DATABASE_URL` (port `5432`). Or delete that line and migrations use `DATABASE_URL`.

If your password contains symbols such as `@ # / ? %`, write them as `%40 %23 %2F %3F %25` in these strings. Or reset to a generated password under **Project Settings → Database**. Avoid the **Direct connection** string: it only works on IPv6 networks.

### 4. Turn off public sign-ups
Go to **Authentication → Sign In / Providers** (some versions call it *General configuration*). Turn off **Allow new users to sign up** and save. Only the admins you create in step 6 can then sign in.

### 5. Check, then create the tables
```bash
cd backend
```
```bash
npm install
```
```bash
npm run check
```
Fix anything marked `FIX` (each line says how), then create the tables:
```bash
npm run db:migrate
```
If `npm run check` asks for `SUPABASE_JWT_SECRET`, your project still signs logins with the old shared secret. Copy it from **Project Settings → JWT Keys** (legacy JWT secret).

### 6. Create your admin login
```bash
npm run create-admin -- you@yourdomain.com
```
Type a password of at least 10 characters, twice. Nothing appears while you type, which is normal. Run it again with another email to add more admins. Add `--revoke` to remove one.

### 7. Start it and sign in
```bash
npm run dev
```
Open <http://localhost:4000/admin/> and sign in. Then:
- **Settings:** set the currency (`GBP`), timezone label, reply time and safety note.
- **Missions & dates:** set prices and add dates.

The public site is at <http://localhost:4000>.

---

## Part 2: Stripe (payments)

### 1. Create the account
Sign up at <https://dashboard.stripe.com/register>. You can test straight away; business verification is only needed for real payments.

### 2. Get a test key
1. Make sure you are in a **sandbox** (test mode). New accounts start in one, or create one from the account menu.
2. Open **API keys** (in Workbench / Developers, or <https://dashboard.stripe.com/test/apikeys>).
3. Copy the **Secret key** (`sk_test_...`) into `STRIPE_SECRET_KEY` in `backend/.env`.
4. Restart `npm run dev` and run `npm run check`. Stripe should show as **test mode**.

That is enough to try payments locally. Even without step 3, a payment is recorded the moment the customer comes back to the site.

### 3. Recommended: webhooks on your machine
These keep refunds made in Stripe and slow bank payments in sync, just as production will.

1. Install the Stripe CLI, with either of these:
   ```bash
   winget install --id Stripe.StripeCli
   ```
   ```bash
   npm install -g @stripe/cli
   ```
2. Log it in to your account (it opens your browser):
   ```bash
   stripe login
   ```
3. Forward webhooks to the API, and leave this window open while you test:
   ```bash
   stripe listen --forward-to localhost:4000/api/payments/webhook
   ```
4. It prints `Ready! Your webhook signing secret is 'whsec_...'`. Copy that secret into `STRIPE_WEBHOOK_SECRET`, then restart `npm run dev`.

### 4. Try a booking
1. In the dashboard, make sure a mission has a **price** and an upcoming **date**.
2. On the site, open that mission, click **Book this date** and pay with:
   - card `4242 4242 4242 4242`
   - any future expiry date
   - any CVC and postcode
3. You land on **You're booked!** The booking shows in the dashboard under **Payments**, where you can also try a refund.

To test a quote, open a registration in the dashboard, create a **payment link** and open it.

### 5. Make the payment page look like GROWND
- **Settings → Branding:** logo, icon and brand colours for the payment page.
- **Settings → Public details:** business name and support email, shown on receipts.

---

## Part 3: Going live (when the site is deployed)

1. **Stripe:** activate your account with business details and a bank account.
2. **Live key:** in live mode, create a **restricted key** with *Checkout Sessions: Write* and *Refunds: Write*. Put it in `STRIPE_SECRET_KEY` on your server. Try the same permissions in a sandbox first (`rk_test_...`) and run a test booking with them.
3. **Webhook:** go to **Workbench → Webhooks → Create an event destination** and set it up as follows:
   - Choose **Your account** and the latest API version.
   - Select the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` and `charge.refunded`.
   - Choose **Webhook endpoint**, with the URL `https://YOUR-API-HOST/api/payments/webhook`.
   - Reveal the signing secret and put it in `STRIPE_WEBHOOK_SECRET` on the server.

   Production refuses to take payments without it.
4. **Server settings:** set `NODE_ENV=production`, `SITE_URL=https://your-site`, and `TRUST_PROXY=1` behind a load balancer. Run `npm run check` with the production values.
5. **Supabase:** consider the Pro plan before launch, for no pausing, daily backups and more connections.

## If something goes wrong
Run `npm run check`; it names the problem and the fix. The usual ones are:

| Message | Meaning |
| --- | --- |
| *password was not accepted* | Wrong database password in the connection string, or a symbol that needs `%` encoding. |
| *pooler did not recognise the user name* | The user must be `postgres.<project-ref>`; copy the string again from **Connect**. |
| *Could not reach SUPABASE_URL* | Typo in the URL, or the free project is paused; restore it in the dashboard. |
| *Please sign in again* in the dashboard | `npm run check` tells you if `SUPABASE_JWT_SECRET` is needed. |
| *Online booking is not switched on yet* | No Stripe key, or no currency set in the dashboard's Settings. |
