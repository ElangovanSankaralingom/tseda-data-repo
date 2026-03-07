import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { listUsers } from "@/lib/admin/integrity";
import { listBackups } from "@/lib/backup/backupService";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getDataRoot, getUserStoreDir } from "@/lib/userStore";

export type SystemStats = {
  computedAtISO: string;
  users: { total: number };
  storage: {
    dataBytes: number;
    backupBytes: number;
    uploadBytes: number;
  };
  wal: {
    totalFiles: number;
    totalBytes: number;
  };
  backups: {
    total: number;
    latestAt: string | null;
    totalBytes: number;
  };
};

async function dirSize(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await dirSize(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          total += stat.size;
        } catch {
          // Skip inaccessible files
        }
      }
    }
  } catch {
    // Directory may not exist
  }
  return total;
}

async function fileSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

export async function computeSystemStats(): Promise<Result<SystemStats>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const dataRoot = path.join(process.cwd(), getDataRoot());

    const usersResult = await listUsers();
    const userEmails = usersResult.ok ? usersResult.data : [];

    let walTotalFiles = 0;
    let walTotalBytes = 0;
    for (const email of userEmails) {
      const walPath = path.join(getUserStoreDir(email), "events.log");
      const size = await fileSize(walPath);
      if (size > 0) {
        walTotalFiles += 1;
        walTotalBytes += size;
      }
    }

    const dataBytes = await dirSize(path.join(dataRoot, "users"));
    const backupDir = path.join(process.cwd(), ".data_backups");
    const backupDirBytes = await dirSize(backupDir);
    const uploadBytes = await dirSize(path.join(process.cwd(), "public", "uploads"));

    const backupsResult = await listBackups();
    const backupList = backupsResult.ok ? backupsResult.data : [];
    const latestBackup = backupList.length > 0 ? backupList[0] : null;

    const stats: SystemStats = {
      computedAtISO: new Date().toISOString(),
      users: { total: userEmails.length },
      storage: {
        dataBytes,
        backupBytes: backupDirBytes,
        uploadBytes,
      },
      wal: {
        totalFiles: walTotalFiles,
        totalBytes: walTotalBytes,
      },
      backups: {
        total: backupList.length,
        latestAt: latestBackup?.createdAt ?? null,
        totalBytes: backupList.reduce((sum, b) => sum + b.sizeBytes, 0),
      },
    };

    logger.info({
      event: "maintenance.stats.computed",
      users: stats.users.total,
      dataBytes: stats.storage.dataBytes,
      walFiles: stats.wal.totalFiles,
      backups: stats.backups.total,
      durationMs: Date.now() - startedAt,
    });

    return stats;
  }, { context: "maintenance.stats" });
}
