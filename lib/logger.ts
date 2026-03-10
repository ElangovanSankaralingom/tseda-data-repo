import "server-only";

import { normalizeError } from "@/lib/errors";
import { getCurrentRequestId } from "@/lib/api/asyncContext";
import { scrubString } from "@/lib/observability/scrubber";

type LogLevel = "debug" | "info" | "warn" | "error";

export type LogMeta = {
  event: string;
  requestId?: string;
  actorEmail?: string;
  userEmail?: string;
  category?: string;
  entryId?: string;
  status?: string;
  durationMs?: number;
  count?: number;
  sizeBytes?: number;
  errorCode?: string;
  source?: string;
  path?: string;
  method?: string;
  [key: string]: unknown;
};

const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|authorization|cookie|payload|before|after|stack|headers)/i;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 512;
const MAX_OBJECT_KEYS = 50;
const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// ---------------------------------------------------------------------------
// Slow operation thresholds (ms)
// ---------------------------------------------------------------------------

const SLOW_THRESHOLDS: Record<string, number> = {
  "file.read": 100,
  "file.write": 100,
  "index.rebuild": 500,
  "dashboard.compute": 200,
  "api.request": 1000,
};

function resolveLogLevel(): LogLevel {
  const raw = String(process.env.LOG_LEVEL ?? "").trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  if (process.env.NODE_ENV === "test") return "warn";
  if (process.env.NODE_ENV === "production") return "info";
  return "debug";
}

const ACTIVE_LOG_LEVEL = resolveLogLevel();

function logOutput(level: LogLevel, payload: Record<string, unknown>) {
  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (level === "info") {
    console.info(line);
    return;
  }
  console.debug(line);
}

function normalizeMessage(msg: unknown) {
  if (msg === undefined || msg === null) return undefined;
  if (typeof msg === "string") return scrubString(msg.slice(0, MAX_STRING_LENGTH));
  return scrubString(String(msg).slice(0, MAX_STRING_LENGTH));
}

function redactValue(value: unknown, key?: string, depth = 0): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) {
    return "[redacted]";
  }
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const truncated = value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`
      : value;
    return scrubString(truncated);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "function") return "[function]";

  if (value instanceof Error) {
    const normalized = normalizeError(value);
    return {
      name: normalized.name,
      code: normalized.code,
      message: scrubString(normalized.message),
    };
  }

  if (depth >= MAX_DEPTH) return "[max-depth]";

  if (Array.isArray(value)) {
    const capped = value.slice(0, MAX_ARRAY_ITEMS);
    const next = capped.map((item) => redactValue(item, undefined, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      next.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    }
    return next;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    const next: Record<string, unknown> = {};
    for (const [nestedKey, nestedValue] of entries) {
      next[nestedKey] = redactValue(nestedValue, nestedKey, depth + 1);
    }
    if (Object.keys(value as Record<string, unknown>).length > MAX_OBJECT_KEYS) {
      next.__truncatedKeys = true;
    }
    return next;
  }

  return String(value);
}

export function redact(meta: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    next[key] = redactValue(value, key);
  }
  return next;
}

function emit(level: LogLevel, meta: LogMeta, msg?: unknown) {
  if (LOG_LEVEL_ORDER[level] < LOG_LEVEL_ORDER[ACTIVE_LOG_LEVEL]) {
    return;
  }
  const payload: Record<string, unknown> = {
    level,
    ts: new Date().toISOString(),
    requestId: meta.requestId ?? getCurrentRequestId(),
    ...redact(meta),
  };
  const normalizedMsg = normalizeMessage(msg);
  if (normalizedMsg) payload.msg = normalizedMsg;
  logOutput(level, payload);
}

export const logger = {
  debug(meta: LogMeta, msg?: unknown) {
    emit("debug", meta, msg);
  },
  info(meta: LogMeta, msg?: unknown) {
    emit("info", meta, msg);
  },
  warn(meta: LogMeta, msg?: unknown) {
    emit("warn", meta, msg);
  },
  error(meta: LogMeta, msg?: unknown) {
    emit("error", meta, msg);
  },
};

// ---------------------------------------------------------------------------
// Slow operation detection
// ---------------------------------------------------------------------------

/**
 * Check if an operation duration exceeds the slow threshold and log a warning.
 * Called automatically by `withTimer` on completion.
 */
function checkSlowOperation(event: string, durationMs: number, meta: Record<string, unknown>) {
  // Match against known threshold patterns
  for (const [pattern, threshold] of Object.entries(SLOW_THRESHOLDS)) {
    if (event.startsWith(pattern) && durationMs > threshold) {
      logger.warn({
        event: "slow_operation",
        slowEvent: event,
        durationMs,
        thresholdMs: threshold,
        ...meta,
      }, `Slow operation: ${event} took ${durationMs}ms (threshold: ${threshold}ms)`);
      return;
    }
  }
  // Generic slow detection for any API response > 1000ms
  if (durationMs > 1000) {
    logger.warn({
      event: "slow_operation",
      slowEvent: event,
      durationMs,
      thresholdMs: 1000,
      ...meta,
    }, `Slow operation: ${event} took ${durationMs}ms`);
  }
}

export async function withTimer<T>(
  event: string,
  fn: () => Promise<T> | T,
  meta: Omit<LogMeta, "event" | "durationMs"> = {}
): Promise<T> {
  const startedAt = Date.now();
  logger.debug({ event: `${event}.start`, ...meta });
  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    logger.info({
      event: `${event}.end`,
      ...meta,
      durationMs,
    });
    checkSlowOperation(event, durationMs, meta as Record<string, unknown>);
    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const normalized = normalizeError(error);
    logger.error(
      {
        event: `${event}.error`,
        ...meta,
        durationMs,
        errorCode: normalized.code,
      },
      normalized.message
    );
    checkSlowOperation(event, durationMs, meta as Record<string, unknown>);
    throw error;
  }
}
