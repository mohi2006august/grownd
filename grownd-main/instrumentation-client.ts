// Browser error alerts, only when NEXT_PUBLIC_SENTRY_DSN is set at build time. Sentry loads after the
// page has started, so it never slows the first view; without the DSN it is left out entirely.
import { sentryPrivacy } from "@/lib/sentry-options";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  import("@sentry/nextjs").then(Sentry => {
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      dataCollection: sentryPrivacy(),
      // Problems in visitors' browser extensions are not ours to fix.
      denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//]
    });
  }).catch(() => { /* blocked by an ad blocker: fine */ });
}
