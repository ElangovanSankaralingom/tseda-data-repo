import "server-only";
import fs from "node:fs/promises";
import { CATEGORY_LIST, type CategorySummaryKey, getCategoryConfig, getCategorySchema } from "@/data/categoryRegistry";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import { isEntryCommitted, isEntryEditable, type EntryStateLike } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { migrateCategoryStore } from "@/lib/migrations";
import { isEntryActivated, isEntryWon } from "@/lib/streakProgress";
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
  confirmationStatus?: string | null;
  committedAtISO?: string | null;
  editWindowExpiresAt?: string | null;
  streakEligible?: boolean | null;
  streak?: unknown;
  [key: string]: unknown;
};

const EMPTY_SUMMARY: CategorySummary = { active: 0, pending: 0 };
export const EMPTY_DATA_ENTRY_SUMMARY = CATEGORY_LIST.reduce<DataEntrySummary>((next, categoryKey) => {
  next[getCategoryConfig(categoryKey).summaryKey] = { ...EMPTY_SUMMARY };
  return next;
}, {} as DataEntrySummary);

function summarizeEntries(entries: SummaryEntry[], categoryKey: string): CategorySummary {
  const schema = getCategorySchema(categoryKey);
  const fields = schema?.fields ?? [];

  return entries.reduce<CategorySummary>(
    (summary, entry) => {
      const stateLike = entry as EntryStateLike;

      // Drafts always need attention
      if (!isEntryCommitted(stateLike)) {
        summary.pending += 1;
        return summary;
      }

      // Streak-activated but not yet won — needs field completion
      if (isEntryActivated(entry) && !isEntryWon(entry, fields)) {
        summary.active += 1;
        return summary;
      }

      // Non-streak generated entry with incomplete fields and still editable
      if (!entry.streakEligible && isEntryEditable(stateLike) && !isEntryWon(entry, fields)) {
        summary.active += 1;
        return summary;
      }

      // Won entries, finalized entries, complete-but-waiting — no badge
      return summary;
    },
    { active: 0, pending: 0 }
  );
}

async function readSummaryFile(filePath: string, categoryKey: string) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const migratedStore = migrateCategoryStore(parsed);
    if (!migratedStore.ok) return EMPTY_SUMMARY;

    const entries = migratedStore.data.order
      .map((entryId) => migratedStore.data.byId[entryId] as SummaryEntry | undefined)
      .filter((entry): entry is SummaryEntry => !!entry);
    return summarizeEntries(entries, categoryKey);
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
      const summary = await readSummaryFile(filePath, categoryKey);
      return { categoryKey, summary };
    })
  );

  return categorySummaries.reduce<DataEntrySummary>((next, item) => {
    const summaryKey = getCategoryConfig(item.categoryKey).summaryKey;
    next[summaryKey] = item.summary;
    return next;
  }, { ...EMPTY_DATA_ENTRY_SUMMARY });
}

export {
  getDashboardSummary,
  type DashboardPendingRow,
  type DashboardSummary,
} from "@/lib/dashboard/getDashboardSummary";
