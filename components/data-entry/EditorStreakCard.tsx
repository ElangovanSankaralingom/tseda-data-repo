"use client";

import { Flame, Trophy } from "lucide-react";
import type { FieldProgress } from "@/lib/entries/fieldProgress";

type EditorStreakCardProps = {
  streakEligible: boolean;
  isWon: boolean;
  progress: FieldProgress;
};

export default function EditorStreakCard({
  streakEligible,
  isWon,
  progress,
}: EditorStreakCardProps) {
  if (!streakEligible) return null;

  if (isWon) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 flex items-center gap-3 animate-fade-in-up group">
        <Trophy className="size-5 text-emerald-500 transition-transform duration-300 group-hover:rotate-[-5deg]" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-emerald-800">Streak Complete!</span>
          <span className="ml-2 text-xs text-emerald-600">All fields filled</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 flex items-center gap-3 animate-fade-in-up">
      <Flame className="size-5 text-amber-500 animate-flame" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-amber-800">Streak Entry</span>
          <span className="text-xs text-amber-600">
            {progress.completed}/{progress.total} fields
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full max-w-[200px] rounded-full bg-amber-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-300 ease-out"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
