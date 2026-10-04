import { sql, timed } from '../db.js';

// Liveness is GET /healthz (served by @fastify/under-pressure, answers even under load so the
// orchestrator never kills a busy-but-healthy process). Readiness checks the database, so a load
// balancer stops sending traffic to an instance that cannot reach it.
export default async function healthRoutes(app) {
  app.get('/readyz', { logLevel: 'silent', config: { rateLimit: false } }, async (request, reply) => {
    try {
      await timed(sql`select 1`, 2000);
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'database unavailable' });
    }
  });
}
