import "server-only";
import { CATEGORY_LIST, type CategorySummaryKey, getCategoryConfig } from "@/data/categoryRegistry";

export type CategorySummary = {
  active: number;
  pending: number;
};

export type DataEntrySummary = Record<CategorySummaryKey, CategorySummary>;

export function countUnfinished(summary: CategorySummary) {
  return summary.active + summary.pending;
}

const EMPTY_SUMMARY: CategorySummary = { active: 0, pending: 0 };
export const EMPTY_DATA_ENTRY_SUMMARY = CATEGORY_LIST.reduce<DataEntrySummary>((next, categoryKey) => {
  next[getCategoryConfig(categoryKey).summaryKey] = { ...EMPTY_SUMMARY };
  return next;
}, {} as DataEntrySummary);

export {
  getDashboardSummary,
  type DashboardPendingRow,
  type DashboardSummary,
} from "@/lib/dashboard/getDashboardSummary";
