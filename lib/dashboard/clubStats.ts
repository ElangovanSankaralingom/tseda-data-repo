import { getCategoryConfig, CATEGORY_GROUP_ORDER, type CategoryGroup } from "@/data/categoryRegistry";

/**
 * Club roll-up for the dashboard analytics cards. Pure registry math —
 * importable from BOTH server components (dashboard page) and client
 * components. Must NOT live in a "use client" module: Next.js forbids
 * invoking client-module functions on the server (learned the hard way,
 * 2026-07).
 */

export type ClubStat = {
  group: CategoryGroup;
  entries: number;
  categories: number;
};

export function buildClubStats(
  perCategory: Array<{ slug: string; totalEntries: number }>,
): ClubStat[] {
  const byGroup = new Map<CategoryGroup, ClubStat>();
  for (const group of CATEGORY_GROUP_ORDER) {
    byGroup.set(group, { group, entries: 0, categories: 0 });
  }
  for (const row of perCategory) {
    const group = getCategoryConfig(row.slug).group;
    const stat = byGroup.get(group);
    if (!stat) continue;
    stat.entries += row.totalEntries;
    stat.categories += 1;
  }
  return CATEGORY_GROUP_ORDER.map((group) => byGroup.get(group)!).filter(Boolean);
}
