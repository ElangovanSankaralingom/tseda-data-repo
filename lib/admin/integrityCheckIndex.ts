import "server-only";

/**
 * Index-level integrity checks: deriveExpectedStats and checkIndexIntegrity.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { migrateUserIndex } from "@/lib/migrations";
import { ENTRY_STATUSES } from "@/lib/types/entry";
import { getUserStoreDir } from "@/lib/userStore";
import {
  INDEX_FILE_NAME,
  emptyCategoryCounts,
  emptyStatusCounts,
  toISO,
  toIssue,
  type CategoryDerivedStats,
  type IndexIntegrityReport,
  type IntegrityIssue,
} from "./integrityTypes";

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
