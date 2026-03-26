"use client";

import {
  ClipboardList,
  Clock,
  CheckCircle2,
} from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";
import StatCard from "@/components/dashboard/StatCard";
import StreakCard from "@/components/dashboard/StreakCard";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function DashboardClient({
  streakActivated,
  streakWins,
  totalEntries,
  generatedCount,
  editRequestedCount,
}: { streakActivated: number; streakWins: number; totalEntries: number; generatedCount: number; editRequestedCount: number }) {
  const { t } = useTranslation();

  return (
    <>
      {/* Section A — Your Streak */}
      <ErrorBoundary section="Streak stats">
      <div>
        <SectionHeader
          title={t("dashboard.yourStreak")}
          description={t("dashboard.streakDescription")}
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <StreakCard
            type="active"
            value={streakActivated}
            subtext={
              streakActivated > 0
                ? `${streakActivated} ${streakActivated === 1 ? t("dashboard.entryToComplete") : t("dashboard.entriesToComplete")}`
                : t("dashboard.generateFutureEntry")
            }
            hoverDescription={t("dashboard.streakActivatedHover")}
            staggerClass="stagger-1"
          />
          <StreakCard
            type="wins"
            value={streakWins}
            subtext={
              streakWins > 0
                ? `${streakWins} ${t("dashboard.completed")}`
                : t("dashboard.completeFieldsToWin")
            }
            hoverDescription={t("dashboard.streakWinsHover")}
            staggerClass="stagger-2"
          />
        </div>
      </div>

      </ErrorBoundary>

      <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-card-border)] to-transparent animate-grow-width" />

      {/* Section B — Your Progress */}
      <ErrorBoundary section="Progress stats">
      <div>
        <SectionHeader
          title={t("dashboard.yourProgress")}
          description={t("dashboard.progressDescription")}
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={ClipboardList}
            label={t("dashboard.totalEntries")}
            value={totalEntries}
            description={t("dashboard.acrossAllCategories")}
            accent="border-t-2 border-t-blue-400"
            iconColor="text-blue-500"
            iconBg="bg-blue-100"
            hoverRing="hover:ring-2 hover:ring-blue-200/50"
            hoverDescription={t("dashboard.totalEntriesHover")}
            staggerClass="stagger-3"
          />
          <StatCard
            icon={CheckCircle2}
            label={t("dashboard.generated")}
            value={generatedCount}
            accent="border-t-2 border-t-emerald-400"
            iconColor="text-emerald-500"
            iconBg="bg-emerald-100"
            hoverRing="hover:ring-2 hover:ring-emerald-200/50"
            hoverDescription={t("dashboard.generatedHover")}
            staggerClass="stagger-4"
          />
          <StatCard
            icon={Clock}
            label={t("dashboard.editRequested")}
            value={editRequestedCount}
            accent="border-t-2 border-t-amber-400"
            iconColor="text-amber-500"
            iconBg="bg-amber-100"
            hoverRing="hover:ring-2 hover:ring-amber-200/50"
            hoverDescription={t("dashboard.editRequestedHover")}
            staggerClass="stagger-5"
          />
        </div>
      </div>
      </ErrorBoundary>

    </>
  );
}
