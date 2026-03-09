import "server-only";

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { createBackupZip } from "@/lib/backup/backupService";
import { checkUserIntegrity, listUsers } from "@/lib/admin/integrity";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { rebuildUserIndex } from "@/lib/data/indexStore";
import { AppError, normalizeError } from "@/lib/errors";
import { runAutoArchive, type AutoArchiveResult } from "@/lib/jobs/autoArchive";
import { runEditGrantExpiry, type EditGrantExpiryResult } from "@/lib/jobs/editGrantExpiry";
import { runTimerWarnings, type TimerWarningResult } from "@/lib/jobs/timerWarning";
import { runNightlyWalCompaction, type NightlyWalCompactionResult } from "@/lib/jobs/walCompaction";
import { logger } from "@/lib/logger";
import { type Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getDataRoot } from "@/lib/userStore";

export type NightlyBackupResult = {
  backupFilename: string;
  sizeBytes: number;
};

export type NightlyIntegrityResult = {
  usersScanned: number;
  usersFailed: number;
  issuesFound: number;
  indexRebuildsAttempted: number;
  indexRebuildsSucceeded: number;
  indexRebuildsFailed: number;
};

export type NightlyHousekeepingResult = {
  tempFilesDeleted: number;
};

type JobStepSuccess<T> = { ok: true; data: T };
type JobStepFailure = { ok: false; errorCode: string; message: string };

type JobStepResult<T> = JobStepSuccess<T> | JobStepFailure;

export type NightlyMaintenanceSummary = {
  startedAt: string;
  finishedAt: string;
  overallSuccess: boolean;
  backup: JobStepResult<NightlyBackupResult>;
  integrity: JobStepResult<NightlyIntegrityResult>;
  housekeeping: JobStepResult<NightlyHousekeepingResult>;
  autoArchive: JobStepResult<AutoArchiveResult>;
  editGrantExpiry: JobStepResult<EditGrantExpiryResult>;
  timerWarnings: JobStepResult<TimerWarningResult>;
  walCompaction: JobStepResult<NightlyWalCompactionResult>;
};

function maintenanceDirPath() {
  return path.join(process.cwd(), getDataRoot(), "maintenance");
}

function maintenanceLastRunPath() {
  return path.join(maintenanceDirPath(), "lastRun.json");
}

function stepSuccess<T>(data: T): JobStepSuccess<T> {
  return { ok: true, data };
}

function stepFailure(error: unknown): JobStepFailure {
  const normalized = normalizeError(error);
  return {
    ok: false,
    errorCode: normalized.code,
    message: normalized.message,
  };
}

function hasIndexMismatchIssue(issueCode: string) {
  return issueCode.startsWith("INDEX_");
}

async function writeLastRun(summary: NightlyMaintenanceSummary) {
  const dir = maintenanceDirPath();
  await fs.mkdir(dir, { recursive: true });
  await atomicWriteTextFile(maintenanceLastRunPath(), JSON.stringify(summary, null, 2));
}

export async function getLastMaintenanceRun(): Promise<Result<NightlyMaintenanceSummary | null>> {
  return safeAction(async () => {
    try {
      const raw = await fs.readFile(maintenanceLastRunPath(), "utf8");
      const parsed = JSON.parse(raw) as NightlyMaintenanceSummary;
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") return null;
      throw error;
    }
  }, {
    context: "jobs.nightly.getLastRun",
  });
}

export async function runNightlyBackup(): Promise<Result<NightlyBackupResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const backupResult = await createBackupZip();
    if (!backupResult.ok) {
      throw backupResult.error;
    }

    logger.info({
      event: "jobs.nightly.backup.success",
      count: 1,
      sizeBytes: backupResult.data.sizeBytes,
      durationMs: Date.now() - startedAt,
    });
    return {
      backupFilename: backupResult.data.filename,
      sizeBytes: backupResult.data.sizeBytes,
    };
  }, {
    context: "jobs.nightly.backup",
  });
}

export async function runNightlyIntegrityCheck(): Promise<Result<NightlyIntegrityResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const usersResult = await listUsers();
    if (!usersResult.ok) {
      throw usersResult.error;
    }

    let usersFailed = 0;
    let issuesFound = 0;
    let indexRebuildsAttempted = 0;
    let indexRebuildsSucceeded = 0;
    let indexRebuildsFailed = 0;

    for (const userEmail of usersResult.data) {
      const integrityResult = await checkUserIntegrity(userEmail);
      if (!integrityResult.ok) {
        usersFailed += 1;
        logger.warn({
          event: "jobs.nightly.integrity.user.failed",
          userEmail,
          errorCode: integrityResult.error.code,
        });
        continue;
      }

      const report = integrityResult.data;
      issuesFound += report.issues.length;
      const shouldRebuildIndex = report.issues.some((issue) =>
        hasIndexMismatchIssue(issue.code)
      );
      if (!shouldRebuildIndex) continue;

      indexRebuildsAttempted += 1;
      const rebuildResult = await rebuildUserIndex(userEmail);
      if (rebuildResult.ok) {
        indexRebuildsSucceeded += 1;
        continue;
      }

      indexRebuildsFailed += 1;
      logger.warn({
        event: "jobs.nightly.integrity.rebuild.failed",
        userEmail,
        errorCode: rebuildResult.error.code,
      });
    }

    const summary: NightlyIntegrityResult = {
      usersScanned: usersResult.data.length,
      usersFailed,
      issuesFound,
      indexRebuildsAttempted,
      indexRebuildsSucceeded,
      indexRebuildsFailed,
    };

    logger.info({
      event: "jobs.nightly.integrity.summary",
      count: summary.usersScanned,
      issuesFound: summary.issuesFound,
      indexRebuildsAttempted: summary.indexRebuildsAttempted,
      indexRebuildsSucceeded: summary.indexRebuildsSucceeded,
      indexRebuildsFailed: summary.indexRebuildsFailed,
      durationMs: Date.now() - startedAt,
    });

    return summary;
  }, {
    context: "jobs.nightly.integrity",
  });
}

export async function runNightlyExportHousekeeping(): Promise<Result<NightlyHousekeepingResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const tempDir = path.join(process.cwd(), getDataRoot(), "exports", "tmp");

    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(tempDir, { withFileTypes: true });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") {
        return { tempFilesDeleted: 0 };
      }
      throw error;
    }

    let deleted = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = path.join(tempDir, entry.name);
      await fs.unlink(filePath);
      deleted += 1;
    }

    logger.info({
      event: "jobs.nightly.export.housekeeping",
      count: deleted,
      durationMs: Date.now() - startedAt,
    });
    return { tempFilesDeleted: deleted };
  }, {
    context: "jobs.nightly.export.housekeeping",
  });
}

export async function runNightlyMaintenance(): Promise<Result<NightlyMaintenanceSummary>> {
  return safeAction(async () => {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();

    const backupResult = await runNightlyBackup();
    const integrityResult = await runNightlyIntegrityCheck();
    const housekeepingResult = await runNightlyExportHousekeeping();
    const autoArchiveResult = await runAutoArchive();
    const editGrantExpiryResult = await runEditGrantExpiry();
    const timerWarningsResult = await runTimerWarnings();
    const walCompactionResult = await runNightlyWalCompaction();

    const summary: NightlyMaintenanceSummary = {
      startedAt,
      finishedAt: new Date().toISOString(),
      overallSuccess:
        backupResult.ok &&
        integrityResult.ok &&
        housekeepingResult.ok &&
        autoArchiveResult.ok &&
        editGrantExpiryResult.ok &&
        timerWarningsResult.ok &&
        walCompactionResult.ok,
      backup: backupResult.ok ? stepSuccess(backupResult.data) : stepFailure(backupResult.error),
      integrity: integrityResult.ok
        ? stepSuccess(integrityResult.data)
        : stepFailure(integrityResult.error),
      housekeeping: housekeepingResult.ok
        ? stepSuccess(housekeepingResult.data)
        : stepFailure(housekeepingResult.error),
      autoArchive: autoArchiveResult.ok
        ? stepSuccess(autoArchiveResult.data)
        : stepFailure(autoArchiveResult.error),
      editGrantExpiry: editGrantExpiryResult.ok
        ? stepSuccess(editGrantExpiryResult.data)
        : stepFailure(editGrantExpiryResult.error),
      timerWarnings: timerWarningsResult.ok
        ? stepSuccess(timerWarningsResult.data)
        : stepFailure(timerWarningsResult.error),
      walCompaction: walCompactionResult.ok
        ? stepSuccess(walCompactionResult.data)
        : stepFailure(walCompactionResult.error),
    };

    await writeLastRun(summary);

    logger.info({
      event: "jobs.nightly.maintenance.summary",
      status: summary.overallSuccess ? "success" : "partial_failure",
      durationMs: Date.now() - startedMs,
    });

    return summary;
  }, {
    context: "jobs.nightly.maintenance",
  });
}

export function assertCronSecret(secretFromRequest: string | null): string {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    throw new AppError({
      code: "UNAUTHORIZED",
      message: "Cron secret is not configured.",
    });
  }

  if ((secretFromRequest ?? "").trim() !== cronSecret) {
    throw new AppError({
      code: "UNAUTHORIZED",
      message: "Invalid cron secret.",
    });
  }

  return cronSecret;
}
