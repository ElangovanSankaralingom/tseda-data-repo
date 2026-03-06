import "server-only";

import { unstable_cache } from "next/cache";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { CATEGORY_KEYS } from "@/lib/categories";
import { ensureUserIndex, type UserIndex } from "@/lib/data/indexStore";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entries/lifecycle";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { remainingDaysFromDueAtISO } from "@/lib/gamification";
import { entryDetail } from "@/lib/navigation";
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
  remainingDays: number;
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

function computeDashboardSummaryFromIndex(index: UserIndex): DashboardSummary {
  const summary = emptySummary();

  for (const categoryKey of CATEGORY_KEYS) {
    const categorySummary = summary.byCategory[categoryKey];
    categorySummary.totalEntries = index.totalsByCategory[categoryKey] ?? 0;
    categorySummary.pendingConfirmationCount = index.pendingByCategory[categoryKey] ?? 0;
    categorySummary.approvedCount = index.approvedByCategory[categoryKey] ?? 0;
    categorySummary.streakActivatedCount = index.streakSnapshot.byCategory[categoryKey]?.activated ?? 0;
    categorySummary.streakWinsCount = index.streakSnapshot.byCategory[categoryKey]?.wins ?? 0;

    summary.totals.totalEntries += categorySummary.totalEntries;
    summary.totals.pendingConfirmationCount += categorySummary.pendingConfirmationCount;
    summary.totals.approvedCount += categorySummary.approvedCount;
    summary.totals.streakActivatedCount += categorySummary.streakActivatedCount;
    summary.totals.streakWinsCount += categorySummary.streakWinsCount;
  }

  for (const categoryKey of CATEGORY_KEYS) {
    const categoryConfig = getCategoryConfig(categoryKey);
    const categoryRows = index.streakSnapshot.activeEntries
      .filter((entry) => entry.categoryKey === categoryKey)
      .sort((left, right) => getSortTime(left.sortAtISO) - getSortTime(right.sortAtISO));

    categoryRows.forEach((row, indexWithinCategory) => {
      summary.streakActivatedRows.push({
        id: row.id,
        categoryKey,
        categoryLabel: categoryConfig.label,
        tag: `P${indexWithinCategory + 1}`,
        route: entryDetail(categoryKey, row.id),
        remainingDays: remainingDaysFromDueAtISO(row.dueAtISO),
      });
    });
  }

  return summary;
}

async function computeDashboardSummaryFromEntries(normalizedEmail: string): Promise<DashboardSummary> {
  const summary = emptySummary();

  for (const categoryKey of CATEGORY_KEYS) {
    const categoryEntries = await listEntriesForCategory<DashboardEntry>(normalizedEmail, categoryKey);
    const categoryConfig = getCategoryConfig(categoryKey);
    const categoryActiveRows: Array<Omit<DashboardPendingRow, "tag"> & { sortTime: number }> = [];
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
        categoryActiveRows.push({
          id,
          categoryKey,
          categoryLabel: categoryConfig.label,
          route: entryDetail(categoryKey, id),
          remainingDays: remainingDaysFromDueAtISO(streak.dueAtISO),
          sortTime: getEntrySortTime(entry),
        });
      }
    }

    categoryActiveRows
      .sort((left, right) => left.sortTime - right.sortTime)
      .forEach((row, index) => {
        summary.streakActivatedRows.push({
          id: row.id,
          categoryKey: row.categoryKey,
          categoryLabel: row.categoryLabel,
          tag: `P${index + 1}`,
          route: row.route,
          remainingDays: row.remainingDays,
        });
      });

    summary.byCategory[categoryKey] = categorySummary;
    summary.totals.totalEntries += categorySummary.totalEntries;
    summary.totals.pendingConfirmationCount += categorySummary.pendingConfirmationCount;
    summary.totals.approvedCount += categorySummary.approvedCount;
    summary.totals.streakActivatedCount += categorySummary.streakActivatedCount;
    summary.totals.streakWinsCount += categorySummary.streakWinsCount;
  }

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
