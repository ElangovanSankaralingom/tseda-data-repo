"use client";

import type { StreakDeadlineState } from "@/lib/streakDeadline";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getBadgeText(deadlineState: StreakDeadlineState) {
  if (deadlineState.isExpired) return "Streak expired";
  if (deadlineState.daysRemaining <= 0) return "Streak ends today";
  if (deadlineState.daysRemaining === 1) return "Streak ends in 1 day";
  return `Streak ends in ${deadlineState.daysRemaining} days`;
}

function getBadgeClass(deadlineState: StreakDeadlineState) {
  if (deadlineState.isExpired || deadlineState.color === "red") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (deadlineState.color === "yellow") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function FinalisationBadge({
  deadlineState,
  variant = "compact",
}: {
  deadlineState: StreakDeadlineState;
  variant?: "compact";
}) {
  if (!deadlineState.hasDeadline) {
    return null;
  }

  return (
    <div
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        variant === "compact" && "whitespace-nowrap",
        getBadgeClass(deadlineState)
      )}
    >
      <span>{getBadgeText(deadlineState)}</span>
    </div>
  );
}
