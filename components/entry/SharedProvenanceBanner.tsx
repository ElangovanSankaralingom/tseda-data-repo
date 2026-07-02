"use client";

import { UserPlus } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Provenance note shown on collaborative copies (entries fanned out by
 * engineShare): tells the recipient who added them and that this copy —
 * with its own PDF, timer, and streak — is theirs.
 */
export default function SharedProvenanceBanner({ sourceEmail }: { sourceEmail?: string | null }) {
  const { t } = useTranslation();
  if (!sourceEmail) return null;
  return (
    <div
      role="note"
      className="mb-4 flex items-center gap-2.5 rounded-lg border border-[var(--color-status-info-border)] bg-[var(--color-status-info-bg)] px-4 py-3"
    >
      <UserPlus className="h-4 w-4 shrink-0 text-[var(--color-status-info)]" aria-hidden="true" />
      <p className="text-sm text-[var(--color-text-secondary)]">
        {t("entry.sharedBanner")}{" "}
        <span className="font-medium text-[var(--color-text-primary)]">{sourceEmail}</span>
        {" — "}
        {t("entry.sharedBannerHint")}
      </p>
    </div>
  );
}
