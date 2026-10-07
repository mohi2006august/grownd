// Types for the parts of the API (backend/, plain JavaScript) that the Next.js app imports directly.
declare module "@/backend/src/services/content.js" {
  /** The public content (/api/content) as a JSON string, cached for a few seconds. */
  export const getContentJson: (() => Promise<string>) & { invalidate(): void };
}

declare module "@/backend/src/app.js" {
  import type { FastifyInstance } from "fastify";
  export function buildApp(options?: {
    onError?: (err: unknown, context: Record<string, unknown>) => void;
    defer?: (task: () => Promise<void> | void) => void;
  }): Promise<FastifyInstance & { later(fn: () => unknown): void }>;
}
