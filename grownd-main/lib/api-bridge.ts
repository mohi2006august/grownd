// Runs the GROWND API (backend/, Fastify) inside Next.js route handlers, so the site and its API
// deploy as one app. Requests are handed to Fastify in memory, with no extra network hop.
import type { FastifyInstance } from "fastify";

let ready: Promise<FastifyInstance> | undefined;

function loadApi() {
  ready ??= import("@/backend/src/app.js")
    .then(m => m.buildApp())
    .then(async app => { await app.ready(); return app; });
  ready.catch(() => { ready = undefined; }); // try again on the next request
  return ready;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Hop-by-hop or recomputed headers that must not be copied onto the Response.
const SKIP = new Set(["connection", "keep-alive", "transfer-encoding", "content-length"]);

// Requests larger than this are refused before they are read into memory. The API's own limits are
// smaller still (16 KB for forms); this only stops a huge upload from filling the function's memory.
const MAX_BODY = 1024 * 1024;

/**
 * The visitor's IP address, for rate limits. On Vercel, x-real-ip is set by Vercel itself (it also
 * replaces any x-forwarded-for the visitor sent), so it cannot be faked. Elsewhere, only the last
 * x-forwarded-for entry is trustworthy: it is added by the nearest proxy (or by Next.js when there is
 * none), while earlier entries are whatever the visitor typed.
 */
function clientIp(headers: Record<string, string>) {
  if (process.env.VERCEL && headers["x-real-ip"]) return headers["x-real-ip"].trim();
  const hops = (headers["x-forwarded-for"] || "").split(",").map(s => s.trim()).filter(Boolean);
  return hops.at(-1) || "127.0.0.1";
}

/** Reads the request body, or returns null if it is larger than MAX_BODY. */
async function readBody(req: Request): Promise<Buffer | null | undefined> {
  if (!req.body) return undefined;
  if (Number(req.headers.get("content-length")) > MAX_BODY) return null;
  const reader = req.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Hands one request to the API and returns its answer. `path` overrides the URL path (for /healthz). */
export async function forward(req: Request, path?: string): Promise<Response> {
  let app: FastifyInstance;
  try {
    app = await loadApi();
  } catch (err) {
    const setup = (err as Error)?.name === "ConfigError";
    console.error(setup ? (err as Error).message : err);
    return json(503, { error: setup ? `This site is not set up yet. ${(err as Error).message}` : "The server could not start. See the function logs." });
  }

  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => { headers[key] = value; });
  const remoteAddress = clientIp(headers);
  // The API sees the visitor's address only as remoteAddress, never from headers it would have to trust.
  delete headers["x-forwarded-for"];
  delete headers["x-real-ip"];
  const payload = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  if (payload === null) return json(413, { error: "That is more text than we can take in one go." });
  const res = await app.inject({
    method: req.method as "GET",
    url: (path ?? url.pathname) + url.search,
    headers,
    payload,
    remoteAddress
  });

  const out = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (value === undefined || SKIP.has(key)) continue;
    if (Array.isArray(value)) value.forEach(v => out.append(key, String(v)));
    else out.set(key, String(value));
  }
  return new Response(req.method === "HEAD" ? null : new Uint8Array(res.rawPayload), { status: res.statusCode, headers: out });
}
