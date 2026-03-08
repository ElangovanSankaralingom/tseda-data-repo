import { getServerSession } from "next-auth";
import { CATEGORY_LIST, getCategoryConfig } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/dashboard/getDashboardSummary";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { entryList, entryNew } from "@/lib/entryNavigation";
import DataEntryClient from "@/components/data-entry/DataEntryClient";

export const dynamic = "force-dynamic";

export default async function DataEntryHomePage() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  const summary = email.endsWith("@tce.edu")
    ? await getDashboardSummary(email)
    : null;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Derive last activity per category from recent entries (sorted by most recent)
  const lastActivityMap: Record<string, string | null> = {};
  if (summary) {
    for (const entry of summary.recentEntries) {
      if (!lastActivityMap[entry.categoryKey] && entry.updatedAtISO) {
        lastActivityMap[entry.categoryKey] = entry.updatedAtISO;
      }
    }
  }

  const categories = CATEGORY_LIST.map((slug) => {
    const config = getCategoryConfig(slug);
    const catData = summary?.byCategory[slug];
    return {
      slug,
      label: config.label,
      subtitle: config.subtitle ?? "",
      href: entryList(slug),
      newHref: entryNew(slug),
      totalEntries: catData?.totalEntries ?? 0,
      draftCount: catData?.draftCount ?? 0,
      generatedCount: catData?.generatedCount ?? 0,
      editRequestedCount: catData?.editRequestedCount ?? 0,
      editGrantedCount: catData?.editGrantedCount ?? 0,
      streakActivated: catData?.streakActivatedCount ?? 0,
      streakWins: catData?.streakWinsCount ?? 0,
      completedNonStreak: catData?.completedNonStreakCount ?? 0,
      lastActivity: lastActivityMap[slug] ?? null,
    };
  });

  const totals = summary?.totals ?? {
    totalEntries: 0,
    draftCount: 0,
    generatedCount: 0,
    editRequestedCount: 0,
    editGrantedCount: 0,
    streakActivatedCount: 0,
    streakWinsCount: 0,
    completedNonStreakCount: 0,
  };

  return (
    <DataEntryClient
      greeting={greeting}
      userName={session?.user?.name ?? null}
      categories={categories}
      totals={totals}
    />
  );
}
