"use client";

import { Unlock } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function StageTwoDivider() {
  const { t } = useTranslation();
  return (
    <div className="my-6 animate-fade-in-up">
      <div className="flex items-center">
        <div className="flex-1 border-t border-dashed border-[var(--color-input-border)]" />
        <span className="mx-4 inline-flex shrink-0 items-center gap-2 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-4 py-1.5 shadow-sm">
          <span className="flex size-5 items-center justify-center rounded-full bg-amber-500/15">
            <Unlock className="size-3 text-amber-600" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            {t('entry.supportingDocuments')}
          </span>
        </span>
        <div className="flex-1 border-t border-dashed border-[var(--color-input-border)]" />
      </div>
      <p className="mt-2 text-center text-xs text-[var(--color-text-secondary)]">
        {t('entry.uploadSupportingDocsHint')}
      </p>
    </div>
  );
}
