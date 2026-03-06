import "server-only";

import { unstable_cache } from "next/cache";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { CATEGORY_KEYS } from "@/lib/categories";
import { ensureUserIndex, type UserIndex } from "@/lib/data/indexStore";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entries/lifecycle";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail } from "@/lib/entryNavigation";
import { getDashboardTag } from "@/lib/dashboard/tags";
import { getStreakProgressSnapshot, toStreakSortAtISO } from "@/lib/streakProgress";
import type { Entry } from "@/lib/types/entry";

type DashboardEntry = Entry;

export type DashboardPendingRow = {
  id: string;
  categoryKey: CategoryKey;
  categoryLabel: string;
  tag: string;
  route: string;
  dueAtISO: string | null;
};

type CategoryDashboardSummary = {
  totalEntries: number;
  pendingConfirmationCount: number;
  approvedCount: number;
  streakActivatedCount: number;
  streakWinsCount: number;
};

export type DashboardSummary = {
  byCategory: Record<CategoryKey, CategoryDashboardSummary>;
  totals: {
    totalEntries: number;
    pendingConfirmationCount: number;
    approvedCount: number;
    streakActivatedCount: number;
    streakWinsCount: number;
  };
  streakActivatedRows: DashboardPendingRow[];
};

function emptyCategorySummary(): CategoryDashboardSummary {
  return {
    totalEntries: 0,
    pendingConfirmationCount: 0,
    approvedCount: 0,
    streakActivatedCount: 0,
    streakWinsCount: 0,
  };
}

function emptySummary(): DashboardSummary {
  const byCategory = CATEGORY_KEYS.reduce<Record<CategoryKey, CategoryDashboardSummary>>(
    (next, categoryKey) => {
      next[categoryKey] = emptyCategorySummary();
      return next;
    },
    {} as Record<CategoryKey, CategoryDashboardSummary>
  );

  return {
    byCategory,
    totals: {
      totalEntries: 0,
      pendingConfirmationCount: 0,
      approvedCount: 0,
      streakActivatedCount: 0,
      streakWinsCount: 0,
    },
    streakActivatedRows: [],
  };
}

function getSortTime(value?: unknown) {
  if (typeof value !== "string" || !value.trim()) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function getEntrySortTime(entry: DashboardEntry) {
  return getSortTime(toStreakSortAtISO(entry));
}

function toEntryId(value: unknown) {
  return String(value ?? "").trim();
}

function toSafeCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}

function appendTaggedRows(
  target: DashboardPendingRow[],
  rows: Array<Omit<DashboardPendingRow, "tag">>
) {
  rows.forEach((row, index) => {
    target.push({
      ...row,
      tag: `P${index + 1}`,
    });
  });
}

function computeDashboardSummaryFromIndex(index: UserIndex): DashboardSummary {
  const summary = emptySummary();

  for (const categoryKey of CATEGORY_KEYS) {
    const categorySummary = summary.byCategory[categoryKey];
    categorySummary.totalEntries = toSafeCount(index.totalsByCategory[categoryKey]);
    categorySummary.pendingConfirmationCount = toSafeCount(index.pendingByCategory[categoryKey]);
    categorySummary.approvedCount = toSafeCount(index.approvedByCategory[categoryKey]);
    categorySummary.streakActivatedCount = toSafeCount(index.streakSnapshot.byCategory[categoryKey]?.activated);
    categorySummary.streakWinsCount = toSafeCount(index.streakSnapshot.byCategory[categoryKey]?.wins);

    summary.totals.totalEntries += categorySummary.totalEntries;
    summary.totals.pendingConfirmationCount += categorySummary.pendingConfirmationCount;
    summary.totals.approvedCount += categorySummary.approvedCount;
    summary.totals.streakActivatedCount += categorySummary.streakActivatedCount;
    summary.totals.streakWinsCount += categorySummary.streakWinsCount;
  }

  const rows = index.streakSnapshot.activeEntries
    .slice()
    .sort((left, right) => getSortTime(left.sortAtISO) - getSortTime(right.sortAtISO))
    .map((row) => {
      const categoryConfig = getCategoryConfig(row.categoryKey);
      return {
        id: row.id,
        categoryKey: row.categoryKey,
        categoryLabel: categoryConfig.label,
        route: entryDetail(row.categoryKey, row.id),
        dueAtISO: row.dueAtISO ?? null,
      } satisfies Omit<DashboardPendingRow, "tag">;
    });

  appendTaggedRows(summary.streakActivatedRows, rows);

  return summary;
}

async function computeDashboardSummaryFromEntries(normalizedEmail: string): Promise<DashboardSummary> {
  const summary = emptySummary();
  const rows: Array<Omit<DashboardPendingRow, "tag"> & { sortTime: number }> = [];

  for (const categoryKey of CATEGORY_KEYS) {
    const categoryEntries = await listEntriesForCategory<DashboardEntry>(normalizedEmail, categoryKey);
    const categoryConfig = getCategoryConfig(categoryKey);
    const categorySummary = emptyCategorySummary();

    categorySummary.totalEntries = categoryEntries.length;

    for (const entry of categoryEntries) {
      const workflowStatus = getEntryWorkflowStatus(entry as Record<string, unknown>);
      const streak = getStreakProgressSnapshot(entry);

      if (workflowStatus === "PENDING_CONFIRMATION") {
        categorySummary.pendingConfirmationCount += 1;
      }
      if (workflowStatus === "APPROVED") {
        categorySummary.approvedCount += 1;
      }

      if (streak.isWin) {
        categorySummary.streakWinsCount += 1;
      }

      if (streak.isActivated) {
        const id = toEntryId(entry.id);
        if (!id) continue;

        categorySummary.streakActivatedCount += 1;
        rows.push({
          id,
          categoryKey,
          categoryLabel: categoryConfig.label,
          route: entryDetail(categoryKey, id),
          dueAtISO: streak.dueAtISO,
          sortTime: getEntrySortTime(entry),
        });
      }
    }

    summary.byCategory[categoryKey] = categorySummary;
    summary.totals.totalEntries += categorySummary.totalEntries;
    summary.totals.pendingConfirmationCount += categorySummary.pendingConfirmationCount;
    summary.totals.approvedCount += categorySummary.approvedCount;
    summary.totals.streakActivatedCount += categorySummary.streakActivatedCount;
    summary.totals.streakWinsCount += categorySummary.streakWinsCount;
  }

  const orderedRows = rows
    .slice()
    .sort((left, right) => left.sortTime - right.sortTime)
    .map(({ sortTime: _ignored, ...row }) => row);
  appendTaggedRows(summary.streakActivatedRows, orderedRows);

  return summary;
}

async function computeDashboardSummary(normalizedEmail: string): Promise<DashboardSummary> {
  const indexed = await ensureUserIndex(normalizedEmail);
  if (indexed.ok) {
    return computeDashboardSummaryFromIndex(indexed.data);
  }

  return computeDashboardSummaryFromEntries(normalizedEmail);
}

function getCachedSummary(normalizedEmail: string) {
  const dashboardTag = getDashboardTag(normalizedEmail);
  return unstable_cache(
    async () => computeDashboardSummary(normalizedEmail),
    ["dashboard-summary", normalizedEmail],
    { tags: [dashboardTag] }
  )();
}

export async function getDashboardSummary(email: string): Promise<DashboardSummary> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return emptySummary();
  }

  return getCachedSummary(normalizedEmail);
}
