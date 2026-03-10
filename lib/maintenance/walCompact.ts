import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { listUsers } from "@/lib/admin/integrity";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getUserStoreDir } from "@/lib/userStore";
import { APP_CONFIG } from "@/lib/config/appConfig";

const WAL_FILE_NAME = "events.log";
const DEFAULT_RETENTION_DAYS = APP_CONFIG.cron.walRetentionDays;

export type WalCompactResult = {
  usersProcessed: number;
  totalLinesBefore: number;
  totalLinesAfter: number;
  totalBytesFreed: number;
};

function getWalFilePath(userEmail: string) {
  return path.join(getUserStoreDir(userEmail), WAL_FILE_NAME);
}

export async function compactUserWal(
  userEmail: string,
  retentionDays = DEFAULT_RETENTION_DAYS
): Promise<Result<{ linesBefore: number; linesAfter: number; bytesFreed: number }>> {
  return safeAction(async () => {
    const walPath = getWalFilePath(userEmail);
    let raw: string;
    try {
      raw = await fs.readFile(walPath, "utf8");
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
        // Keep unparseable lines to be safe
      }
      kept.push(line);
    }

    const linesAfter = kept.length;
    if (linesAfter === linesBefore) {
      return { linesBefore, linesAfter, bytesFreed: 0 };
    }

    const newContent = kept.length > 0 ? kept.join("\n") + "\n" : "";
    await atomicWriteTextFile(walPath, newContent);

    const sizeAfter = Buffer.byteLength(newContent, "utf8");
    const bytesFreed = Math.max(0, sizeBefore - sizeAfter);

    logger.info({
      event: "maintenance.wal.compact",
      userEmail,
      linesBefore,
      linesAfter,
      bytesFreed,
    });

    return { linesBefore, linesAfter, bytesFreed };
  }, { context: "maintenance.walCompact" });
}

export async function compactAllWals(
  retentionDays = DEFAULT_RETENTION_DAYS
): Promise<Result<WalCompactResult>> {
  return safeAction(async () => {
    const usersResult = await listUsers();
    if (!usersResult.ok) throw usersResult.error;

    let totalLinesBefore = 0;
    let totalLinesAfter = 0;
    let totalBytesFreed = 0;

    for (const email of usersResult.data) {
      const result = await compactUserWal(email, retentionDays);
      if (result.ok) {
        totalLinesBefore += result.data.linesBefore;
        totalLinesAfter += result.data.linesAfter;
        totalBytesFreed += result.data.bytesFreed;
      }
    }

    return {
      usersProcessed: usersResult.data.length,
      totalLinesBefore,
      totalLinesAfter,
      totalBytesFreed,
    };
  }, { context: "maintenance.compactAllWals" });
}
