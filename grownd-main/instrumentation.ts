// Server start-up for Next.js: turns on Sentry error alerts when NEXT_PUBLIC_SENTRY_DSN is set
// (SETUP.md, Part 5). Without it, Sentry is never loaded.
import type { Instrumentation } from "next";
import { sentryPrivacy } from "@/lib/sentry-options";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0, // errors only: no performance tracing, which keeps it within the free plan
    dataCollection: sentryPrivacy() // no IP addresses, cookies or form contents
  });
}

// Errors while rendering a page or running a route handler.
export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
