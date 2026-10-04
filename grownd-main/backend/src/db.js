import postgres from 'postgres';
import { config } from './config.js';

// One small pool per process. Point DATABASE_URL at Supabase's pooler (Supavisor) so many API
// processes share a bounded number of real Postgres connections.
export const sql = postgres(config.databaseUrl, {
  max: config.dbPoolMax,
  prepare: false, // required by the transaction pooler (port 6543)
  idle_timeout: 20,
  connect_timeout: 10,
  max_lifetime: 60 * 30,
  connection: { application_name: 'grownd-api' },
  onnotice: () => {}
});

/**
 * Cancels a query that has not finished within `ms`, whether it is still queued for a
 * connection or already running, so slow moments turn into quick 503s instead of pile-ups.
 */
export async function timed(query, ms) {
  const timer = setTimeout(() => query.cancel(), ms);
  try {
    return await query;
  } finally {
    clearTimeout(timer);
  }
}

/** Postgres error codes the app translates into friendly answers. */
export const PG = { FOREIGN_KEY: '23503', CHECK: '23514', CANCELED: '57014' };

/** Errors that mean "the database is unreachable or overloaded right now", answered with 503. */
export const DB_UNAVAILABLE = new Set([
  PG.CANCELED, '53300', '57P01', '57P03', // canceled, too many connections, shutting down, starting up
  'CONNECT_TIMEOUT', 'CONNECTION_CLOSED', 'CONNECTION_ENDED', 'CONNECTION_DESTROYED',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'
]);
