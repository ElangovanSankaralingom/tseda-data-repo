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
                ? `${streakActivated} ${streakActivated === 1 ? "entry" : "entries"} to complete`
                : "Generate an entry with a future end date"
            }
            hoverDescription="Entries you've kickstarted \u2014 waiting for you to finish the job."
            staggerClass="stagger-1"
          />
          <StreakCard
            type="wins"
            value={streakWins}
            subtext={
              streakWins > 0
                ? `${streakWins} completed`
                : "Complete all fields to earn wins"
            }
            hoverDescription="Entries you crushed from start to finish. Each one's a victory. \uD83C\uDFC6"
            staggerClass="stagger-2"
          />
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent animate-grow-width" />

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
            iconBg="bg-blue-100"
            hoverRing="hover:ring-2 hover:ring-blue-200/50"
            hoverDescription="Everything you've ever logged. Your data footprint."
            staggerClass="stagger-3"
          />
          <StatCard
            icon={CheckCircle2}
            label="Generated"
            value={generatedCount}
            accent="border-t-2 border-t-emerald-400"
            iconColor="text-emerald-500"
            iconBg="bg-emerald-100"
            hoverRing="hover:ring-2 hover:ring-emerald-200/50"
            hoverDescription="Done and dusted. These are locked in forever. \uD83D\uDD12"
            staggerClass="stagger-4"
          />
          <StatCard
            icon={Clock}
            label="Edit Requested"
            value={editRequestedCount}
            accent="border-t-2 border-t-amber-400"
            iconColor="text-amber-500"
            iconBg="bg-amber-100"
            hoverRing="hover:ring-2 hover:ring-amber-200/50"
            hoverDescription="The clock's ticking. Edit these before they lock. \u23F3"
            staggerClass="stagger-5"
          />
        </div>
      </div>

    </>
  );
}
