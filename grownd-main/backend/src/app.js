import Fastify, { LogController } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import underPressure from '@fastify/under-pressure';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import { config } from './config.js';
import { DB_UNAVAILABLE, sql } from './db.js';
import { HttpError } from './lib/errors.js';
import adminRoutes from './routes/admin.js';
import healthRoutes from './routes/health.js';
import paymentRoutes from './routes/payments.js';
import publicRoutes from './routes/public.js';

const FRONTEND = fileURLToPath(new URL('../../frontend/', import.meta.url));

export async function buildApp() {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ['req.headers.authorization'] },
    // Per-request logs are noise at scale; slow and failed requests are logged below instead.
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: config.trustProxy,
    bodyLimit: 16 * 1024,
    requestTimeout: 15_000,
    keepAliveTimeout: 72_000, // longer than common load balancer idle timeouts (60s), avoiding stray 502s
    return503OnClosing: true
  });

  // ---- protection ----

  await app.register(helmet, { contentSecurityPolicy: false }); // pages set their own CSP
  if (config.corsOrigins.length) {
    await app.register(cors, {
      origin: config.corsOrigins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600
    });
  }

  // Load shedding: when the event loop or memory is saturated, answer 503 quickly instead of
  // slowing to a crawl or running out of memory.
  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxEventLoopUtilization: 0.98,
    maxHeapUsedBytes: Math.floor(v8.getHeapStatistics().heap_size_limit * 0.9),
    retryAfter: 10,
    pressureHandler: (request, reply) => reply
      .code(503)
      .header('Retry-After', '10')
      .send({ error: 'GROWND is very busy right now. Please try again in a few seconds.' }),
    exposeStatusRoute: { url: '/healthz', routeOpts: { logLevel: 'silent', config: { rateLimit: false } } }
  });

  // Per-IP limits on the API. With several instances, set REDIS_URL so they share one counter.
  let redis;
  if (config.redisUrl) {
    const mod = await import('ioredis');
    const Redis = mod.Redis ?? mod.default;
    redis = new Redis(config.redisUrl, { connectTimeout: 1000, maxRetriesPerRequest: 1, enableOfflineQueue: false });
    redis.on('error', err => app.log.warn({ err: err.message }, 'redis error'));
  }
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    redis,
    nameSpace: 'grownd-rl-',
    skipOnError: true, // if Redis is down, keep serving rather than locking everyone out
    allowList: request => !request.url.startsWith('/api/'),
    errorResponseBuilder: (request, context) => new HttpError(429, `Too many requests. Please try again in ${context.after}.`)
  });

  // ---- logging, errors, shutdown ----

  app.addHook('onResponse', async (request, reply) => {
    const ms = reply.elapsedTime;
    if (reply.statusCode >= 500 || ms > 1000) {
      request.log.warn({ method: request.method, url: request.url, status: reply.statusCode, ms: Math.round(ms) }, 'slow or failed request');
    }
  });

  app.setErrorHandler((err, request, reply) => {
    if (err instanceof HttpError) {
      if (err.cause) request.log.error({ err: err.cause }, err.message); // e.g. the payment provider's own error
      return reply.code(err.statusCode).send(err.errors ? { error: err.message, errors: err.errors } : { error: err.message });
    }
    if (DB_UNAVAILABLE.has(err.code)) {
      request.log.error({ err }, 'database unavailable');
      return reply.code(503).header('Retry-After', '5').send({ error: 'We are having trouble saving right now. Please try again in a moment.' });
    }
    const status = err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
    if (status === 500) request.log.error({ err }, 'unhandled error');
    const message = status === 413 ? 'That is more text than we can take in one go.'
      : status === 415 ? 'Please send JSON.'
      : status === 500 ? 'Something went wrong on our side. Please try again.'
      : 'That request did not look right.';
    return reply.code(status).send({ error: message });
  });

  app.setNotFoundHandler((request, reply) => reply.code(404).send({ error: 'Not found.' }));

  app.addHook('onClose', async () => {
    await sql.end({ timeout: 5 });
    if (redis) await redis.quit().catch(() => {});
  });

  // ---- routes ----

  await app.register(healthRoutes);
  await app.register(publicRoutes);
  await app.register(paymentRoutes);
  await app.register(adminRoutes);

  // Local convenience: serve the site and dashboard from the same origin as the API.
  if (config.serveFrontend) {
    await app.register(fastifyStatic, { root: path.join(FRONTEND, 'site'), prefix: '/' });
    await app.register(fastifyStatic, { root: path.join(FRONTEND, 'admin'), prefix: '/admin/', decorateReply: false, redirect: true });
  }

  return app;
}
