import "server-only";

import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { CATEGORY_KEYS, isCategoryKey } from "@/lib/categories";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import {
  rebuildUserIndex as rebuildUserIndexFromStore,
  type UserIndex,
} from "@/lib/data/indexStore";
import { rebuildUserIndexFromWal } from "@/lib/data/recovery";
import { type WalEvent } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entryStateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  CATEGORY_STORE_SCHEMA_VERSION,
  migrateCategoryStore,
  migrateEntry,
  migrateUserIndex,
  migrateWalEvent,
} from "@/lib/migrations";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import type { Entry, EntryStatus, UploadedFile } from "@/lib/types/entry";
import { getUserCategoryStoreFile, getUsersRootDir, getUserStoreDir } from "@/lib/userStore";
import { logger, withTimer } from "@/lib/logger";

type IssueSeverity = "info" | "warn" | "error";

type CategoryDerivedStats = {
  entries: Entry[];
  total: number;
  pending: number;
  approved: number;
  lastEntryAtISO: string | null;
};

export type IntegrityIssue = {
  code: string;
  severity: IssueSeverity;
  message: string;
  category?: CategoryKey;
  entryId?: string;
  fixAvailable: boolean;
};

export type CategoryIntegrityReport = {
  category: CategoryKey;
  filePath: string;
  exists: boolean;
  legacyFormat: boolean;
  totalEntries: number;
  issues: IntegrityIssue[];
};

export type IndexIntegrityReport = {
  filePath: string;
  exists: boolean;
  issues: IntegrityIssue[];
};

export type WalIntegrityReport = {
  filePath: string;
  exists: boolean;
  validLines: number;
  invalidLines: number;
  outOfOrderLines: number;
  issues: IntegrityIssue[];
};

export type IntegrityReport = {
  userEmail: string;
  checkedAtISO: string;
  perCategory: Record<CategoryKey, CategoryIntegrityReport>;
  indexReport: IndexIntegrityReport;
  walReport: WalIntegrityReport;
  issues: IntegrityIssue[];
};

export type IntegritySummary = {
  userEmail: string;
  totalIssues: number;
  infoCount: number;
  warnCount: number;
  errorCount: number;
  fixableCount: number;
  checkFailed: boolean;
  failureMessage?: string;
};

export type RepairResult = {
  userEmail: string;
  category: CategoryKey;
  fixedIssues: string[];
  backupsCreated: string[];
  filesTouched: string[];
};

export type MigrationResult = {
  userEmail: string;
  categories: Array<{
    category: CategoryKey;
    fixedIssues: string[];
    filesTouched: string[];
  }>;
  indexMigrated: boolean;
  backupsCreated: string[];
  filesTouched: string[];
};

type CategoryRawRead = {
  filePath: string;
  exists: boolean;
  parseError: boolean;
  parsed: unknown | null;
};

type EntryStatusCounts = Record<EntryStatus, number>;

const ENTRY_STATUS_KEYS: readonly EntryStatus[] = [
  "DRAFT",
  "PENDING_CONFIRMATION",
  "APPROVED",
  "REJECTED",
];

const INDEX_FILE_NAME = "index.json";
const WAL_FILE_NAME = "events.log";
const ATTACHMENT_KEYS = [
  "attachments",
  "permissionLetter",
  "completionCertificate",
  "travelPlan",
  "brochure",
  "attendance",
  "speakerProfile",
  "organiserProfile",
  "geotaggedPhotos",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStoreV2(value: unknown): value is { version: number; byId: Record<string, unknown>; order: unknown[] } {
  if (!isRecord(value)) return false;
  if (Number(value.version) !== CATEGORY_STORE_SCHEMA_VERSION) return false;
  if (!isRecord(value.byId)) return false;
  if (!Array.isArray(value.order)) return false;
  return true;
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function toIssue(input: Omit<IntegrityIssue, "fixAvailable"> & { fixAvailable?: boolean }): IntegrityIssue {
  return {
    ...input,
    fixAvailable: input.fixAvailable ?? false,
  };
}

function toISO(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : text;
}

function compareTime(left: string | null, right: string | null) {
  const leftTime = left ? Date.parse(left) : Number.NEGATIVE_INFINITY;
  const rightTime = right ? Date.parse(right) : Number.NEGATIVE_INFINITY;
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return -1;
  if (Number.isNaN(rightTime)) return 1;
  return leftTime - rightTime;
}

function emptyStatusCounts(): EntryStatusCounts {
  return {
    DRAFT: 0,
    PENDING_CONFIRMATION: 0,
    APPROVED: 0,
    REJECTED: 0,
  };
}

function emptyCategoryCounts() {
  return CATEGORY_KEYS.reduce<Record<CategoryKey, number>>((next, category) => {
    next[category] = 0;
    return next;
  }, {} as Record<CategoryKey, number>);
}

function isUploadedFileLike(value: unknown): value is UploadedFile {
  if (!isRecord(value)) return false;
  const fileName = String(value.fileName ?? "").trim();
  const mimeType = String(value.mimeType ?? "").trim();
  const url = String(value.url ?? "").trim();
  const storedPath = String(value.storedPath ?? "").trim();
  const uploadedAt = toISO(value.uploadedAt);
  const size = value.size;
  return !!(
    fileName &&
    mimeType &&
    url &&
    storedPath &&
    uploadedAt &&
    typeof size === "number" &&
    Number.isFinite(size) &&
    size >= 0
  );
}

function hasPathTraversal(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");
  return !normalized || normalized.includes("../") || normalized.startsWith("..");
}

function collectAttachmentSanityIssues(entry: Entry, category: CategoryKey, entryId: string): IntegrityIssue[] {
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

async function readJsonFileDetailed(filePath: string): Promise<CategoryRawRead> {
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

function analyzeRawV2Structure(
  raw: { byId: Record<string, unknown>; order: unknown[] },
  category: CategoryKey
) {
  const issues = new Array<IntegrityIssue>();
  const byIdKeys = new Set(Object.keys(raw.byId).map((value) => normalizeId(value)).filter(Boolean));
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

function buildCategoryStats(entries: Entry[]): CategoryDerivedStats {
  let pending = 0;
  let approved = 0;
  let lastEntryAtISO: string | null = null;

  for (const entry of entries) {
    const status = normalizeEntryStatus(entry as EntryStateLike);
    if (status === "PENDING_CONFIRMATION") pending += 1;
    if (status === "APPROVED") approved += 1;

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

async function checkCategoryIntegrity(
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
  const legacyFormat = read.parseError
    ? true
    : !isStoreV2(raw);
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
    if (!ENTRY_STATUS_KEYS.includes(statusValue as EntryStatus)) {
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

function deriveExpectedStats(
  categoryStats: Record<CategoryKey, CategoryDerivedStats>
) {
  const totalsByCategory = emptyCategoryCounts();
  const pendingByCategory = emptyCategoryCounts();
  const approvedByCategory = emptyCategoryCounts();
  const lastEntryAtByCategory = CATEGORY_KEYS.reduce<Record<CategoryKey, string | null>>((next, category) => {
    next[category] = null;
    return next;
  }, {} as Record<CategoryKey, string | null>);
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

async function checkIndexIntegrity(
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

  for (const status of ENTRY_STATUS_KEYS) {
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

function compareWalEventTime(left: WalEvent, right: WalEvent) {
  const leftTime = Date.parse(left.ts);
  const rightTime = Date.parse(right.ts);
  if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) return 0;
  if (Number.isNaN(leftTime)) return -1;
  if (Number.isNaN(rightTime)) return 1;
  return leftTime - rightTime;
}

async function checkWalIntegrity(userEmail: string): Promise<WalIntegrityReport> {
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

async function checkUserIntegrityInternal(userEmail: string): Promise<IntegrityReport> {
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

function toSummary(report: IntegrityReport): IntegritySummary {
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

async function createBackup(filePath: string): Promise<string | null> {
  try {
    await fs.access(filePath);
  } catch {
    return null;
  }

  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const backupPath = `${filePath}.bak.${stamp}`;
  await fs.copyFile(filePath, backupPath);
  return backupPath;
}

function normalizeEntryForRepair(
  value: unknown,
  key: string,
  category: CategoryKey,
  userEmail: string,
  nowISO: string
): { entry: Entry | null; fixed: string[] } {
  const fixed = new Array<string>();
  const migrated = migrateEntry(value);
  if (!migrated.ok) {
    fixed.push(`Removed invalid entry ${key}.`);
    return { entry: null, fixed };
  }

  const entry = { ...migrated.data } as Entry;
  entry.id = key;
  if (String(entry.category ?? "").trim().toLowerCase() !== category) {
    entry.category = category;
    fixed.push(`Entry ${key}: normalized category.`);
  }

  if (normalizeEmail(String(entry.ownerEmail ?? "")) !== userEmail) {
    entry.ownerEmail = userEmail;
    fixed.push(`Entry ${key}: normalized ownerEmail.`);
  }

  const canonicalStatus = normalizeEntryStatus(entry as EntryStateLike);
  if (entry.confirmationStatus !== canonicalStatus) {
    entry.confirmationStatus = canonicalStatus;
    fixed.push(`Entry ${key}: normalized confirmationStatus.`);
  }

  if (!toISO(entry.createdAt)) {
    entry.createdAt = nowISO;
    fixed.push(`Entry ${key}: restored createdAt.`);
  }
  if (!toISO(entry.updatedAt)) {
    entry.updatedAt = String(entry.createdAt ?? nowISO);
    fixed.push(`Entry ${key}: restored updatedAt.`);
  }

  if (!Array.isArray(entry.attachments)) {
    entry.attachments = [];
    fixed.push(`Entry ${key}: normalized attachments to array.`);
  } else {
    const filtered = entry.attachments.filter((item) => isUploadedFileLike(item));
    if (filtered.length !== entry.attachments.length) {
      entry.attachments = filtered;
      fixed.push(`Entry ${key}: removed invalid attachments.`);
    }
  }

  return { entry, fixed };
}

async function repairCategoryStoreInternal(
  userEmail: string,
  category: CategoryKey,
  options?: { backup?: boolean }
): Promise<RepairResult> {
  return withTimer(
    "admin.integrity.repair.category",
    async () => {
      const normalizedUserEmail = normalizeEmail(userEmail);
      const nowISO = new Date().toISOString();
      const filePath = getUserCategoryStoreFile(normalizedUserEmail, CATEGORY_STORE_FILES[category]);
      const read = await readJsonFileDetailed(filePath);
      const raw = read.parseError ? [] : read.parsed;
      const migrated = migrateCategoryStore(raw);
      if (!migrated.ok) {
        throw migrated.error;
      }

      const store = migrated.data;
      const fixedIssues = new Array<string>();
      const backupsCreated = new Array<string>();
      const filesTouched = new Array<string>();

      const seen = new Set<string>();
      const nextOrder = new Array<string>();
      const duplicatesRemoved = new Set<string>();
      const orphansRemoved = new Set<string>();

      for (const rawId of store.order) {
        const id = normalizeId(rawId);
        if (!id) continue;
        if (!store.byId[id]) {
          orphansRemoved.add(id);
          continue;
        }
        if (seen.has(id)) {
          duplicatesRemoved.add(id);
          continue;
        }
        seen.add(id);
        nextOrder.push(id);
      }

      if (duplicatesRemoved.size > 0) {
        fixedIssues.push(`Removed duplicate IDs from order: ${[...duplicatesRemoved].join(", ")}.`);
      }
      if (orphansRemoved.size > 0) {
        fixedIssues.push(`Removed orphan IDs from order: ${[...orphansRemoved].join(", ")}.`);
      }

      const nextById: Record<string, Entry> = {};
      const removedInvalid = new Array<string>();
      for (const id of nextOrder) {
        const rawEntry = store.byId[id];
        const normalized = normalizeEntryForRepair(rawEntry, id, category, normalizedUserEmail, nowISO);
        fixedIssues.push(...normalized.fixed);
        if (!normalized.entry) {
          removedInvalid.push(id);
          continue;
        }
        nextById[id] = normalized.entry;
      }

      if (removedInvalid.length > 0) {
        fixedIssues.push(`Dropped invalid entries: ${removedInvalid.join(", ")}.`);
      }

      for (const rawKey of Object.keys(store.byId)) {
        const id = normalizeId(rawKey);
        if (!id) continue;
        if (nextById[id]) continue;

        const normalized = normalizeEntryForRepair(store.byId[id], id, category, normalizedUserEmail, nowISO);
        fixedIssues.push(...normalized.fixed);
        if (!normalized.entry) {
          continue;
        }
        nextById[id] = normalized.entry;
        nextOrder.push(id);
        fixedIssues.push(`Added missing order ID: ${id}.`);
      }

      const dedupedOrder = new Array<string>();
      const seenOrder = new Set<string>();
      for (const id of nextOrder) {
        if (!nextById[id]) continue;
        if (seenOrder.has(id)) continue;
        seenOrder.add(id);
        dedupedOrder.push(id);
      }

      const repairedStore = {
        version: CATEGORY_STORE_SCHEMA_VERSION,
        byId: nextById,
        order: dedupedOrder,
      };

      const previousComparable = read.exists && !read.parseError ? read.parsed : null;
      const changed = JSON.stringify(previousComparable) !== JSON.stringify(repairedStore);
      if (changed || !read.exists) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        if (options?.backup !== false && read.exists) {
          const backupPath = await createBackup(filePath);
          if (backupPath) {
            backupsCreated.push(backupPath);
          }
        }
        await fs.writeFile(filePath, JSON.stringify(repairedStore, null, 2), "utf8");
        filesTouched.push(filePath);
      }

      logger.info({
        event: "admin.integrity.repair.category.result",
        userEmail: normalizedUserEmail,
        category,
        count: fixedIssues.length,
        filesTouched: filesTouched.length,
      });

      return {
        userEmail: normalizedUserEmail,
        category,
        fixedIssues,
        backupsCreated,
        filesTouched,
      };
    },
    {
      userEmail: normalizeEmail(userEmail),
      category,
    }
  );
}

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
      .filter((email) => email.endsWith("@tce.edu"))
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
    if (!normalizedUserEmail.endsWith("@tce.edu")) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid user email." });
    }
    if (!isCategoryKey(category)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid category." });
    }
    return repairCategoryStoreInternal(normalizedUserEmail, category, options);
  }, { context: `admin.integrity.repairUserCategoryStore.${category}` });
}

export async function rebuildUserIndex(userEmail: string): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedUserEmail = normalizeEmail(userEmail);
    if (!normalizedUserEmail.endsWith("@tce.edu")) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid user email." });
    }

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
  }, { context: "admin.integrity.rebuildUserIndex" });
}

export async function migrateUserData(userEmail: string): Promise<Result<MigrationResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const normalizedUserEmail = normalizeEmail(userEmail);
    if (!normalizedUserEmail.endsWith("@tce.edu")) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid user email." });
    }

    const categories = new Array<MigrationResult["categories"][number]>();
    const backupsCreated = new Array<string>();
    const filesTouched = new Array<string>();

    for (const category of CATEGORY_KEYS) {
      const repaired = await repairCategoryStoreInternal(normalizedUserEmail, category, { backup: true });
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
          await fs.writeFile(indexPath, JSON.stringify(migratedIndex.data, null, 2), "utf8");
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
  }, { context: "admin.integrity.migrateUserData" });
}
