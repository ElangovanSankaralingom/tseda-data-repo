import "server-only";

import { unstable_cache } from "next/cache";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { CATEGORY_KEYS } from "@/lib/categories";
import { ensureUserIndex, type UserIndex } from "@/lib/data/indexStore";
import { getDashboardTag } from "@/lib/dashboard/tags";
import { computeFieldProgress } from "@/lib/entries/fieldProgress";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entries/lifecycle";
import type { CategoryKey } from "@/lib/entries/types";
import { logError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryDetail } from "@/lib/entryNavigation";
import { getEntryTitle } from "@/lib/search/getEntryTitle";
import { logger } from "@/lib/logger";
import { computeCanonicalStreakSnapshot, type StreakProgressAggregateEntry } from "@/lib/streakProgress";
import { incrementStatusCount, ENTRY_STATUSES, type Entry } from "@/lib/types/entry";

type DashboardEntry = Entry;

export type DashboardPendingRow = {
  id: string;
  categoryKey: CategoryKey;
  categoryLabel: string;
  tag: string;
  route: string;
  dueAtISO: string | null;
};

export type DashboardRecentRow = {
  id: string;
  categoryKey: CategoryKey;
  categoryLabel: string;
  title: string;
  status: Entry["confirmationStatus"] | Entry["status"] | string;
  updatedAtISO: string | null;
  route: string;
};

type CategoryDashboardSummary = {
  totalEntries: number;
  draftCount: number;
  generatedCount: number;
  editRequestedCount: number;
  editGrantedCount: number;
  streakActivatedCount: number;
  streakWinsCount: number;
  completedNonStreakCount: number;
};

export type DashboardSummary = {
  byCategory: Record<CategoryKey, CategoryDashboardSummary>;
  totals: {
    totalEntries: number;
    draftCount: number;
    generatedCount: number;
    editRequestedCount: number;
    editGrantedCount: number;
    streakActivatedCount: number;
    streakWinsCount: number;
    completedNonStreakCount: number;
    // Keep old names as aliases for dashboard page compatibility
    pendingConfirmationCount: number;
    approvedCount: number;
    rejectedCount: number;
  };
  streakActivatedRows: DashboardPendingRow[];
  recentEntries: DashboardRecentRow[];
};

function toFiniteCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function emptyCategorySummary(): CategoryDashboardSummary {
  return {
    totalEntries: 0,
    draftCount: 0,
    generatedCount: 0,
    editRequestedCount: 0,
    editGrantedCount: 0,
    streakActivatedCount: 0,
    streakWinsCount: 0,
    completedNonStreakCount: 0,
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
      draftCount: 0,
      generatedCount: 0,
      editRequestedCount: 0,
      editGrantedCount: 0,
      streakActivatedCount: 0,
      streakWinsCount: 0,
      completedNonStreakCount: 0,
      pendingConfirmationCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    },
    streakActivatedRows: [],
    recentEntries: [],
  };
}

function normalizeSummary(summary: unknown): DashboardSummary {
  const fallback = emptySummary();
  if (!summary || typeof summary !== "object") {
    return fallback;
  }

  const candidate = summary as Partial<DashboardSummary>;
  const candidateByCategory =
    candidate.byCategory as Partial<Record<CategoryKey, Partial<CategoryDashboardSummary>>> | undefined;

  const byCategory = CATEGORY_KEYS.reduce<Record<CategoryKey, CategoryDashboardSummary>>(
    (next, categoryKey) => {
      const raw = candidateByCategory?.[categoryKey];
      next[categoryKey] = {
        totalEntries: toFiniteCount(raw?.totalEntries),
        draftCount: toFiniteCount(raw?.draftCount),
        generatedCount: toFiniteCount(raw?.generatedCount),
        editRequestedCount: toFiniteCount(raw?.editRequestedCount),
        editGrantedCount: toFiniteCount(raw?.editGrantedCount),
        streakActivatedCount: toFiniteCount(raw?.streakActivatedCount),
        streakWinsCount: toFiniteCount(raw?.streakWinsCount),
        completedNonStreakCount: toFiniteCount(raw?.completedNonStreakCount),
      };
      return next;
    },
    {} as Record<CategoryKey, CategoryDashboardSummary>
  );

  const rawTotals = candidate.totals ?? fallback.totals;
  const generatedCount = toFiniteCount(rawTotals.generatedCount);
  const editRequestedCount = toFiniteCount(rawTotals.editRequestedCount);
  const editGrantedCount = toFiniteCount(rawTotals.editGrantedCount);
  const totals = {
    totalEntries: toFiniteCount(rawTotals.totalEntries),
    draftCount: toFiniteCount(rawTotals.draftCount),
    generatedCount,
    editRequestedCount,
    editGrantedCount,
    streakActivatedCount: toFiniteCount(rawTotals.streakActivatedCount),
    streakWinsCount: toFiniteCount(rawTotals.streakWinsCount),
    completedNonStreakCount: toFiniteCount(rawTotals.completedNonStreakCount),
    // Compatibility aliases
    pendingConfirmationCount: editRequestedCount,
    approvedCount: generatedCount + editGrantedCount,
    rejectedCount: 0,
  };

  return {
    byCategory,
    totals,
    streakActivatedRows: Array.isArray(candidate.streakActivatedRows) ? candidate.streakActivatedRows : [],
    recentEntries: Array.isArray(candidate.recentEntries) ? candidate.recentEntries : [],
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

function toOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

function toSortTimestamp(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function computeDashboardFromIndex(index: UserIndex): DashboardSummary {
  const summary = emptySummary();

  for (const categoryKey of CATEGORY_KEYS) {
    const categorySummary = summary.byCategory[categoryKey];
    categorySummary.totalEntries = index.totalsByCategory[categoryKey] ?? 0;
    categorySummary.draftCount = 0; // Computed below from countsByStatus
    categorySummary.generatedCount = 0;
    categorySummary.editRequestedCount = 0;
    categorySummary.editGrantedCount = 0;

    const streakCat = index.streakSnapshot.byCategory[categoryKey];
    categorySummary.streakActivatedCount = streakCat?.activated ?? 0;
    categorySummary.streakWinsCount = streakCat?.wins ?? 0;
    // completedNonStreakCount is not tracked in the index — leave as 0
  }

  // Global status counts from index
  for (const status of ENTRY_STATUSES) {
    const count = index.countsByStatus[status] ?? 0;
    if (status === "DRAFT") summary.totals.draftCount = count;
    else if (status === "GENERATED") summary.totals.generatedCount = count;
    else if (status === "EDIT_REQUESTED") summary.totals.editRequestedCount = count;
    else if (status === "EDIT_GRANTED") summary.totals.editGrantedCount = count;
  }

  summary.totals.totalEntries = Object.values(index.totalsByCategory).reduce((s, v) => s + v, 0);
  summary.totals.streakActivatedCount = index.streakSnapshot.streakActivatedCount;
  summary.totals.streakWinsCount = index.streakSnapshot.streakWinsCount;
  summary.totals.pendingConfirmationCount = summary.totals.editRequestedCount;
  summary.totals.approvedCount = summary.totals.generatedCount + summary.totals.editGrantedCount;
  summary.totals.rejectedCount = 0;

  // Streak activated rows from index snapshot
  const streakRows = (index.streakSnapshot.activeEntries ?? []).map((row, i) => {
    const categoryConfig = getCategoryConfig(row.categoryKey);
    return {
      id: row.id,
      categoryKey: row.categoryKey,
      categoryLabel: categoryConfig.label,
      tag: `P${i + 1}`,
      route: entryDetail(row.categoryKey, row.id),
      dueAtISO: row.dueAtISO ?? null,
    } satisfies DashboardPendingRow;
  });
  summary.streakActivatedRows = streakRows;

  // Recent entries from search index snapshots
  const searchEntries = Object.values(index.searchIndexByEntryId ?? {});
  summary.recentEntries = searchEntries
    .filter((snap) => !!snap.entryId)
    .sort((a, b) => toSortTimestamp(b.updatedAtISO) - toSortTimestamp(a.updatedAtISO))
    .slice(0, 8)
    .map((snap) => {
      const categoryConfig = getCategoryConfig(snap.categoryKey);
      return {
        id: snap.entryId,
        categoryKey: snap.categoryKey,
        categoryLabel: categoryConfig.label,
        title: snap.title || snap.entryId,
        status: snap.status,
        updatedAtISO: snap.updatedAtISO,
        route: entryDetail(snap.categoryKey, snap.entryId),
      } satisfies DashboardRecentRow;
    });

  return summary;
}

async function computeDashboardSummary(normalizedEmail: string): Promise<DashboardSummary> {
  // Fast path: try to derive dashboard from pre-computed index
  const startMs = Date.now();
  const indexResult = await ensureUserIndex(normalizedEmail);
  if (indexResult.ok) {
    const index = indexResult.data;
    if (index.streakSnapshot && index.searchIndexByEntryId) {
      const fromIndex = computeDashboardFromIndex(index);
      logger.info({
        event: "dashboard.computed.from-index",
        userEmail: normalizedEmail,
        durationMs: Date.now() - startMs,
      });
      return fromIndex;
    }
  }

  // Slow path: full category reads (fallback when index is incomplete)
  logger.info({
    event: "dashboard.computed.full-read",
    userEmail: normalizedEmail,
  });

  const summary = emptySummary();
  const streakInputs: StreakProgressAggregateEntry[] = [];
  const recentRows: DashboardRecentRow[] = [];

  const results = await Promise.all(
    CATEGORY_KEYS.map(async (categoryKey) => ({
      categoryKey,
      entries: await listEntriesForCategory<DashboardEntry>(normalizedEmail, categoryKey),
    }))
  );

  for (const { categoryKey, entries: categoryEntries } of results) {
    const categorySummary = summary.byCategory[categoryKey];
    categorySummary.totalEntries = categoryEntries.length;
    const categoryConfig = getCategoryConfig(categoryKey);

    for (const entry of categoryEntries) {
      const workflowStatus = getEntryWorkflowStatus(entry as Record<string, unknown>);
      incrementStatusCount(categorySummary, workflowStatus);

      const updatedAtISO = toOptionalISO(entry.updatedAt) ?? toOptionalISO(entry.createdAt);
      const title = getEntryTitle(entry, categoryKey);
      recentRows.push({
        id: String(entry.id ?? "").trim(),
        categoryKey,
        categoryLabel: categoryConfig.label,
        title,
        status: workflowStatus,
        updatedAtISO,
        route: entryDetail(categoryKey, String(entry.id ?? "").trim()),
      });

      streakInputs.push({
        ...(entry as DashboardEntry),
        categoryKey,
      });
    }

    // Count non-streak entries that are generated and have all required fields complete
    let completedNonStreak = 0;
    for (const entry of categoryEntries) {
      const ws = getEntryWorkflowStatus(entry as Record<string, unknown>);
      if (ws === "DRAFT") continue;
      if (entry.streakEligible) continue;
      const progress = computeFieldProgress(categoryKey, entry as Record<string, unknown>);
      if (progress.total > 0 && progress.completed === progress.total) {
        completedNonStreak++;
      }
    }
    categorySummary.completedNonStreakCount = completedNonStreak;

    summary.totals.totalEntries += categorySummary.totalEntries;
    summary.totals.draftCount += categorySummary.draftCount;
    summary.totals.generatedCount += categorySummary.generatedCount;
    summary.totals.editRequestedCount += categorySummary.editRequestedCount;
    summary.totals.editGrantedCount += categorySummary.editGrantedCount;
    summary.totals.completedNonStreakCount += completedNonStreak;
  }

  // Compatibility aliases
  summary.totals.pendingConfirmationCount = summary.totals.editRequestedCount;
  summary.totals.approvedCount = summary.totals.generatedCount + summary.totals.editGrantedCount;
  summary.totals.rejectedCount = 0;

  // Dashboard presentation consumes the canonical streak snapshot directly.
  const streakSummary = computeCanonicalStreakSnapshot(streakInputs);

  for (const categoryKey of CATEGORY_KEYS) {
    const categorySummary = summary.byCategory[categoryKey];
    categorySummary.streakActivatedCount = streakSummary.byCategory[categoryKey].activated;
    categorySummary.streakWinsCount = streakSummary.byCategory[categoryKey].wins;

    summary.totals.streakActivatedCount += categorySummary.streakActivatedCount;
    summary.totals.streakWinsCount += categorySummary.streakWinsCount;
  }

  const rows = streakSummary.activeEntries
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
  summary.recentEntries = recentRows
    .filter((row) => !!row.id)
    .sort((left, right) => toSortTimestamp(right.updatedAtISO) - toSortTimestamp(left.updatedAtISO))
    .slice(0, 8);

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
    const cached = await getCachedSummary(normalizedEmail);
    return normalizeSummary(cached);
  } catch (error) {
    logError(error, "dashboard.getDashboardSummary");
    return emptySummary();
  }
}
