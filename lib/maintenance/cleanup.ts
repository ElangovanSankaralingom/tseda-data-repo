import "server-only";

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getDataRoot, getUsersRootDir } from "@/lib/userStore";

export type CleanupResult = {
  tempFilesRemoved: number;
  emptyDirsRemoved: number;
  bytesFreed: number;
};

async function safeReaddir(dirPath: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function safeFileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

async function cleanTmpFiles(rootDir: string): Promise<{ count: number; bytes: number }> {
  let count = 0;
  let bytes = 0;

  async function scan(dir: string) {
    const entries = await safeReaddir(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && entry.name.includes(".tmp.")) {
        const size = await safeFileSize(fullPath);
        try {
          await fs.unlink(fullPath);
          count += 1;
          bytes += size;
        } catch {
          // Skip if locked or already removed
        }
      }
    }
  }

  await scan(rootDir);
  return { count, bytes };
}

async function cleanEmptyUserDirs(): Promise<number> {
  const usersRoot = getUsersRootDir();
  const entries = await safeReaddir(usersRoot);
  let removed = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(usersRoot, entry.name);
    const contents = await safeReaddir(dirPath);
    if (contents.length === 0) {
      try {
        await fs.rmdir(dirPath);
        removed += 1;
      } catch {
        // Skip
      }
    }
  }

  return removed;
}

async function cleanExportTmp(): Promise<{ count: number; bytes: number }> {
  const tmpDir = path.join(process.cwd(), getDataRoot(), "exports", "tmp");
  const entries = await safeReaddir(tmpDir);
  let count = 0;
  let bytes = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(tmpDir, entry.name);
    const size = await safeFileSize(fullPath);
    try {
      await fs.unlink(fullPath);
      count += 1;
      bytes += size;
    } catch {
      // Skip
    }
  }

  return { count, bytes };
}

export async function runCleanup(): Promise<Result<CleanupResult>> {
  return safeAction(async () => {
    const dataRoot = path.join(process.cwd(), getDataRoot());

    const tmpResult = await cleanTmpFiles(dataRoot);
    const exportResult = await cleanExportTmp();
    const emptyDirsRemoved = await cleanEmptyUserDirs();

    const result: CleanupResult = {
      tempFilesRemoved: tmpResult.count + exportResult.count,
      emptyDirsRemoved,
      bytesFreed: tmpResult.bytes + exportResult.bytes,
    };

    logger.info({
      event: "maintenance.cleanup",
      ...result,
    });

    return result;
  }, { context: "maintenance.cleanup" });
}
