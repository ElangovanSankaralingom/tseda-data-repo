import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import { type WalEvent } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  migrateCategoryStore,
  migrateEntry,
  migrateUserIndex,
  migrateWalEvent,
} from "@/lib/migrations";
import {
  ENTRY_STATUSES,
  isEntryStatus,
  type Entry,
} from "@/lib/types/entry";
import { getUserCategoryStoreFile, getUserStoreDir } from "@/lib/userStore";
import { logger } from "@/lib/logger";
import {
  ATTACHMENT_KEYS,
  INDEX_FILE_NAME,
  WAL_FILE_NAME,
  compareTime,
  emptyCategoryCounts,
  emptyStatusCounts,
  hasPathTraversal,
  isRecord,
  isStoreV2,
  isUploadedFileLike,
  normalizeId,
  toISO,
  toIssue,
  type CategoryDerivedStats,
  type CategoryIntegrityReport,
  type CategoryRawRead,
  type IndexIntegrityReport,
  type IntegrityIssue,
  type IntegrityReport,
  type IntegritySummary,
  type WalIntegrityReport,
} from "./integrityTypes";

// ---------------------------------------------------------------------------
// collectAttachmentSanityIssues
// ---------------------------------------------------------------------------

export function collectAttachmentSanityIssues(
  entry: Entry,
  category: CategoryKey,
  entryId: string
): IntegrityIssue[] {
  const issues = new Array<IntegrityIssue>();
  const root = entry as Record<string, unknown>;

  const attachments = root.attachments;
  if (attachments !== undefined && !Array.isArray(attachments)) {
    issues.push(
      toIssue({
        code: "ATTACHMENTS_NOT_ARRAY",
        severity: "warn",
        message: `Entry ${entryId} has non-array attachments.`,
        category,
        entryId,
        fixAvailable: true,
      })
    );
  }

  for (const key of ATTACHMENT_KEYS) {
    const value = root[key];
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isUploadedFileLike(item)) {
          issues.push(
            toIssue({
              code: "ATTACHMENT_ITEM_INVALID",
              severity: "warn",
              message: `Entry ${entryId} has invalid attachment item in ${key}.`,
              category,
              entryId,
              fixAvailable: true,
            })
          );
          continue;
        }
        if (hasPathTraversal(item.storedPath)) {
          issues.push(
            toIssue({
              code: "ATTACHMENT_PATH_INVALID",
              severity: "warn",
              message: `Entry ${entryId} contains path-traversal attachment path in ${key}.`,
              category,
              entryId,
              fixAvailable: true,
            })
          );
        }
      }
      continue;
    }

    if (isRecord(value)) {
      if (!isUploadedFileLike(value)) {
        issues.push(
          toIssue({
            code: "ATTACHMENT_OBJECT_INVALID",
            severity: "warn",
            message: `Entry ${entryId} has invalid attachment metadata in ${key}.`,
            category,
            entryId,
            fixAvailable: true,
          })
        );
      } else if (hasPathTraversal(value.storedPath)) {
        issues.push(
          toIssue({
            code: "ATTACHMENT_PATH_INVALID",
            severity: "warn",
            message: `Entry ${entryId} contains path-traversal attachment path in ${key}.`,
            category,
            entryId,
            fixAvailable: true,
          })
        );
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// readJsonFileDetailed
// ---------------------------------------------------------------------------

export async function readJsonFileDetailed(filePath: string): Promise<CategoryRawRead> {
  try {
    const rawText = await fs.readFile(filePath, "utf8");
    try {
      return {
        filePath,
        exists: true,
        parseError: false,
        parsed: rawText.trim() ? (JSON.parse(rawText) as unknown) : null,
      };
    } catch {
      return {
        filePath,
        exists: true,
        parseError: true,
        parsed: null,
      };
    }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      return {
        filePath,
        exists: false,
        parseError: false,
        parsed: null,
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// analyzeRawV2Structure
// ---------------------------------------------------------------------------

export function analyzeRawV2Structure(
  raw: { byId: Record<string, unknown>; order: unknown[] },
  category: CategoryKey
) {
  const issues = new Array<IntegrityIssue>();
  const byIdKeys = new Set(
    Object.keys(raw.byId)
      .map((value) => normalizeId(value))
      .filter(Boolean)
  );
  const seenOrder = new Set<string>();
  const duplicateOrderIds = new Set<string>();
  const orphanOrderIds = new Set<string>();

  for (const orderValue of raw.order) {
    const id = normalizeId(orderValue);
    if (!id) continue;
    if (seenOrder.has(id)) {
      duplicateOrderIds.add(id);
      continue;
    }
    seenOrder.add(id);
    if (!byIdKeys.has(id)) {
      orphanOrderIds.add(id);
    }
  }

  const missingOrderIds = [...byIdKeys].filter((id) => !seenOrder.has(id));

  if (duplicateOrderIds.size > 0) {
    issues.push(
      toIssue({
        code: "ORDER_DUPLICATE_IDS",
        severity: "warn",
        message: `Category ${category} order has duplicate IDs (${duplicateOrderIds.size}).`,
        category,
        fixAvailable: true,
      })
    );
  }

  if (orphanOrderIds.size > 0) {
    issues.push(
      toIssue({
        code: "ORDER_ORPHAN_IDS",
        severity: "warn",
        message: `Category ${category} order has IDs missing from byId (${orphanOrderIds.size}).`,
        category,
        fixAvailable: true,
      })
    );
  }

  if (missingOrderIds.length > 0) {
    issues.push(
      toIssue({
        code: "ORDER_MISSING_IDS",
        severity: "warn",
        message: `Category ${category} byId has IDs missing from order (${missingOrderIds.length}).`,
        category,
        fixAvailable: true,
      })
    );
  }

  return issues;
}

// ---------------------------------------------------------------------------
// buildCategoryStats
// ---------------------------------------------------------------------------

export function buildCategoryStats(entries: Entry[]): CategoryDerivedStats {
  let pending = 0;
  let approved = 0;
  let lastEntryAtISO: string | null = null;

  for (const entry of entries) {
    const status = normalizeEntryStatus(entry as EntryStateLike);
    if (status === "EDIT_REQUESTED") pending += 1;
    if (status === "GENERATED" || status === "EDIT_GRANTED") approved += 1;

    const candidate = toISO(entry.updatedAt) ?? toISO(entry.createdAt);
    if (!candidate) continue;
    if (!lastEntryAtISO || compareTime(candidate, lastEntryAtISO) > 0) {
      lastEntryAtISO = candidate;
    }
  }

  return {
    entries,
    total: entries.length,
    pending,
    approved,
    lastEntryAtISO,
  };
}

// ---------------------------------------------------------------------------
// checkCategoryIntegrity
// ---------------------------------------------------------------------------

export async function checkCategoryIntegrity(
  userEmail: string,
  category: CategoryKey
): Promise<{ report: CategoryIntegrityReport; stats: CategoryDerivedStats }> {
  const filePath = getUserCategoryStoreFile(userEmail, CATEGORY_STORE_FILES[category]);
  const read = await readJsonFileDetailed(filePath);
  const issues = new Array<IntegrityIssue>();

  if (!read.exists) {
    issues.push(
      toIssue({
        code: "CATEGORY_FILE_MISSING",
        severity: "info",
        message: `Category store file is missing for ${category}.`,
        category,
        fixAvailable: true,
      })
    );
  }

  if (read.parseError) {
    issues.push(
      toIssue({
        code: "CATEGORY_JSON_INVALID",
        severity: "error",
        message: `Category store JSON is invalid for ${category}.`,
        category,
        fixAvailable: true,
      })
    );
  }

  const raw = read.parsed;
  const legacyFormat = read.parseError ? true : !isStoreV2(raw);
  if (legacyFormat) {
    issues.push(
      toIssue({
        code: "CATEGORY_LEGACY_FORMAT",
        severity: "warn",
        message: `Category ${category} is not in V2 byId/order format.`,
        category,
        fixAvailable: true,
      })
    );
  }

  if (isStoreV2(raw)) {
    issues.push(...analyzeRawV2Structure(raw, category));
  }

  const migratedStoreResult = migrateCategoryStore(read.parseError ? [] : raw);
  if (!migratedStoreResult.ok) {
    issues.push(
      toIssue({
        code: "CATEGORY_MIGRATION_FAILED",
        severity: "error",
        message: `Category ${category} could not be migrated for validation.`,
        category,
        fixAvailable: true,
      })
    );
    return {
      report: {
        category,
        filePath,
        exists: read.exists,
        legacyFormat,
        totalEntries: 0,
        issues,
      },
      stats: buildCategoryStats([]),
    };
  }

  const store = migratedStoreResult.data;
  const entries = new Array<Entry>();
  for (const id of store.order) {
    const key = normalizeId(id);
    if (!key) continue;
    const rawEntry = store.byId[key];
    const migratedEntry = migrateEntry(rawEntry);
    if (!migratedEntry.ok) {
      issues.push(
        toIssue({
          code: "ENTRY_INVALID",
          severity: "error",
          message: `Entry ${key} in ${category} is invalid and cannot be normalized.`,
          category,
          entryId: key,
          fixAvailable: true,
        })
      );
      continue;
    }

    const entry = { ...migratedEntry.data, id: key } as Entry;
    entries.push(entry);

    if (!toISO(entry.createdAt) || !toISO(entry.updatedAt)) {
      issues.push(
        toIssue({
          code: "ENTRY_TIMESTAMP_INVALID",
          severity: "warn",
          message: `Entry ${key} has invalid createdAt/updatedAt timestamps.`,
          category,
          entryId: key,
          fixAvailable: true,
        })
      );
    }

    if (normalizeId(entry.id) !== key) {
      issues.push(
        toIssue({
          code: "ENTRY_ID_MISMATCH",
          severity: "warn",
          message: `Entry id mismatch for key ${key}.`,
          category,
          entryId: key,
          fixAvailable: true,
        })
      );
    }

    if (String(entry.category ?? "").trim().toLowerCase() !== category) {
      issues.push(
        toIssue({
          code: "ENTRY_CATEGORY_INVALID",
          severity: "warn",
          message: `Entry ${key} is missing/invalid category field.`,
          category,
          entryId: key,
          fixAvailable: true,
        })
      );
    }

    if (normalizeEmail(String(entry.ownerEmail ?? "")) !== userEmail) {
      issues.push(
        toIssue({
          code: "ENTRY_OWNER_INVALID",
          severity: "warn",
          message: `Entry ${key} is missing/invalid ownerEmail field.`,
          category,
          entryId: key,
          fixAvailable: true,
        })
      );
    }

    const statusValue = String(entry.confirmationStatus ?? "").trim();
    if (!isEntryStatus(statusValue)) {
      issues.push(
        toIssue({
          code: "ENTRY_STATUS_INVALID",
          severity: "warn",
          message: `Entry ${key} has non-canonical confirmation status.`,
          category,
          entryId: key,
          fixAvailable: true,
        })
      );
    }

    issues.push(...collectAttachmentSanityIssues(entry, category, key));
  }

  const stats = buildCategoryStats(entries);
  return {
    report: {
      category,
      filePath,
      exists: read.exists,
      legacyFormat,
      totalEntries: stats.total,
      issues,
    },
    stats,
  };
}

// ---------------------------------------------------------------------------
// deriveExpectedStats
// ---------------------------------------------------------------------------

export function deriveExpectedStats(
  categoryStats: Record<CategoryKey, CategoryDerivedStats>
) {
  const totalsByCategory = emptyCategoryCounts();
  const pendingByCategory = emptyCategoryCounts();
  const approvedByCategory = emptyCategoryCounts();
  const lastEntryAtByCategory = CATEGORY_KEYS.reduce<Record<CategoryKey, string | null>>(
    (next, category) => {
      next[category] = null;
      return next;
    },
    {} as Record<CategoryKey, string | null>
  );
  const countsByStatus = emptyStatusCounts();

  for (const category of CATEGORY_KEYS) {
    const stats = categoryStats[category];
    totalsByCategory[category] = stats.total;
    pendingByCategory[category] = stats.pending;
    approvedByCategory[category] = stats.approved;
    lastEntryAtByCategory[category] = stats.lastEntryAtISO;
    for (const entry of stats.entries) {
      const status = normalizeEntryStatus(entry as EntryStateLike);
      countsByStatus[status] += 1;
    }
  }

  return {
    totalsByCategory,
    pendingByCategory,
    approvedByCategory,
    lastEntryAtByCategory,
    countsByStatus,
  };
}

// ---------------------------------------------------------------------------
// checkIndexIntegrity
// ---------------------------------------------------------------------------

export async function checkIndexIntegrity(
  userEmail: string,
  derived: ReturnType<typeof deriveExpectedStats>
): Promise<IndexIntegrityReport> {
  const filePath = path.join(getUserStoreDir(userEmail), INDEX_FILE_NAME);
  const issues = new Array<IntegrityIssue>();

  let exists = true;
  let raw: unknown = null;
  try {
    const rawText = await fs.readFile(filePath, "utf8");
    raw = rawText.trim() ? (JSON.parse(rawText) as unknown) : null;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      exists = false;
      issues.push(
        toIssue({
          code: "INDEX_FILE_MISSING",
          severity: "warn",
          message: "index.json is missing.",
          fixAvailable: true,
        })
      );
      return {
        filePath,
        exists,
        issues,
      };
    }
    issues.push(
      toIssue({
        code: "INDEX_READ_FAILED",
        severity: "error",
        message: "Failed to read index.json.",
        fixAvailable: true,
      })
    );
    return {
      filePath,
      exists,
      issues,
    };
  }

  const migratedIndex = migrateUserIndex(raw);
  if (!migratedIndex.ok) {
    issues.push(
      toIssue({
        code: "INDEX_INVALID",
        severity: "error",
        message: "index.json is invalid and cannot be migrated.",
        fixAvailable: true,
      })
    );
    return {
      filePath,
      exists,
      issues,
    };
  }

  const index = migratedIndex.data;
  if (normalizeEmail(String(index.userEmail ?? "")) !== userEmail) {
    issues.push(
      toIssue({
        code: "INDEX_USER_MISMATCH",
        severity: "warn",
        message: "index.json userEmail does not match folder user.",
        fixAvailable: true,
      })
    );
  }

  for (const category of CATEGORY_KEYS) {
    const derivedTotal = derived.totalsByCategory[category];
    const derivedPending = derived.pendingByCategory[category];
    const derivedApproved = derived.approvedByCategory[category];
    const derivedLast = derived.lastEntryAtByCategory[category];

    const indexTotal = Number(index.totalsByCategory[category] ?? 0);
    const indexPending = Number(index.pendingByCategory[category] ?? 0);
    const indexApproved = Number(index.approvedByCategory[category] ?? 0);
    const indexLast = toISO(index.lastEntryAtByCategory[category]);

    if (indexTotal !== derivedTotal) {
      issues.push(
        toIssue({
          code: "INDEX_TOTAL_MISMATCH",
          severity: "warn",
          message: `index totalsByCategory mismatch for ${category} (${indexTotal} != ${derivedTotal}).`,
          category,
          fixAvailable: true,
        })
      );
    }
    if (indexPending !== derivedPending) {
      issues.push(
        toIssue({
          code: "INDEX_PENDING_MISMATCH",
          severity: "warn",
          message: `index pendingByCategory mismatch for ${category} (${indexPending} != ${derivedPending}).`,
          category,
          fixAvailable: true,
        })
      );
    }
    if (indexApproved !== derivedApproved) {
      issues.push(
        toIssue({
          code: "INDEX_APPROVED_MISMATCH",
          severity: "warn",
          message: `index approvedByCategory mismatch for ${category} (${indexApproved} != ${derivedApproved}).`,
          category,
          fixAvailable: true,
        })
      );
    }
    if ((indexLast ?? null) !== (derivedLast ?? null)) {
      issues.push(
        toIssue({
          code: "INDEX_LAST_ENTRY_MISMATCH",
          severity: "info",
          message: `index lastEntryAtByCategory mismatch for ${category}.`,
          category,
          fixAvailable: true,
        })
      );
    }
  }

  for (const status of ENTRY_STATUSES) {
    const indexCount = Number(index.countsByStatus[status] ?? 0);
    const derivedCount = derived.countsByStatus[status];
    if (indexCount !== derivedCount) {
      issues.push(
        toIssue({
          code: "INDEX_STATUS_COUNT_MISMATCH",
          severity: "warn",
          message: `index countsByStatus mismatch for ${status} (${indexCount} != ${derivedCount}).`,
          fixAvailable: true,
        })
      );
    }
  }

  return {
    filePath,
    exists,
    issues,
  };
}

// ---------------------------------------------------------------------------
// compareWalEventTime
// ---------------------------------------------------------------------------

export function compareWalEventTime(left: WalEvent, right: WalEvent) {
  const leftTime = Date.parse(left.ts);
  const rightTime = Date.parse(right.ts);
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return -1;
  if (Number.isNaN(rightTime)) return 1;
  return leftTime - rightTime;
}

// ---------------------------------------------------------------------------
// checkWalIntegrity
// ---------------------------------------------------------------------------

export async function checkWalIntegrity(userEmail: string): Promise<WalIntegrityReport> {
  const filePath = path.join(getUserStoreDir(userEmail), WAL_FILE_NAME);
  const issues = new Array<IntegrityIssue>();

  let exists = true;
  let rawText = "";
  try {
    rawText = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      exists = false;
      issues.push(
        toIssue({
          code: "WAL_FILE_MISSING",
          severity: "info",
          message: "events.log is missing.",
          fixAvailable: false,
        })
      );
      return {
        filePath,
        exists,
        validLines: 0,
        invalidLines: 0,
        outOfOrderLines: 0,
        issues,
      };
    }
    issues.push(
      toIssue({
        code: "WAL_READ_FAILED",
        severity: "error",
        message: "Failed to read events.log.",
        fixAvailable: false,
      })
    );
    return {
      filePath,
      exists,
      validLines: 0,
      invalidLines: 0,
      outOfOrderLines: 0,
      issues,
    };
  }

  let invalidLines = 0;
  const validEvents = new Array<WalEvent>();
  for (const line of rawText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const migrated = migrateWalEvent(parsed);
      if (!migrated.ok) {
        invalidLines += 1;
        continue;
      }
      validEvents.push(migrated.data);
    } catch {
      invalidLines += 1;
    }
  }

  if (invalidLines > 0) {
    issues.push(
      toIssue({
        code: "WAL_INVALID_LINES",
        severity: "warn",
        message: `events.log contains ${invalidLines} invalid lines.`,
        fixAvailable: false,
      })
    );
  }

  const sorted = validEvents.slice().sort(compareWalEventTime);
  let outOfOrderLines = 0;
  for (let index = 0; index < validEvents.length; index += 1) {
    const original = validEvents[index];
    const reordered = sorted[index];
    if (!original || !reordered) continue;
    if (original.ts !== reordered.ts) {
      outOfOrderLines += 1;
    }
  }

  if (outOfOrderLines > 0) {
    issues.push(
      toIssue({
        code: "WAL_OUT_OF_ORDER",
        severity: "info",
        message: `events.log has ${outOfOrderLines} out-of-order timestamps.`,
        fixAvailable: false,
      })
    );
  }

  return {
    filePath,
    exists,
    validLines: validEvents.length,
    invalidLines,
    outOfOrderLines,
    issues,
  };
}

// ---------------------------------------------------------------------------
// checkUserIntegrityInternal
// ---------------------------------------------------------------------------

export async function checkUserIntegrityInternal(userEmail: string): Promise<IntegrityReport> {
  const normalizedUserEmail = normalizeEmail(userEmail);
  if (!normalizedUserEmail.endsWith("@tce.edu")) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid user email for integrity checks.",
    });
  }
  const startedAt = Date.now();
  logger.debug({
    event: "admin.integrity.user.check.start",
    userEmail: normalizedUserEmail,
  });

  const perCategory = {} as Record<CategoryKey, CategoryIntegrityReport>;
  const categoryStats = {} as Record<CategoryKey, CategoryDerivedStats>;
  const allIssues = new Array<IntegrityIssue>();

  for (const category of CATEGORY_KEYS) {
    const { report, stats } = await checkCategoryIntegrity(normalizedUserEmail, category);
    perCategory[category] = report;
    categoryStats[category] = stats;
    allIssues.push(...report.issues);
  }

  const derived = deriveExpectedStats(categoryStats);
  const indexReport = await checkIndexIntegrity(normalizedUserEmail, derived);
  const walReport = await checkWalIntegrity(normalizedUserEmail);
  allIssues.push(...indexReport.issues, ...walReport.issues);

  const report = {
    userEmail: normalizedUserEmail,
    checkedAtISO: new Date().toISOString(),
    perCategory,
    indexReport,
    walReport,
    issues: allIssues,
  };
  logger.info({
    event: "admin.integrity.user.check.end",
    userEmail: normalizedUserEmail,
    count: report.issues.length,
    durationMs: Date.now() - startedAt,
  });
  return report;
}

// ---------------------------------------------------------------------------
// toSummary
// ---------------------------------------------------------------------------

export function toSummary(report: IntegrityReport): IntegritySummary {
  let infoCount = 0;
  let warnCount = 0;
  let errorCount = 0;
  let fixableCount = 0;

  for (const issue of report.issues) {
    if (issue.severity === "info") infoCount += 1;
    if (issue.severity === "warn") warnCount += 1;
    if (issue.severity === "error") errorCount += 1;
    if (issue.fixAvailable) fixableCount += 1;
  }

  return {
    userEmail: report.userEmail,
    totalIssues: report.issues.length,
    infoCount,
    warnCount,
    errorCount,
    fixableCount,
    checkFailed: false,
  };
}
