import "server-only";

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Request-scoped async context
//
// Uses AsyncLocalStorage when available (Node.js runtime).
// Falls back to a no-op in Edge runtime where async_hooks is unavailable.
// ---------------------------------------------------------------------------

type RequestContext = {
  requestId: string;
  startedAt: number;
};

type StorageCompat = {
  run<T>(ctx: RequestContext, fn: () => T): T;
  getStore(): RequestContext | undefined;
};

let storage: StorageCompat;

try {
  // Dynamic require to avoid bundler issues in Edge runtime
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
  storage = new AsyncLocalStorage<RequestContext>();
} catch {
  // Fallback for Edge runtime — no async context propagation
  storage = {
    run<T>(_ctx: RequestContext, fn: () => T): T {
      return fn();
    },
    getStore(): RequestContext | undefined {
      return undefined;
    },
  };
}

/** Run `fn` with a fresh request context. */
export function runWithRequestContext<T>(fn: () => T, requestId?: string): T {
  return storage.run(
    { requestId: requestId ?? randomUUID(), startedAt: Date.now() },
    fn,
  );
}

/** Get the current request ID (or "no-request-ctx" outside a request). */
export function getCurrentRequestId(): string {
  return storage.getStore()?.requestId ?? "no-request-ctx";
}

/** Get the timestamp when the current request started. */
export function getRequestStartTime(): number {
  return storage.getStore()?.startedAt ?? Date.now();
}
