"use client";

import { getCategoryConfig } from "@/data/categoryRegistry";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { type EditorProgressHeaderProps } from "./dataEntryTypes";

const DEFAULT_ACCENT = { bar: "from-[var(--color-text-muted)] to-[var(--color-text-secondary)]", bg: "bg-[var(--color-dropdown-hover)]", text: "text-[var(--color-text-secondary)]" };

export default function EditorProgressHeader({
  category,
  progress,
  isGenerated,
  streakEligible,
}: EditorProgressHeaderProps) {
  const { t } = useTranslation();
  const config = getCategoryConfig(category);
  const accent = config?.color ?? DEFAULT_ACCENT;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {progress.completed} {t('common.of')} {progress.total} {isGenerated ? t('entry.fields') : t('entry.requiredFields')}
          {isGenerated && progress.completed < progress.total ? ` \u2014 ${t('entry.uploadSupportingDocsShort')}` : ""}
        </span>
        {streakEligible ? (
          <span className="text-xs font-medium text-[var(--color-status-warning)]">&#9889; {t('entry.streakEntry')}</span>
        ) : null}
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-dropdown-hover)] overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${accent.bar} transition-all duration-300`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
    </div>
  );
}
