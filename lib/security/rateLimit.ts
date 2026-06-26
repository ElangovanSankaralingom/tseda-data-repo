import "server-only";

import { AppError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";

export type RateLimitOptions = {
  windowMs: number;
  max: number;
};

type RateLimitBucket = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, RateLimitBucket>();

const MAX_BUCKETS = 10000;

import { APP_CONFIG } from "@/lib/config/appConfig";

export const RATE_LIMIT_PRESETS = APP_CONFIG.rateLimits;

let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 60_000;

function maybePrune(now: number, windowMs: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  const ttlMs = windowMs * 5;
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart > ttlMs) {
      buckets.delete(key);
    }
  }
}

function ensureBucketLimit() {
  if (buckets.size <= MAX_BUCKETS) return;
  const entries = [...buckets.entries()].sort((a, b) => a[1].windowStart - b[1].windowStart);
  const toRemove = entries.slice(0, buckets.size - MAX_BUCKETS + 100);
  for (const [key] of toRemove) {
    buckets.delete(key);
  }
}

function normalizeRateKeyPart(value: string) {
  return value.trim().toLowerCase();
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded
      .split(",")
      .map((value) => value.trim())
      .find(Boolean);
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return null;
}

export function rateLimit(key: string, options: RateLimitOptions): Result<void> {
  const now = Date.now();
  const normalizedKey = normalizeRateKeyPart(key);
  if (!normalizedKey) {
    return err(
      new AppError({
        code: "VALIDATION_ERROR",
        message: "Rate-limit key is required.",
      })
    );
  }
  if (!Number.isFinite(options.windowMs) || options.windowMs <= 0) {
    return err(
      new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid rate-limit window.",
      })
    );
  }
  if (!Number.isFinite(options.max) || options.max <= 0) {
    return err(
      new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid rate-limit max value.",
      })
    );
  }

  maybePrune(now, options.windowMs);

  const bucket = buckets.get(normalizedKey);

  if (!bucket || now - bucket.windowStart >= options.windowMs) {
    ensureBucketLimit();
    buckets.set(normalizedKey, { count: 1, windowStart: now });
    return ok(undefined);
  }

  if (bucket.count >= options.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.windowStart + options.windowMs - now) / 1000));
    return err(
      new AppError({
        code: "RATE_LIMITED",
        message: `Too many requests. Try again in ${retryAfterSeconds}s.`,
        details: { key: normalizedKey, retryAfterSeconds },
      })
    );
  }

  bucket.count++;
  return ok(undefined);
}

export function enforceRateLimitOrThrow(key: string, options: RateLimitOptions) {
  const result = rateLimit(key, options);
  if (!result.ok) {
    throw result.error;
  }
}

export function enforceRateLimitForRequest(args: {
  request: Request;
  action: string;
  options: RateLimitOptions;
  userEmail?: string | null;
}) {
  const normalizedAction = normalizeRateKeyPart(args.action);
  if (!normalizedAction) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Rate-limit action is required.",
    });
  }

  if (args.userEmail) {
    const normalizedEmail = normalizeRateKeyPart(args.userEmail);
    if (normalizedEmail) {
      enforceRateLimitOrThrow(`user:${normalizedEmail}:action:${normalizedAction}`, args.options);
    }
  }

  const ip = getRequestIp(args.request);
  if (ip) {
    enforceRateLimitOrThrow(`ip:${normalizeRateKeyPart(ip)}:action:${normalizedAction}`, args.options);
  }
}
