import "server-only";

/**
 * Per-category integrity checks: file reading, V2 structure validation,
 * entry-level field checks, and attachment sanity.
 */
import fs from "node:fs/promises";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import {
  migrateCategoryStore,
  migrateEntry,
} from "@/lib/migrations";
import {
  isEntryStatus,
  type Entry,
} from "@/lib/types/entry";
import { getUserCategoryStoreFile } from "@/lib/userStore";
import {
  ATTACHMENT_KEYS,
  compareTime,
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
  type IntegrityIssue,
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
