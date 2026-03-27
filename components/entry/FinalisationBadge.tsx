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
    return "border-red-500/25 bg-red-500/[0.12] text-red-600 backdrop-blur-sm shadow-[0_1px_3px_rgba(239,68,68,0.08)]";
  }

  if (deadlineState.color === "yellow") {
    return "border-amber-500/25 bg-amber-500/[0.12] text-amber-600 backdrop-blur-sm shadow-[0_1px_3px_rgba(245,158,11,0.08)]";
  }

  return "border-[var(--color-card-border)] bg-[var(--color-body-bg)] text-[var(--color-text-primary)]";
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
