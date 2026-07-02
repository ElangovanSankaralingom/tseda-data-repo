"use client";

import { type AutoSaveStatus } from "@/hooks/useAutoSave";
import { useTranslation } from "@/lib/i18n/useTranslation";

function getSavedLabel(value: string | null, tr: (key: string) => string) {
  if (!value) return tr("time.autosaveEnabled");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return tr("time.autosaveEnabled");

  const elapsedMs = Date.now() - date.getTime();
  if (elapsedMs < 30 * 1000) return tr("time.savedJustNow");

  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));
  if (elapsedMinutes <= 0) return tr("time.savedJustNow");
  if (elapsedMinutes < 60) return tr("time.minuteAgo").replace("{n}", String(elapsedMinutes));

  const savedAt = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return savedAt;
}

export default function AutoSaveIndicator({
  status,
}: {
  status: AutoSaveStatus;
}) {
  const { t } = useTranslation();

  // key={phase} forces a remount on phase change so the state transition is
  // felt (subtle fade) rather than text snapping in place.
  if (status.phase === "saving") {
    return (
      <p key="saving" className="text-xs text-[var(--color-text-muted)] animate-error-in">
        {t("common.saving")}
      </p>
    );
  }

  if (status.phase === "error") {
    return (
      <p key="error" className="text-xs text-[var(--color-status-warning)] animate-error-in">
        {t("entry.autoSaveFailed")}
      </p>
    );
  }

  if (status.phase === "saved") {
    return (
      <p key="saved" className="text-xs text-[var(--color-text-muted)] animate-error-in">
        {getSavedLabel(status.savedAtISO, t as (key: string) => string)}
      </p>
    );
  }

  return (
    <p key="idle" className="text-xs text-[var(--color-text-muted)]">
      {t("time.autosaveEnabled")}
    </p>
  );
}
