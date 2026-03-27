"use client";

import { Flame } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n";

export default function DashboardWelcome({
  greetingKey,
  firstName,
  totalEntries,
  streakActivated,
  streakWins,
  hasAnyEntries,
}: {
  greetingKey: string;
  firstName: string;
  totalEntries: number;
  streakActivated: number;
  streakWins: number;
  hasAnyEntries: boolean;
}) {
  const { t } = useTranslation();

  const greeting = t(`dashboard.${greetingKey}` as TranslationKey);

  const welcomeSubtext = !hasAnyEntries
    ? t("dashboard.startFirstEntry")
    : streakActivated > 0
    ? `${streakActivated} ${streakActivated === 1 ? t("dashboard.entryToComplete") : t("dashboard.entriesToComplete")}`
    : streakWins > 0
    ? t("dashboard.allEntriesComplete")
    : t("dashboard.heresYourProgress");

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 animate-fade-in-up">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {greeting}, {firstName}
          </h1>
          {hasAnyEntries && (
            <span className="rounded-full bg-[var(--color-dropdown-hover)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
              {totalEntries} {totalEntries === 1 ? t("dashboard.entry") : t("dashboard.entries")}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {welcomeSubtext}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {streakActivated > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-sm font-medium text-amber-900">
            <Flame className="size-4" />
            {streakActivated}
          </div>
        )}
      </div>
    </div>
  );
}
