"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatRelativeTime } from "@/lib/i18n/relativeTime";

export default function EditorMetadataFooter({
  entryId,
  createdAt,
  updatedAt,
}: {
  entryId?: string;
  category?: string;
  createdAt?: string;
  updatedAt?: string;
  committedAt?: string;
  streakEligible?: boolean;
  editWindowExpires?: string;
}) {
  const { t, language } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const items: string[] = [];
  if (entryId) items.push(`ID: ${entryId.slice(0, 8)}`);
  const created = formatRelativeTime(createdAt, language);
  if (created) items.push(`${t('entry.created')}: ${created}`);
  const updated = formatRelativeTime(updatedAt, language);
  if (updated) items.push(`${t('entry.lastUpdated')}: ${updated}`);

  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
        {t('entry.showDetails')}
      </button>
      {expanded ? (
        <div className="mt-2 rounded-lg border border-[var(--color-divider)] bg-[var(--color-body-bg)]/50 px-3 py-2">
          <p className="text-xs text-[var(--color-text-secondary)] flex flex-wrap gap-x-1.5">
            {items.map((item, i) => (
              <span key={item}>
                {i > 0 ? <span className="text-[var(--color-text-muted)] mr-1.5">&middot;</span> : null}
                {item}
              </span>
            ))}
          </p>
        </div>
      ) : null}
    </div>
  );
}
