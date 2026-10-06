import type { NextConfig } from "next";

// Locally, the API's settings live in backend/.env (on Vercel they are set in the dashboard).
try {
  process.loadEnvFile("backend/.env");
} catch {
  // No backend/.env: fine on Vercel, and pages fall back to their defaults locally.
}

const security = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
];

const config: NextConfig = {
  poweredByHeader: false,
  // The API (backend/) runs inside a route handler; its packages load from node_modules as they are.
  serverExternalPackages: [
    "fastify", "@fastify/cors", "@fastify/helmet", "@fastify/rate-limit", "@fastify/under-pressure",
    "postgres", "ioredis", "jose", "pino"
  ],
  async headers() {
    return [
      { source: "/:path*", headers: security },
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
