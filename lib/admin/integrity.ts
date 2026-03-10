import "server-only";

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { CATEGORY_KEYS, isCategoryKey } from "@/lib/categories";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { withUserDataLock } from "@/lib/data/locks";
import {
  rebuildUserIndex as rebuildUserIndexFromStore,
  type UserIndex,
} from "@/lib/data/indexStore";
import { rebuildUserIndexFromWal } from "@/lib/data/recovery";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { migrateUserIndex } from "@/lib/migrations";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getUsersRootDir, getUserStoreDir } from "@/lib/userStore";
import { logger } from "@/lib/logger";

// Re-export all public types from sub-modules
export type {
  IntegrityIssue,
  CategoryIntegrityReport,
  IndexIntegrityReport,
  WalIntegrityReport,
  IntegrityReport,
  IntegritySummary,
  RepairResult,
  MigrationResult,
} from "./integrityTypes";

import { INDEX_FILE_NAME } from "./integrityTypes";
import type { IntegrityReport, IntegritySummary, MigrationResult, RepairResult } from "./integrityTypes";
import { checkUserIntegrityInternal, toSummary } from "./integrityCheck";
import { createBackup, repairCategoryStoreInternal } from "./integrityRepair";

// ---------------------------------------------------------------------------
// Public API — all wrapped in safeAction for backward compatibility
// ---------------------------------------------------------------------------

export async function listUsers(): Promise<Result<string[]>> {
  return safeAction(async () => {
    const usersRoot = getUsersRootDir();
    let entries: Dirent[] = [];
    try {
      entries = await fs.readdir(usersRoot, { withFileTypes: true });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") return [];
      throw error;
    }

    const users = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => normalizeEmail(entry.name))
      .filter((email) => email.endsWith(ALLOWED_EMAIL_SUFFIX))
      .sort((left, right) => left.localeCompare(right));
    logger.info({
      event: "admin.integrity.users.list",
      count: users.length,
    });
    return users;
  }, { context: "admin.integrity.listUsers" });
}

export async function checkUserIntegrity(userEmail: string): Promise<Result<IntegrityReport>> {
  return safeAction(
    () => checkUserIntegrityInternal(userEmail),
    { context: "admin.integrity.checkUserIntegrity" }
  );
}

export async function checkAllUsersIntegrity(): Promise<Result<IntegritySummary[]>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const usersResult = await listUsers();
    if (!usersResult.ok) {
      throw usersResult.error;
    }

    const summaries = new Array<IntegritySummary>();
    for (const userEmail of usersResult.data) {
      const reportResult = await checkUserIntegrity(userEmail);
      if (!reportResult.ok) {
        summaries.push({
          userEmail,
          totalIssues: 1,
          infoCount: 0,
          warnCount: 0,
          errorCount: 1,
          fixableCount: 0,
          checkFailed: true,
          failureMessage: reportResult.error.message,
        });
        continue;
      }

      summaries.push(toSummary(reportResult.data));
    }

    const sorted = summaries.sort((left, right) => {
      if (left.checkFailed !== right.checkFailed) return left.checkFailed ? -1 : 1;
      if (left.errorCount !== right.errorCount) return right.errorCount - left.errorCount;
      if (left.warnCount !== right.warnCount) return right.warnCount - left.warnCount;
      return left.userEmail.localeCompare(right.userEmail);
    });
    logger.info({
      event: "admin.integrity.all-users.check",
      count: sorted.length,
      durationMs: Date.now() - startedAt,
    });
    return sorted;
  }, { context: "admin.integrity.checkAllUsersIntegrity" });
}

export async function repairUserCategoryStore(
  userEmail: string,
  category: CategoryKey,
  options?: { backup?: boolean }
): Promise<Result<RepairResult>> {
  return safeAction(async () => {
    const normalizedUserEmail = normalizeEmail(userEmail);
    if (!normalizedUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid user email." });
    }
    if (!isCategoryKey(category)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid category." });
    }
    return withUserDataLock(normalizedUserEmail, async () =>
      repairCategoryStoreInternal(normalizedUserEmail, category, options)
    );
  }, { context: `admin.integrity.repairUserCategoryStore.${category}` });
}

export async function rebuildUserIndex(userEmail: string): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedUserEmail = normalizeEmail(userEmail);
    if (!normalizedUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid user email." });
    }
    return withUserDataLock(normalizedUserEmail, async () => {
      const rebuiltFromStore = await rebuildUserIndexFromStore(normalizedUserEmail);
      if (rebuiltFromStore.ok) {
        logger.info({
          event: "admin.integrity.index.rebuild.from-store",
          userEmail: normalizedUserEmail,
        });
        return rebuiltFromStore.data;
      }

      const rebuiltFromWal = await rebuildUserIndexFromWal(normalizedUserEmail);
      if (rebuiltFromWal.ok) {
        logger.warn({
          event: "admin.integrity.index.rebuild.from-wal",
          userEmail: normalizedUserEmail,
        });
        return rebuiltFromWal.data;
      }

      throw rebuiltFromStore.error;
    });
  }, { context: "admin.integrity.rebuildUserIndex" });
}

export async function migrateUserData(userEmail: string): Promise<Result<MigrationResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const normalizedUserEmail = normalizeEmail(userEmail);
    if (!normalizedUserEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid user email." });
    }
    return withUserDataLock(normalizedUserEmail, async () => {
      const categories = new Array<MigrationResult["categories"][number]>();
      const backupsCreated = new Array<string>();
      const filesTouched = new Array<string>();

      for (const category of CATEGORY_KEYS) {
        const repaired = await repairCategoryStoreInternal(normalizedUserEmail, category, {
          backup: true,
        });
        categories.push({
          category,
          fixedIssues: repaired.fixedIssues,
          filesTouched: repaired.filesTouched,
        });
        backupsCreated.push(...repaired.backupsCreated);
        filesTouched.push(...repaired.filesTouched);
      }

      const indexPath = path.join(getUserStoreDir(normalizedUserEmail), INDEX_FILE_NAME);
      let indexMigrated = false;
      try {
        const rawIndexText = await fs.readFile(indexPath, "utf8");
        const parsedIndex = rawIndexText.trim() ? (JSON.parse(rawIndexText) as unknown) : null;
        const migratedIndex = migrateUserIndex(parsedIndex);
        if (migratedIndex.ok) {
          const changed = JSON.stringify(parsedIndex) !== JSON.stringify(migratedIndex.data);
          if (changed) {
            const backupPath = await createBackup(indexPath);
            if (backupPath) backupsCreated.push(backupPath);
            await atomicWriteTextFile(indexPath, JSON.stringify(migratedIndex.data, null, 2));
            filesTouched.push(indexPath);
            indexMigrated = true;
          }
        }
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (code !== "ENOENT") {
          throw error;
        }
      }

      const result = {
        userEmail: normalizedUserEmail,
        categories,
        indexMigrated,
        backupsCreated,
        filesTouched,
      };
      logger.info({
        event: "admin.integrity.migrate-user",
        userEmail: normalizedUserEmail,
        count: result.filesTouched.length,
        backups: result.backupsCreated.length,
        durationMs: Date.now() - startedAt,
      });
      return result;
    });
  }, { context: "admin.integrity.migrateUserData" });
}
