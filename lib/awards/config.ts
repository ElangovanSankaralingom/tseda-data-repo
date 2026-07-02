import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { getDataRoot } from "@/lib/userStore";
import {
  AWARD_METRICS,
  getAwardMetric,
  type AwardMetricDefinition,
  type AwardPointsModel,
} from "@/data/awardMetrics";

/**
 * Admin-adjustable award points.
 *
 * The registry (`data/awardMetrics.ts`) carries the DOCUMENT DEFAULTS; this
 * store carries per-metric overrides set by admins, merged at read time —
 * the same defaults-in-code + stored-overrides pattern as the faculty
 * registry and settings. Scoring must always resolve points through
 * `resolveEffectivePointsModel`, never read the registry values directly.
 */

export type AwardPointsOverride = {
  /** For fixed/perUnit models. */
  points?: number;
  /** For tiered models — tier key → points. Unknown keys are ignored. */
  tiers?: Record<string, number>;
  updatedBy: string;
  updatedAt: string;
};

type AwardPointsConfig = {
  version: 1;
  overrides: Record<string, AwardPointsOverride>;
};

const EMPTY: AwardPointsConfig = { version: 1, overrides: {} };

function configPath(): string {
  return path.join(process.cwd(), getDataRoot(), "awards", "points-config.json");
}

export async function getAwardPointsConfig(): Promise<AwardPointsConfig> {
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<AwardPointsConfig>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.overrides !== "object") {
      return { ...EMPTY };
    }
    return { version: 1, overrides: parsed.overrides ?? {} };
  } catch {
    return { ...EMPTY };
  }
}

export async function setAwardPointsOverride(
  metricId: string,
  update: { points?: number; tiers?: Record<string, number> } | null,
  adminEmail: string,
): Promise<AwardPointsConfig> {
  if (!getAwardMetric(metricId)) {
    throw new Error(`Unknown award metric: ${metricId}`);
  }
  const config = await getAwardPointsConfig();
  if (update === null) {
    delete config.overrides[metricId];
  } else {
    const clean: AwardPointsOverride = {
      updatedBy: adminEmail,
      updatedAt: new Date().toISOString(),
    };
    if (typeof update.points === "number" && Number.isFinite(update.points) && update.points >= 0) {
      clean.points = update.points;
    }
    if (update.tiers && typeof update.tiers === "object") {
      const tiers: Record<string, number> = {};
      for (const [key, value] of Object.entries(update.tiers)) {
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
          tiers[key] = value;
        }
      }
      if (Object.keys(tiers).length > 0) clean.tiers = tiers;
    }
    if (clean.points === undefined && clean.tiers === undefined) {
      throw new Error("Override must set points or tiers.");
    }
    config.overrides[metricId] = clean;
  }
  const filePath = configPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteTextFile(filePath, JSON.stringify(config, null, 2));
  return config;
}

/** Registry defaults + admin overrides → the points model scoring must use. */
export function resolveEffectivePointsModel(
  metric: AwardMetricDefinition,
  config: AwardPointsConfig,
): AwardPointsModel {
  const override = config.overrides[metric.id];
  const model = metric.pointsModel;
  if (!override) return model;

  if (model.kind === "fixed") {
    return { ...model, points: override.points ?? model.points };
  }
  if (model.kind === "perUnit") {
    return { ...model, points: override.points ?? model.points };
  }
  // tiered
  return {
    kind: "tiered",
    tiers: model.tiers.map((tier) => ({
      ...tier,
      points: override.tiers?.[tier.key] ?? tier.points,
    })),
  };
}

/** Full effective view (for the admin UI and the dashboard legend). */
export async function listEffectiveAwardMetrics(): Promise<
  Array<AwardMetricDefinition & { effectiveModel: AwardPointsModel; overridden: boolean }>
> {
  const config = await getAwardPointsConfig();
  return AWARD_METRICS.map((metric) => ({
    ...metric,
    effectiveModel: resolveEffectivePointsModel(metric, config),
    overridden: !!config.overrides[metric.id],
  }));
}
