"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import {
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Pencil,
  Plus,
  Trophy,
} from "lucide-react";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { CategoryIcon } from "@/lib/ui/categoryIcons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatDate } from "@/lib/i18n/locale";
import { type CategoryOverview, type Totals } from "./dataEntryTypes";

type Props = {
  greeting: string;
  userName: string | null;
  categories: CategoryOverview[];
  totals: Totals;
};

function sortByUrgency(categories: CategoryOverview[]): CategoryOverview[] {
  return [...categories].sort((a, b) => {
    const aScore = a.draftCount * 3 + a.editRequestedCount * 2 + a.streakActivated;
    const bScore = b.draftCount * 3 + b.editRequestedCount * 2 + b.streakActivated;
    if (aScore !== bScore) return bScore - aScore;
    if (a.totalEntries !== b.totalEntries) return b.totalEntries - a.totalEntries;
    return 0;
  });
}

function relativeTime(iso: string, language: "en" | "ta" = "en"): string {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(new Date(iso), language, { day: "numeric", month: "short" });
}

// ── Category Card ──────────────────────────────────────────────────
const CategoryCard = memo(function CategoryCard({ cat, index }: { cat: CategoryOverview; index: number }) {
  const { t, language, categoryLabel } = useTranslation();
  const config = getCategoryConfig(cat.slug);
  const color = config.color;
  const hasEntries = cat.totalEntries > 0;
  const actionableCount = cat.draftCount + cat.streakActivated + cat.editRequestedCount;

  return (
    <div
      className={cn(
        "group relative flex flex-col min-h-[160px] rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in-up",
        hasEntries
          ? cn("border border-t-[3px] bg-[var(--color-card-bg)] border-[var(--color-card-border)] shadow-sm", color.borderTop)
          : "border border-dashed border-[var(--color-input-border)] bg-[var(--color-body-bg)]",
        `stagger-${Math.min(index + 1, 5)}`
      )}
    >
      {/* Notification badge */}
      {actionableCount > 0 && (
        <span className="absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-white shadow-sm">
          {actionableCount}
        </span>
      )}

      {/* Top section: Icon + Title + Chevron */}
      <Link href={hasEntries ? cat.href : cat.newHref} className="flex flex-1 items-start gap-4">
        <div className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
          hasEntries ? color.accentBg : "bg-[var(--color-body-bg)]"
        )}>
          <CategoryIcon name={config.icon} className={cn("size-6", hasEntries ? color.text : "text-[var(--color-text-secondary)]")} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={cn(
            "text-base font-semibold",
            hasEntries ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
          )}>
            {categoryLabel(cat.slug)}
          </h3>

          {hasEntries ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--color-text-secondary)]">
              <span>{cat.totalEntries} {cat.totalEntries === 1 ? t('dashboard.entry') : t('dashboard.entries')}</span>
              {cat.draftCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                  <Pencil className="size-3" />
                  {cat.draftCount} {cat.draftCount === 1 ? t('dashboard.draft') : t('dashboard.drafts')}
                </span>
              )}
              {cat.streakActivated > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/[0.12] px-2 py-0.5 text-xs font-medium text-amber-600 backdrop-blur-sm">
                  <Flame className="size-3 opacity-70" />
                  {cat.streakActivated} {t('dashboard.active')}
                </span>
              )}
              {cat.streakWins > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.12] px-2 py-0.5 text-xs font-medium text-emerald-600 backdrop-blur-sm">
                  <Trophy className="size-3 opacity-70" />
                  {cat.streakWins} {t('dashboard.done')}
                </span>
              )}
              {cat.editRequestedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                  <Clock className="size-3" />
                  {cat.editRequestedCount} {t('dashboard.pending')}
                </span>
              )}
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('entry.noEntries')}</p>
              <p className="mt-0 max-h-0 overflow-hidden text-xs italic text-[var(--color-text-secondary)] opacity-0 transition-all duration-200 group-hover:mt-2 group-hover:max-h-12 group-hover:opacity-100">
                {t('entry.createFirstEntry')}
              </p>
            </>
          )}

          {cat.lastActivity && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Last: {relativeTime(cat.lastActivity, language)}</p>
          )}
        </div>

        {hasEntries && (
          <ChevronRight className="mt-1 size-5 shrink-0 text-[var(--color-text-muted)] transition-all duration-200 group-hover:translate-x-1 group-hover:text-[var(--color-text-secondary)]" />
        )}
      </Link>

      {/* Bottom: Action buttons */}
      <div className="mt-4 flex items-center gap-2 pl-16">
        {hasEntries ? (
          <>
            <Link
              href={cat.href}
              className="inline-flex h-8 items-center rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-bg)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-input-border)] hover:bg-[var(--color-dropdown-hover)] active:scale-[0.97]"
            >
              {t('dashboard.viewAll')}
            </Link>
            <Link
              href={cat.newHref}
              className={`inline-flex h-8 items-center gap-1 rounded-lg ${color.buttonBg} px-3 text-sm font-medium text-white transition-all ${color.buttonHover} active:scale-[0.97]`}
            >
              <Plus className="size-3.5" />
              {t('entry.newEntry')}
            </Link>
          </>
        ) : (
          <Link
            href={cat.newHref}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--color-button-primary-bg)] px-3 text-sm font-medium text-white transition-all hover:bg-[var(--color-button-primary-hover)] active:scale-[0.97]"
          >
            <Plus className="size-3.5" />
            {t('dashboard.createFirst')}
          </Link>
        )}
      </div>
    </div>
  );
});

// ── Main Component ─────────────────────────────────────────────────
export default function DataEntryClient({ greeting, userName, categories, totals }: Props) {
  const { t } = useTranslation();
  const sorted = useMemo(() => sortByUrgency(categories), [categories]);
  const hasAnyEntries = totals.totalEntries > 0;
  const firstName = userName?.split(" ")[0] ?? null;
  const actionItems = totals.draftCount + totals.streakActivatedCount + totals.editRequestedCount;

  const statusText = !hasAnyEntries
    ? t('dashboard.startDocumenting')
    : actionItems > 0
      ? `${actionItems} ${actionItems === 1 ? t('dashboard.itemNeedsAttention') : t('dashboard.itemsNeedAttention')}`
      : t('dashboard.allCaughtUp');

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header — matches dashboard style */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 animate-fade-in-up">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{statusText}</p>
        </div>

        {hasAnyEntries && (totals.streakActivatedCount > 0 || totals.streakWinsCount > 0) && (
          <div className="inline-flex items-center gap-2">
            {totals.streakActivatedCount > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/[0.12] px-3 py-1.5 backdrop-blur-md shadow-[0_1px_3px_rgba(245,158,11,0.08)]">
                <Flame className="size-3.5 text-amber-600 opacity-70" />
                <span className="text-sm font-medium text-amber-600">{totals.streakActivatedCount}</span>
                <span className="text-xs text-amber-600/70">{t('dashboard.active')}</span>
              </div>
            )}
            {totals.streakWinsCount > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.12] px-3 py-1.5 backdrop-blur-md shadow-[0_1px_3px_rgba(16,185,129,0.08)]">
                <Trophy className="size-3.5 text-emerald-600 opacity-70" />
                <span className="text-sm font-medium text-emerald-600">{totals.streakWinsCount}</span>
                <span className="text-xs text-emerald-600/70">{totals.streakWinsCount === 1 ? t('dashboard.win') : t('dashboard.wins')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category cards — 2 column grid matching admin console */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {sorted.map((cat, index) => (
          <CategoryCard key={cat.slug} cat={cat} index={index} />
        ))}
      </div>

      {/* Empty state — matches dashboard empty state */}
      {!hasAnyEntries && (
        <div className="mt-8 rounded-xl border border-dashed border-[var(--color-input-border)] bg-[var(--color-body-bg)] p-8 text-center animate-fade-in-up stagger-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--color-dropdown-hover)]">
            <FileText className="size-8 text-[var(--color-text-secondary)]" />
          </div>
          <p className="mt-3 text-base font-medium text-[var(--color-text-secondary)]">{t('dashboard.chooseCategory')}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('dashboard.trackActivities')}</p>
        </div>
      )}
    </div>
  );
}
