"use client";

import type { StreakDeadlineState } from "@/lib/streakDeadline";
import { useTranslation } from "@/lib/i18n/useTranslation";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getBadgeClass(deadlineState: StreakDeadlineState) {
  if (deadlineState.isExpired || deadlineState.color === "red") {
    return "border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] text-[var(--color-status-error)] backdrop-blur-sm";
  }

  if (deadlineState.color === "yellow") {
    return "border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)] backdrop-blur-sm";
  }

  return "border-[var(--color-glass-border)] bg-[var(--color-body-bg)] text-[var(--color-text-primary)]";
}

export default function FinalisationBadge({
  deadlineState,
  variant = "compact",
}: {
  deadlineState: StreakDeadlineState;
  variant?: "compact";
}) {
  const { t } = useTranslation();

  if (!deadlineState.hasDeadline) {
    return null;
  }

  function getBadgeText(ds: StreakDeadlineState) {
    if (ds.isExpired) return t("entry.streakExpired");
    if (ds.daysRemaining <= 0) return t("entry.streakEndsToday");
    if (ds.daysRemaining === 1) return t("entry.streakEndsInOneDay");
    return t("entry.streakEndsInDays").replace("{count}", String(ds.daysRemaining));
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
