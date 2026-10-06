# Security

What keeps GROWND and its customers' details safe, what you need to switch on yourself, and what to do if something goes wrong. `npm run check` re-checks the settings it can see.

## What the code does

| Area | Protection |
| --- | --- |
| Customer details | Only the API can read registrations, orders and settings. Every table has row level security and no grants for Supabase's public Data API (the one that answers to the anon key every browser has), including tables added later. `npm run check` fails if any table is open. |
| Admin sign-in | Password **plus** a 6-digit code from an authenticator app. The API checks for the second step on every request, so a stolen password alone opens nothing. Only the server can make someone an admin (`npm run create-admin`), and public sign-ups are off. |
| Admin data | Every answer from `/api/admin` is marked `no-store`, so no browser, proxy or CDN keeps a copy. |
| Payments | Card and UPI details are typed on Razorpay's page only. Webhooks must carry a valid HMAC signature, and each one is processed once. |
| Browsers | A Content-Security-Policy lets pages load scripts and send data only to this site; the dashboard and booking page allow no inline code at all. No other site may show the pages in a frame. HTTPS is enforced with HSTS. The dashboard's sign-in library is served from this site, not a CDN. |
| Text from visitors | React and the dashboard insert names, notes and other visitor text as text, never as HTML, so it cannot run as code. |
| Abuse | Per-visitor rate limits (sign-ups, checkouts, reads), a hidden field that catches form-filling spam bots, a 1 MB cap on requests, and quick "busy, try again" answers instead of crashing under overload. On Vercel, the visitor's IP comes from Vercel's own header, so it cannot be faked to dodge the limits. |
| Code and packages | CI runs the tests and `npm audit` on every pull request. Dependabot opens a pull request when a package has a security fix. Secrets never go in git (`.env` is ignored; the history has been checked). |

## Your checklist

These are settings only you can change. The first two matter most.

1. **Two-step sign-in on every account that controls the site:** GitHub, Vercel, Supabase, Razorpay, and the email account they all send to. Anyone who gets into one of these can get into everything.
2. **Change the secrets that were pasted in chat:**
   - In Supabase, reset the database password (**Project Settings → Database → Reset database password**). Put the new one in `DATABASE_URL` in Vercel and in `backend/.env`.
   - Delete the old Tokyo Supabase project, which also cancels the keys that were pasted for it.
3. **Your own two-step sign-in for the dashboard.** The first time you sign in, the dashboard shows a QR code to scan with an authenticator app (Google Authenticator, Microsoft Authenticator, Authy or 1Password). Save the setup key it shows in a password manager: it restores the codes on a new phone.
4. **GitHub:**
   - Turn on **Dependabot alerts** and **Secret scanning → Push protection** (**Settings → Code security**).
   - Add a branch rule for `main` (**Settings → Branches**) that requires a pull request and a passing **CI** check.
5. **Vercel:**
   - Add `REDIS_URL` (Upstash, free tier) so every server instance shares the same rate-limit counts.
   - In **Firewall**, keep Bot Protection on. Switch on **Attack Challenge Mode** if the site is ever flooded.
6. **Razorpay:** use a long random webhook secret. Keep live keys only in Vercel, never in chat or in files.
7. **Supabase (optional):** under **Authentication → Sessions**, a shorter session time (for example 15 minutes) means a removed admin loses access sooner.

## If something goes wrong

| Situation | What to do |
| --- | --- |
| An admin lost their phone | `npm run create-admin -- name@example.com --reset-mfa`, then they set it up again at the next sign-in. |
| An admin account may be in the wrong hands | `npm run create-admin -- name@example.com --revoke`, then change that user's password in Supabase (**Authentication → Users**). Their open session ends within the hour. |
| A key or password leaked | Make a new one at the provider (Supabase, Razorpay, Upstash), put it in Vercel, and redeploy. Then delete the old one. |
| The site is being flooded | Vercel → **Firewall → Attack Challenge Mode**. The API also answers "busy" on its own rather than falling over. |

## Limits worth knowing

- Public pages allow inline scripts, because they are pre-built and served from the CDN. Per-request script nonces would mean rendering every page on demand. The site has no third-party scripts, and React escapes all text, so the remaining risk is low.
- Without `REDIS_URL`, each server instance counts rate limits on its own, so the limits are looser than they look.
- Hosting outside Vercel: run the site behind a proxy or load balancer (every host provides one). Visitor IPs are taken from the last `X-Forwarded-For` entry, which only a proxy can make trustworthy.
