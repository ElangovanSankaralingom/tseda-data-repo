"use client";

import {
  ClipboardList,
  Clock,
  CheckCircle2,
} from "lucide-react";
import SectionHeader from "@/components/dashboard/SectionHeader";
import StatCard from "@/components/dashboard/StatCard";
import StreakCard from "@/components/dashboard/StreakCard";
type DashboardClientProps = {
  streakActivated: number;
  streakWins: number;
  totalEntries: number;
  generatedCount: number;
  editRequestedCount: number;
};

export default function DashboardClient({
  streakActivated,
  streakWins,
  totalEntries,
  generatedCount,
  editRequestedCount,
}: DashboardClientProps) {
  return (
    <>
      {/* Section A — Your Streak */}
      <div>
        <SectionHeader
          title="Your Streak"
          description="Eligible entries generated and fully completed"
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <StreakCard
            type="active"
            value={streakActivated}
            subtext={
              streakActivated > 0
                ? "Eligible entries generated"
                : "Generate an entry with a future end date"
            }
          />
          <StreakCard
            type="wins"
            value={streakWins}
            subtext={
              streakWins > 0
                ? `${streakWins} / ${streakActivated} entries completed`
                : "Complete all fields to earn wins"
            }
          />
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Section B — Your Progress */}
      <div>
        <SectionHeader
          title="Your Progress"
          description="Overview of your data entries"
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={ClipboardList}
            label="Total Entries"
            value={totalEntries}
            description="Across all categories"
            accent="border-t-2 border-t-blue-400"
            iconColor="text-blue-500"
            hoverRing="hover:ring-2 hover:ring-blue-200"
          />
          <StatCard
            icon={CheckCircle2}
            label="Generated"
            value={generatedCount}
            accent="border-t-2 border-t-emerald-400"
            iconColor="text-emerald-500"
            hoverRing="hover:ring-2 hover:ring-emerald-200"
          />
          <StatCard
            icon={Clock}
            label="Edit Requested"
            value={editRequestedCount}
            accent="border-t-2 border-t-amber-400"
            iconColor="text-amber-500"
            hoverRing="hover:ring-2 hover:ring-amber-200"
          />
        </div>
      </div>

    </>
  );
}
