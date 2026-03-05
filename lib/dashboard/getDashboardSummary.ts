import "server-only";

import { unstable_cache } from "next/cache";
import { CATEGORY_KEYS } from "@/lib/categories";
import { getEntryWorkflowStatus, listEntriesForCategory } from "@/lib/entryEngine";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  isFutureDatedEntry,
  normalizeStreakState,
  remainingDaysFromDueAtISO,
  status as getStreakStatus,
} from "@/lib/gamification";
import { entryList } from "@/lib/navigation";
import { getDashboardTag } from "@/lib/dashboard/tags";

type DashboardEntry = {
  id?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  status?: unknown;
  streak?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

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

const CATEGORY_META: Record<CategoryKey, { label: string; route: string }> = {
  "fdp-attended": {
    label: "FDP - Attended",
    route: entryList("fdp-attended"),
  },
  "fdp-conducted": {
    label: "FDP - Conducted",
    route: entryList("fdp-conducted"),
  },
  "case-studies": {
    label: "Case Studies",
    route: entryList("case-studies"),
  },
  "guest-lectures": {
    label: "Guest Lectures",
    route: entryList("guest-lectures"),
  },
  workshops: {
    label: "Workshops",
    route: entryList("workshops"),
  },
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
  const createdTime = getSortTime(entry.createdAt);
  if (createdTime !== Number.POSITIVE_INFINITY) return createdTime;
  return getSortTime(entry.updatedAt);
}

function toEntryId(value: unknown) {
  return String(value ?? "").trim();
}

function toDateISO(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toFinalStatus(value: unknown) {
  return value === "final";
}

function isStreakActiveEntry(entry: DashboardEntry) {
  const startDate = toDateISO(entry.startDate);
  const endDate = toDateISO(entry.endDate);
  if (!isFutureDatedEntry(startDate, endDate)) return false;

  const streak = normalizeStreakState(entry.streak);
  return getStreakStatus(streak) === "active";
}

function isStreakWinEntry(entry: DashboardEntry) {
  if (!toFinalStatus(entry.status)) return false;

  const startDate = toDateISO(entry.startDate);
  const endDate = toDateISO(entry.endDate);
  if (!isFutureDatedEntry(startDate, endDate)) return false;

  const streak = normalizeStreakState(entry.streak);
  if (!streak.activatedAtISO || !streak.completedAtISO || !streak.dueAtISO) return false;

  return Date.parse(streak.completedAtISO) <= Date.parse(streak.dueAtISO);
}

async function computeDashboardSummary(normalizedEmail: string): Promise<DashboardSummary> {
  const summary = emptySummary();

  for (const categoryKey of CATEGORY_KEYS) {
    const categoryEntries = await listEntriesForCategory<DashboardEntry>(normalizedEmail, categoryKey);
    const categoryMeta = CATEGORY_META[categoryKey];
    const categoryActiveRows: Array<Omit<DashboardPendingRow, "tag"> & { sortTime: number }> = [];
    const categorySummary = emptyCategorySummary();

    categorySummary.totalEntries = categoryEntries.length;

    for (const entry of categoryEntries) {
      const workflowStatus = getEntryWorkflowStatus(entry as Record<string, unknown>);

      if (workflowStatus === "PENDING_CONFIRMATION") {
        categorySummary.pendingConfirmationCount += 1;
      }
      if (workflowStatus === "APPROVED") {
        categorySummary.approvedCount += 1;
      }

      if (isStreakWinEntry(entry)) {
        categorySummary.streakWinsCount += 1;
      }

      if (isStreakActiveEntry(entry)) {
        const id = toEntryId(entry.id);
        if (!id) continue;

        categorySummary.streakActivatedCount += 1;
        categoryActiveRows.push({
          id,
          categoryKey,
          categoryLabel: categoryMeta.label,
          route: categoryMeta.route,
          remainingDays: remainingDaysFromDueAtISO(normalizeStreakState(entry.streak).dueAtISO),
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
