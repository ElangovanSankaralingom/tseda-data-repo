import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getDataRoot } from "@/lib/userStore";

export type ExportHistoryEntry = {
  id: string;
  createdAt: string;
  format: string;
  scope: string;
  category: string;
  recordCount: number;
  fileSize: number;
  requestedBy: string;
  templateId?: string;
  durationMs: number;
};

const MAX_HISTORY = 50;

function historyPath() {
  return path.join(process.cwd(), getDataRoot(), "maintenance", "export-history.json");
}

export async function appendExportHistory(entry: ExportHistoryEntry): Promise<Result<void>> {
  return safeAction(async () => {
    const dir = path.dirname(historyPath());
    await fs.mkdir(dir, { recursive: true });

    let existing: ExportHistoryEntry[] = [];
    try {
      const raw = await fs.readFile(historyPath(), "utf8");
      existing = JSON.parse(raw) as ExportHistoryEntry[];
    } catch {
      // File doesn't exist or is corrupt
    }

    existing.unshift(entry);
    if (existing.length > MAX_HISTORY) {
      existing = existing.slice(0, MAX_HISTORY);
    }

    await atomicWriteTextFile(historyPath(), JSON.stringify(existing, null, 2));

    logger.info({
      event: "export.history.append",
      exportId: entry.id,
      format: entry.format,
      recordCount: entry.recordCount,
    });
  }, { context: "export.history.append" });
}

export async function getExportHistory(limit = 10): Promise<Result<ExportHistoryEntry[]>> {
  return safeAction(async () => {
    try {
      const raw = await fs.readFile(historyPath(), "utf8");
      const all = JSON.parse(raw) as ExportHistoryEntry[];
      return all.slice(0, limit);
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") return [];
      throw error;
    }
  }, { context: "export.history.read" });
}
