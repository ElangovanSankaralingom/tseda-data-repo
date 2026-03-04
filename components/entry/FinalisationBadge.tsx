"use client";

import type { StreakDeadlineState } from "@/lib/streakDeadline";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getBadgeText(deadlineState: StreakDeadlineState) {
  if (deadlineState.isExpired) return "Expired";
  if (deadlineState.daysRemaining <= 0) return "Finalise today";
  if (deadlineState.daysRemaining === 1) return "Finalise in 1 day";
  return `Finalise in ${deadlineState.daysRemaining} days`;
}

function getBadgeClass(deadlineState: StreakDeadlineState) {
  if (deadlineState.isExpired || deadlineState.color === "red") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (deadlineState.color === "yellow") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-border bg-background text-muted-foreground";
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
