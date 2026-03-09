"use client";

import { CheckCircle2, Lock } from "lucide-react";
import { type EditorProgressHeaderProps } from "./dataEntryTypes";

const ACCENT_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
  "fdp-attended": { bar: "from-blue-400 to-blue-600", bg: "bg-blue-100", text: "text-blue-600" },
  "fdp-conducted": { bar: "from-emerald-400 to-emerald-600", bg: "bg-emerald-100", text: "text-emerald-600" },
  "case-studies": { bar: "from-amber-400 to-amber-600", bg: "bg-amber-100", text: "text-amber-600" },
  "guest-lectures": { bar: "from-purple-400 to-purple-600", bg: "bg-purple-100", text: "text-purple-600" },
  workshops: { bar: "from-rose-400 to-rose-600", bg: "bg-rose-100", text: "text-rose-600" },
};

function PhasePill({
  label,
  completed,
  total,
  locked,
  done,
}: {
  label: string;
  completed: number;
  total: number;
  locked?: boolean;
  done: boolean;
}) {
  if (done) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="size-3.5" />
        {label}
      </span>
    );
  }

  if (locked) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
        <Lock className="size-3" />
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      {label}
      <span className="text-slate-400">
        {completed} of {total}
      </span>
    </span>
  );
}

export default function EditorProgressHeader({
  category,
  progress,
  isGenerated,
  streakEligible,
  editTimeLabel,
  showFinalise,
  canFinalise,
}: EditorProgressHeaderProps) {
  const accent = ACCENT_COLORS[category] ?? ACCENT_COLORS["fdp-attended"];

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-4 sm:px-5 animate-fade-in">
      {/* Badges row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {streakEligible ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <span className="animate-flame">&#9889;</span> Streak Entry
          </span>
        ) : null}
        {editTimeLabel ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
            ⏱️ {editTimeLabel}
          </span>
        ) : null}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${accent.bar} transition-all duration-300 ease-out`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <span className="shrink-0 text-xs text-slate-500">
          {progress.completed} of {progress.total}
        </span>
      </div>

      {/* Finalise hint */}
      {showFinalise && canFinalise ? (
        <p className="mt-2 text-xs text-emerald-600">
          All fields complete — you can finalise this entry now or wait for the timer.
        </p>
      ) : null}

      {/* Phase indicators */}
      {progress.hasPhases ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
          <PhasePill
            label="Required Fields"
            completed={progress.preGenerate.completed}
            total={progress.preGenerate.total}
            done={progress.preGenerate.completed === progress.preGenerate.total}
          />
          <span className="text-slate-300 text-xs hidden sm:inline">&rarr;</span>
          <PhasePill
            label="Complete Entry"
            completed={progress.postGenerate.completed}
            total={progress.postGenerate.total}
            locked={!isGenerated}
            done={progress.postGenerate.completed === progress.postGenerate.total && isGenerated}
          />
        </div>
      ) : null}
    </div>
  );
}
