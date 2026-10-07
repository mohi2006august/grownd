import type { NextConfig } from "next";

// Locally, the API's settings live in backend/.env (on Vercel they are set in the dashboard).
try {
  process.loadEnvFile("backend/.env");
} catch {
  // No backend/.env: fine on Vercel, and pages fall back to their defaults locally.
}

const dev = process.env.NODE_ENV !== "production";
// Browser error reports go to Sentry's servers, when error alerts are on (NEXT_PUBLIC_SENTRY_DSN).
const sentryOrigin = (() => { try { return new URL(process.env.NEXT_PUBLIC_SENTRY_DSN || "").origin; } catch { return ""; } })();

const security = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" }
];

// Content-Security-Policy: the browser only runs scripts, loads files and sends data to this site
// itself, and no other site may show these pages in a frame. Inline scripts and styles stay allowed
// because pages are pre-built and served from the CDN (per-request nonces would need every page
// rendered on demand); React escapes all text, and the site has no third-party scripts.
const csp = (rules: Record<string, string>) => ({
  key: "Content-Security-Policy",
  value: Object.entries({
    "default-src": "'self'", "object-src": "'none'", "base-uri": "'none'", "form-action": "'self'",
    "frame-ancestors": "'none'", "font-src": "'self'", "img-src": "'self' data:", ...rules
  }).map(([k, v]) => `${k} ${v}`).join("; ")
});
const siteCsp = csp({
  "script-src": `'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src": "'self' 'unsafe-inline'",
  "img-src": "'self' data: blob:",
  "connect-src": ["'self'", dev && "ws: wss:", sentryOrigin].filter(Boolean).join(" "),
  "frame-src": "'none'"
});
// The booking page and the dashboard are plain files with no inline code at all, so theirs is stricter.
const checkoutCsp = csp({ "script-src": "'self'", "style-src": "'self'", "connect-src": "'self'" });
const adminCsp = csp({ "script-src": "'self'", "style-src": "'self'", "connect-src": "'self' https://*.supabase.co wss://*.supabase.co" });

const config: NextConfig = {
  poweredByHeader: false,
  // `next dev` would otherwise write AGENTS.md and CLAUDE.md into the project.
  agentRules: false,
  // The API (backend/) runs inside a route handler; its packages load from node_modules as they are.
  serverExternalPackages: [
    "fastify", "@fastify/cors", "@fastify/helmet", "@fastify/rate-limit", "@fastify/under-pressure",
    "postgres", "ioredis", "jose", "pino"
  ],
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/:path((?!admin|checkout).*)", headers: [siteCsp] },
      { source: "/checkout", headers: [checkoutCsp] },
      { source: "/admin", headers: [adminCsp] },
      { source: "/fonts/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      { source: "/og/:file*", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Frame-Options", value: "DENY" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      { source: "/(api/.*|checkout)", headers: [{ key: "X-Robots-Tag", value: "noindex" }] }
    ];
  },
  // The booking page and the admin dashboard are plain HTML/JS pages in public/.
  async rewrites() {
    return [
      { source: "/checkout", destination: "/checkout.html" },
      { source: "/admin", destination: "/admin/index.html" }
    ];
  },
  async redirects() {
    return [
      // Addresses used before the move to Next.js: payment links already sent, and the old pages.
      { source: "/checkout.html", destination: "/checkout", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/admin/index.html", destination: "/admin", permanent: true }
    ];
  }
};

export default config;
