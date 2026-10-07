// Error alerts: sends unexpected server errors to Sentry when NEXT_PUBLIC_SENTRY_DSN is set.
// Without it nothing is loaded and errors only go to the logs (Vercel → Logs).
import { after } from "next/server";

export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";

/** Reports an error the API caught (it still answers the visitor with a friendly message). */
export function reportError(err: unknown, context: Record<string, unknown> = {}) {
  if (!sentryDsn) return;
  const send = import("@sentry/nextjs").then(async Sentry => {
    Sentry.captureException(err, { extra: context });
    await Sentry.flush(2000);
  }).catch(() => { /* never let reporting break a request */ });
  // On serverless, keep the function alive until the report is sent.
  try { after(() => send); } catch { /* outside a request: it just runs */ }
}
