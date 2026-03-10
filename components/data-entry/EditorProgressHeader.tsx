"use client";

import { getCategoryConfig } from "@/data/categoryRegistry";
import { type EditorProgressHeaderProps } from "./dataEntryTypes";

const DEFAULT_ACCENT = { bar: "from-slate-400 to-slate-600", bg: "bg-slate-100", text: "text-slate-600" };

export default function EditorProgressHeader({
  category,
  progress,
  isGenerated,
  streakEligible,
}: EditorProgressHeaderProps) {
  const config = getCategoryConfig(category);
  const accent = config?.color ?? DEFAULT_ACCENT;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-slate-600">
          {progress.completed} of {progress.total} {isGenerated ? "fields" : "required fields"}
          {isGenerated && progress.completed < progress.total ? " — upload supporting documents" : ""}
        </span>
        {streakEligible ? (
          <span className="text-xs font-medium text-amber-600">&#9889; Streak Entry</span>
        ) : null}
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accent.bar} transition-all duration-300`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
