// Vercel Function for every /api/* request (routed here by vercel.json).
// It runs the same Fastify app as `npm run dev`, from backend/. The website and dashboard are
// static files that Vercel's CDN serves directly, so they load even if this function cannot start.
let appReady;

function loadApp() {
  // Imported on first use (not at the top) so a missing setting becomes a clear 503 answer
  // instead of a crashed function.
  appReady ??= import('../backend/src/app.js')
    .then(({ buildApp }) => buildApp())
    .then(async app => {
      await app.ready();
      return app;
    });
  return appReady;
}

export default async function handler(req, res) {
  let app;
  try {
    app = await loadApp();
  } catch (err) {
    appReady = undefined;
    const setup = err?.name === 'ConfigError'; // names a missing or wrong setting, never a value
    console.error(setup ? err.message : err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({
      error: setup ? `This site is not set up yet. ${err.message}` : 'The server could not start. See the function logs in Vercel.'
    }));
    return;
  }
  app.server.emit('request', req, res);
}
