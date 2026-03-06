import "server-only";

import { unstable_cache } from "next/cache";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { CATEGORY_KEYS } from "@/lib/categories";
import { getDashboardTag } from "@/lib/dashboard/tags";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entries/lifecycle";
import type { CategoryKey } from "@/lib/entries/types";
import { logError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail } from "@/lib/entryNavigation";
import { computeStreakProgressAggregate, type StreakProgressAggregateEntry } from "@/lib/streakProgress";
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

async function computeDashboardSummary(normalizedEmail: string): Promise<DashboardSummary> {
  const summary = emptySummary();
  const streakInputs: StreakProgressAggregateEntry[] = [];

  for (const categoryKey of CATEGORY_KEYS) {
    const categoryEntries = await listEntriesForCategory<DashboardEntry>(normalizedEmail, categoryKey);
    const categorySummary = summary.byCategory[categoryKey];
    categorySummary.totalEntries = categoryEntries.length;

    for (const entry of categoryEntries) {
      const workflowStatus = getEntryWorkflowStatus(entry as Record<string, unknown>);
      if (workflowStatus === "PENDING_CONFIRMATION") {
        categorySummary.pendingConfirmationCount += 1;
      }
      if (workflowStatus === "APPROVED") {
        categorySummary.approvedCount += 1;
      }

      streakInputs.push({
        ...(entry as DashboardEntry),
        categoryKey,
      });
    }

    summary.totals.totalEntries += categorySummary.totalEntries;
    summary.totals.pendingConfirmationCount += categorySummary.pendingConfirmationCount;
    summary.totals.approvedCount += categorySummary.approvedCount;
  }

  const streakSummary = computeStreakProgressAggregate(streakInputs);

  for (const categoryKey of CATEGORY_KEYS) {
    const categorySummary = summary.byCategory[categoryKey];
    categorySummary.streakActivatedCount = streakSummary.byCategory[categoryKey].activated;
    categorySummary.streakWinsCount = streakSummary.byCategory[categoryKey].wins;

    summary.totals.streakActivatedCount += categorySummary.streakActivatedCount;
    summary.totals.streakWinsCount += categorySummary.streakWinsCount;
  }

  const rows = streakSummary.activatedEntries
    .slice()
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

  try {
    return await getCachedSummary(normalizedEmail);
  } catch (error) {
    logError(error, "dashboard.getDashboardSummary");
    return emptySummary();
  }
}
