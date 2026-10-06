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
  const res = await app.inject({
    method: req.method as "GET",
    url: (path ?? url.pathname) + url.search,
    headers,
    payload: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.from(await req.arrayBuffer()),
    remoteAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim() || "127.0.0.1"
  });

  const out = new Headers();
  for (const [key, value] of Object.entries(res.headers)) {
    if (value === undefined || SKIP.has(key)) continue;
    if (Array.isArray(value)) value.forEach(v => out.append(key, String(v)));
    else out.set(key, String(value));
  }
  return new Response(req.method === "HEAD" ? null : new Uint8Array(res.rawPayload), { status: res.statusCode, headers: out });
}
