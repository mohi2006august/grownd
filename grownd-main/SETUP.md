# Setting up Supabase and Razorpay

About 20 minutes. You create the accounts and paste the keys into **`backend/.env`**, then run **`npm run check`**. It checks every value, talks to Supabase, the database and Razorpay, and tells you exactly what is missing and where to find it. It never prints your keys.

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
| `SUPABASE_SERVICE_ROLE_KEY` | Optional. A **Secret key** (`sb_secret_...`) lets `npm run create-admin` create logins from your computer. It has full access to everything, so keep it out of chats and off the server. Step 6 works without it. |

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
Open a terminal in the app folder: the `grownd-main` folder that contains `vercel.json`. All the commands below run from there.
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
1. In Supabase, go to **Authentication → Users → Add user → Create new user**. Enter your email and a password of at least 10 characters, tick **Auto Confirm User**, and create it.
2. Give that user admin access:
   ```bash
   npm run create-admin -- you@yourdomain.com --keep
   ```

Repeat both steps for every admin. To take access away, run the same command with `--revoke` instead of `--keep`.

With `SUPABASE_SERVICE_ROLE_KEY` set, `npm run create-admin -- you@yourdomain.com` (without `--keep`) does both steps in one go. It asks for the password twice, and nothing appears while you type.

### 7. Start it and sign in
```bash
npm run dev
```
Open <http://localhost:4000/admin> and sign in. The first time, the dashboard asks you to set up two-step sign-in: install an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy), scan the QR code, and type the 6-digit code it shows. Save the setup key in a password manager; it restores the codes on a new phone. From then on you sign in with your password and the current code. Then:
- **Settings:** set the currency (`INR` for rupees), timezone label, reply time and safety note.
- **Missions & dates:** set prices and add dates.

The public site is at <http://localhost:4000>.

---

## Part 2: Razorpay (payments)

Customers pay on Razorpay's own page by UPI, card, netbanking or wallet, then come back to the site. GROWND never sees their card or UPI details.

### 1. Create the account
Sign up at <https://dashboard.razorpay.com/signup>. **Test Mode** works straight away. Business verification (KYC) is only needed before taking real money (Part 4).

### 2. Get test keys
1. In the Razorpay dashboard, switch the toggle at the top to **Test Mode**.
2. Go to **Account & Settings → API Keys → Generate Test Key**.
3. Razorpay shows the **Key Id** (`rzp_test_...`) and the **Key Secret** once. Paste them into `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `backend/.env`. If you lose the secret, generate a new key.
4. Restart `npm run dev` and run `npm run check`. Razorpay should show as **test mode**.

That's enough to try payments locally: a payment is recorded the moment the customer comes back to the site. Webhooks need a public address, so you set them up on the deployed site (Part 3, step 4).

### 3. Try a booking
1. In the dashboard, set the currency to `INR` in **Settings**, and make sure a mission has a **price** and an upcoming **date**.
2. On the site, open that mission, click **Book this date** and pay on Razorpay's test page with either of these:
   - **Netbanking:** pick any bank, then click **Success** on Razorpay's test bank page.
   - **UPI:** under **Show All Options → UPI**, enter `success@razorpay`.

   Avoid test card numbers you find online. Many are international cards, which new Indian accounts don't accept ("International cards are not supported").
3. You land on **You're booked!** The booking shows in the dashboard under **Payments**, where you can also try a refund.

To test a quote, open a registration in the dashboard, create a **payment link**, and open it.

### 4. Make the payment page look like GROWND
In Razorpay, go to **Account & Settings → Branding** and add the logo and brand colour (`#C6F534`). Customers see them on the payment page and in receipts.

---

## Part 3: Put it on Vercel

Do Part 1 first: the tables and your admin login are created from your computer.

### 1. Point Vercel at the app folder
In Vercel, open your project, then **Settings → Build and Deployment**:
- **Root Directory:** `grownd-main` (the folder that contains `vercel.json`). Save.
- **Framework Preset:** **Next.js** (`vercel.json` says so too). Leave Build Command, Output Directory and Install Command on their defaults. If you turned on an **Override** for any of them earlier, turn it off.

If the Root Directory is `grownd-main/backend`, Vercel runs only the backend, for every page, and never deploys the website. That is what produces `FUNCTION_INVOCATION_FAILED`.

With the app folder as the root, Vercel builds the Next.js app: its CDN serves the pages, the booking page and the dashboard, and Vercel Functions run the API under `/api/*`. A daily Vercel Cron job tidies up unpaid bookings.

### 2. Add the environment variables
Go to **Settings → Environment Variables**. Add these for *Production* and *Preview*, copying the values from your `backend/.env`:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | Transaction pooler string (port 6543, with `?sslmode=require`) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Publishable key |
| `SUPABASE_JWT_SECRET` | Only if `npm run check` asked for it |
| `RAZORPAY_KEY_ID` | `rzp_test_...` while testing |
| `RAZORPAY_KEY_SECRET` | The secret shown with that key |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you choose in step 4 below |
| `CRON_SECRET` | Any long random string. Vercel Cron sends it to the clean-up job, and nobody else can trigger the job. |
| `REDIS_URL` | Recommended before launch. Add **Upstash Redis** from the Vercel Marketplace and paste its `rediss://...` URL, so rate limits count across all Vercel instances instead of per instance. |
| `GOOGLE_SITE_VERIFICATION` | Optional: the code from Google Search Console's HTML-tag method ([SEO.md](SEO.md)). |
| `SITE_URL` | Optional: the site's address, e.g. `https://grownd.in`. Without it, Vercel's production domain is used for search links, share images and payment return links. |

Not needed on Vercel:
- `PORT`, `NODE_ENV`, `TRUST_PROXY` and `WEB_CONCURRENCY`: Vercel handles these.
- `MIGRATION_DATABASE_URL`: migrations run from your computer.
- `SUPABASE_SERVICE_ROLE_KEY`: only `npm run create-admin` on your computer uses it, so keep this key off the server.

### 3. Deploy
Push to `main`, or redeploy from **Deployments → ⋯ → Redeploy**. Changed variables only take effect in a new deployment.

### 4. Connect Razorpay to the live address
1. In Razorpay, go to **Account & Settings → Webhooks → Add New Webhook**, in the same mode (test or live) as your keys:
   - **Webhook URL:** `https://grownd-beige.vercel.app/api/payments/webhook` (or your own domain).
   - **Secret:** make up a long random string, and put the same string in `RAZORPAY_WEBHOOK_SECRET` in Vercel.
   - **Active events:** `payment_link.paid`, `payment_link.expired`, `payment_link.cancelled` and `refund.processed`.
2. Redeploy so the new variable takes effect.

### 5. Check it
- `https://grownd-beige.vercel.app` shows the website, and `/admin` signs you in.
- `/readyz` answers `{"status":"ready"}`, which means the database is reachable.
- If a setting is missing, `/api/...` answers with a message naming it, and the website still loads.

**Plan notes:**
- On the Hobby plan, Vercel Cron runs at most once a day. That is fine, because Razorpay's webhooks do the real-time work and the cron job is only a safety net. On Pro, change the schedule in `vercel.json` to `*/10 * * * *`.
- Preview deployments (other branches) are protected by Vercel Authentication by default.

---

## Part 4: Going live

1. **Razorpay:** complete **Account Activation** (KYC): business details, PAN, bank account and the website address. Razorpay checks that the site shows prices, contact details, and terms, privacy and refund policies, so publish those first.
2. **Live keys:** switch the dashboard to **Live Mode**, go to **Account & Settings → API Keys → Generate Live Key**, and put the Key Id (`rzp_live_...`) and Key Secret in Vercel.
3. **Webhook:** add the webhook from Part 3, step 4 again in **Live Mode**, with its own secret in `RAZORPAY_WEBHOOK_SECRET`. Production refuses to take payments without it.
4. **Rate limits:** set `REDIS_URL` (Upstash) in Vercel. For extra protection, add Vercel Firewall rate-limit rules for `/api/checkout` and `/api/registrations`.
5. **Supabase:** consider the Pro plan before launch, for no pausing, daily backups and more connections.
6. **Not using Vercel?** Any Node 22+ host works: run `npm ci`, `npm run build`, then `npm start`, which serves the site and the API together on port 4000. Set `NODE_ENV=production`, `SITE_URL=https://your-site`, and `TRUST_PROXY=1` behind a load balancer. (`backend/Dockerfile` builds an API-only image if you host the API separately.)

## If something goes wrong
Run `npm run check`; it names the problem and the fix. The usual ones are:

| Message | Meaning |
| --- | --- |
| *password was not accepted* | Wrong database password in the connection string, or a symbol that needs `%` encoding. |
| *pooler did not recognise the user name* | The user must be `postgres.<project-ref>`; copy the string again from **Connect**. |
| *Could not reach SUPABASE_URL* | Typo in the URL, or the free project is paused; restore it in the dashboard. |
| *Please sign in again* in the dashboard | `npm run check` tells you if `SUPABASE_JWT_SECRET` is needed. |
| *Online booking is not switched on yet* | No Razorpay keys, or no currency set in the dashboard's Settings. |
| Vercel shows `FUNCTION_INVOCATION_FAILED` on every page | The Root Directory is wrong; it must be `grownd-main` (Part 3, step 1). |
| `/api/...` on Vercel says *This site is not set up yet* | A variable is missing in Vercel; the message names it (Part 3, step 2). |
