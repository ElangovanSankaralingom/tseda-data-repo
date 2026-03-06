import "server-only";
import fs from "node:fs/promises";
import { CATEGORY_LIST, type CategorySummaryKey, getCategoryConfig } from "@/data/categoryRegistry";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { migrateCategoryStore } from "@/lib/migrations";
import { getStreakProgressSnapshot } from "@/lib/streakProgress";
import { getUserCategoryStoreFile } from "@/lib/userStore";

export type CategorySummary = {
  active: number;
  pending: number;
};

export type DataEntrySummary = Record<CategorySummaryKey, CategorySummary>;

export function getUnfinishedCount(summary: DataEntrySummary) {
  return Object.values(summary).reduce((total, category) => total + category.active + category.pending, 0);
}

export function countUnfinished(summary: CategorySummary) {
  return summary.active + summary.pending;
}

export function getUnfinishedCountByCategory(summary: DataEntrySummary) {
  return Object.keys(summary).reduce<Record<keyof DataEntrySummary, number>>((next, key) => {
    const typedKey = key as keyof DataEntrySummary;
    next[typedKey] = countUnfinished(summary[typedKey]);
    return next;
  }, {} as Record<keyof DataEntrySummary, number>);
}

type SummaryEntry = {
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  streak?: unknown;
};

const EMPTY_SUMMARY: CategorySummary = { active: 0, pending: 0 };
export const EMPTY_DATA_ENTRY_SUMMARY = CATEGORY_LIST.reduce<DataEntrySummary>((next, categoryKey) => {
  next[getCategoryConfig(categoryKey).summaryKey] = { ...EMPTY_SUMMARY };
  return next;
}, {} as DataEntrySummary);

function isCompletedEntry(entry: SummaryEntry) {
  const streak = getStreakProgressSnapshot(entry);
  return String(entry.status ?? "").trim().toLowerCase() === "final" || streak.hasCompletedAt;
}

function isActiveEntry(entry: SummaryEntry) {
  return getStreakProgressSnapshot(entry).isActivated;
}

function summarizeEntries(entries: SummaryEntry[]): CategorySummary {
  return entries.reduce<CategorySummary>(
    (summary, entry) => {
      if (isActiveEntry(entry)) {
        summary.active += 1;
        return summary;
      }

      if (!isCompletedEntry(entry)) {
        summary.pending += 1;
      }

      return summary;
    },
    { active: 0, pending: 0 }
  );
}

async function readSummaryFile(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const migratedStore = migrateCategoryStore(parsed);
    if (!migratedStore.ok) return EMPTY_SUMMARY;

    const entries = migratedStore.data.order
      .map((entryId) => migratedStore.data.byId[entryId] as SummaryEntry | undefined)
      .filter((entry): entry is SummaryEntry => !!entry);
    return summarizeEntries(entries);
  } catch {
    return EMPTY_SUMMARY;
  }
}

export async function getDataEntrySummary(email: string): Promise<DataEntrySummary> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return { ...EMPTY_DATA_ENTRY_SUMMARY };

  const categorySummaries = await Promise.all(
    CATEGORY_LIST.map(async (categoryKey) => {
      const filePath = getUserCategoryStoreFile(normalizedEmail, CATEGORY_STORE_FILES[categoryKey]);
      const summary = await readSummaryFile(filePath);
      return { categoryKey, summary };
    })
  );

  return categorySummaries.reduce<DataEntrySummary>((next, item) => {
    const summaryKey = getCategoryConfig(item.categoryKey).summaryKey;
    next[summaryKey] = item.summary;
    return next;
  }, { ...EMPTY_DATA_ENTRY_SUMMARY });
}
