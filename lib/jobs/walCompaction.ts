import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { logger } from "@/lib/logger";
import { compactAllWals, type WalCompactResult } from "@/lib/maintenance/walCompact";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getDataRoot } from "@/lib/userStore";
import { APP_CONFIG } from "@/lib/config/appConfig";

export type NightlyWalCompactionResult = {
  userWal: WalCompactResult;
  telemetry: { linesBefore: number; linesAfter: number; bytesFreed: number };
};

const DEFAULT_RETENTION_DAYS = APP_CONFIG.cron.walRetentionDays;

function getTelemetryEventsPath() {
  return path.join(process.cwd(), getDataRoot(), "telemetry", "events.log");
}

async function compactTelemetryLog(retentionDays = DEFAULT_RETENTION_DAYS) {
  const filePath = getTelemetryEventsPath();
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") return { linesBefore: 0, linesAfter: 0, bytesFreed: 0 };
    throw error;
  }

  const sizeBefore = Buffer.byteLength(raw, "utf8");
  const lines = raw.split("\n").filter((l) => l.trim());
  const linesBefore = lines.length;
  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const kept: string[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line) as { ts?: string };
      const ts = parsed.ts ? Date.parse(parsed.ts) : Number.NaN;
      if (!Number.isNaN(ts) && ts < cutoffMs) continue;
    } catch {
      // Keep unparseable lines
    }
    kept.push(line);
  }

  const linesAfter = kept.length;
  if (linesAfter === linesBefore) {
    return { linesBefore, linesAfter, bytesFreed: 0 };
  }

  const newContent = kept.length > 0 ? kept.join("\n") + "\n" : "";
  await atomicWriteTextFile(filePath, newContent);

  const sizeAfter = Buffer.byteLength(newContent, "utf8");
  const bytesFreed = Math.max(0, sizeBefore - sizeAfter);

  logger.info({
    event: "jobs.walCompaction.telemetry",
    linesBefore,
    linesAfter,
    bytesFreed,
  });

  return { linesBefore, linesAfter, bytesFreed };
}

export async function runNightlyWalCompaction(): Promise<Result<NightlyWalCompactionResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();

    const userWalResult = await compactAllWals(DEFAULT_RETENTION_DAYS);
    if (!userWalResult.ok) throw userWalResult.error;

    const telemetryResult = await compactTelemetryLog(DEFAULT_RETENTION_DAYS);

    logger.info({
      event: "jobs.walCompaction.summary",
      userWalLinesFreed: userWalResult.data.totalLinesBefore - userWalResult.data.totalLinesAfter,
      telemetryLinesFreed: telemetryResult.linesBefore - telemetryResult.linesAfter,
      totalBytesFreed: userWalResult.data.totalBytesFreed + telemetryResult.bytesFreed,
      durationMs: Date.now() - startedAt,
    });

    return {
      userWal: userWalResult.data,
      telemetry: telemetryResult,
    };
  }, {
    context: "jobs.walCompaction",
  });
}
