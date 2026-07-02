"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { entryList } from "@/lib/entryNavigation";
import { useTranslation } from "@/lib/i18n/useTranslation";

/** First-run empty state on the dashboard — client component so the copy
 *  follows the user's language (was hardcoded English inside the server page,
 *  2026-07 layout-consistency fix). */
export default function DashboardEmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex overflow-hidden rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] animate-card-lift">
      {/* ── Thick left accent bar ── */}
      <div className="w-1.5 shrink-0 bg-[var(--color-primary)] opacity-25" />

      <div className="flex-1 p-8 sm:p-10">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* ── Left: Bright icon panel (white surface pop) ── */}
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-surface-raised)] border border-[var(--color-border-default)]">
            <ClipboardList className="size-9 text-[var(--color-icon-muted)]" />
          </div>

          {/* ── Right: Text + CTA ── */}
          <div>
            <p className="text-base font-bold text-[var(--color-text-secondary)]">
              {t("dashboard.emptyTitle")}
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--color-text-tertiary)]">
              {t("dashboard.emptySubtitle")}
            </p>
            <Link
              href={entryList("fdp-attended")}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--color-button-primary-bg)] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--color-button-primary-text)] transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.97]"
            >
              {t("dashboard.emptyCta")}
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
