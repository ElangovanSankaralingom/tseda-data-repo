import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getDataRoot } from "@/lib/userStore";
import { computeAnalytics, type AnalyticsSnapshot } from "@/lib/analytics/compute";
import { getAnalyticsCacheTTL } from "@/lib/settings/consumer";

const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour fallback

function cachePath() {
  return path.join(process.cwd(), getDataRoot(), "maintenance", "analytics-cache.json");
}

type CacheEnvelope = {
  computedAt: string;
  snapshot: AnalyticsSnapshot;
};

export async function getCachedAnalytics(forceRefresh = false): Promise<Result<AnalyticsSnapshot>> {
  return safeAction(async () => {
    let cacheTtlMs = DEFAULT_CACHE_TTL_MS;
    try {
      const ttlMinutes = await getAnalyticsCacheTTL();
      if (ttlMinutes > 0) cacheTtlMs = ttlMinutes * 60 * 1000;
    } catch {
      // use default
    }

    if (!forceRefresh) {
      try {
        const raw = await fs.readFile(cachePath(), "utf8");
        const envelope = JSON.parse(raw) as CacheEnvelope;
        const age = Date.now() - Date.parse(envelope.computedAt);
        if (age < cacheTtlMs) {
          logger.info({ event: "analytics.cache.hit", ageMs: age });
          return envelope.snapshot;
        }
        logger.info({ event: "analytics.cache.stale", ageMs: age });
      } catch {
        // Cache miss or corrupt
      }
    }

    const result = await computeAnalytics();
    if (!result.ok) throw result.error;

    const envelope: CacheEnvelope = {
      computedAt: result.data.computedAt,
      snapshot: result.data,
    };

    const dir = path.dirname(cachePath());
    await fs.mkdir(dir, { recursive: true });
    await atomicWriteTextFile(cachePath(), JSON.stringify(envelope, null, 2));
    logger.info({
      event: "analytics.cache.refreshed",
      durationMs: result.data.durationMs,
      entries: result.data.totalEntries,
      users: result.data.totalUsers,
    });

    return result.data;
  }, { context: "analytics.cache" });
}

export function getCacheAge(): Promise<Result<{ computedAt: string | null; ageMs: number | null }>> {
  return safeAction(async () => {
    try {
      const raw = await fs.readFile(cachePath(), "utf8");
      const envelope = JSON.parse(raw) as CacheEnvelope;
      return {
        computedAt: envelope.computedAt,
        ageMs: Date.now() - Date.parse(envelope.computedAt),
      };
    } catch {
      return { computedAt: null, ageMs: null };
    }
  }, { context: "analytics.cacheAge" });
}
