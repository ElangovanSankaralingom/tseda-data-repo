import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getDataRoot } from "@/lib/userStore";

export type MaintenanceAction = {
  ts: string;
  action: string;
  actorEmail: string;
  durationMs: number;
  success: boolean;
  summary: Record<string, unknown>;
};

const LOG_FILE_NAME = "maintenance-log.jsonl";
const MAX_LOG_ENTRIES = 100;

function logFilePath() {
  return path.join(process.cwd(), getDataRoot(), "maintenance", LOG_FILE_NAME);
}

export async function appendMaintenanceLog(entry: MaintenanceAction): Promise<Result<void>> {
  return safeAction(async () => {
    const dir = path.dirname(logFilePath());
    await fs.mkdir(dir, { recursive: true });
    const line = JSON.stringify(entry) + "\n";
    await fs.appendFile(logFilePath(), line, "utf8");

    logger.info({
      event: "maintenance.log.append",
      action: entry.action,
      actorEmail: entry.actorEmail,
      success: entry.success,
    });
  }, { context: "maintenance.log.append" });
}

export async function readMaintenanceLog(limit = 20): Promise<Result<MaintenanceAction[]>> {
  return safeAction(async () => {
    let raw: string;
    try {
      raw = await fs.readFile(logFilePath(), "utf8");
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") return [];
      throw error;
    }

    const lines = raw.split("\n").filter((l) => l.trim());
    const entries: MaintenanceAction[] = [];
    for (const line of lines) {
      try {
        entries.push(JSON.parse(line) as MaintenanceAction);
      } catch {
        // Skip unparseable lines
      }
    }

    // Return most recent first, limited
    return entries.reverse().slice(0, Math.min(limit, MAX_LOG_ENTRIES));
  }, { context: "maintenance.log.read" });
}
