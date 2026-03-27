"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import {
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

  const pills = useMemo(() => {
    const items: { icon: typeof Pencil; label: string; className: string }[] = [];
    if (cat.draftCount > 0) items.push({ icon: Pencil, label: `${cat.draftCount} ${cat.draftCount === 1 ? t("dashboard.draft") : t("dashboard.drafts")}`, className: "bg-[var(--color-text-muted)]/[0.08] text-[var(--color-text-secondary)]" });
    if (cat.streakActivated > 0) items.push({ icon: Flame, label: `${cat.streakActivated} ${t("dashboard.active")}`, className: "bg-amber-500/[0.08] text-amber-600" });
    if (cat.streakWins > 0) items.push({ icon: Trophy, label: `${cat.streakWins} ${t("dashboard.done")}`, className: "bg-emerald-500/[0.08] text-emerald-600" });
    if (cat.editRequestedCount > 0) items.push({ icon: Clock, label: `${cat.editRequestedCount} ${t("dashboard.pending")}`, className: "bg-orange-500/[0.08] text-orange-600" });
    return items;
  }, [cat.draftCount, cat.streakActivated, cat.streakWins, cat.editRequestedCount, t]);

  return (
    <div
      className={cn(
        "group relative rounded-2xl p-5 transition-all duration-200 animate-fade-in-up",
        hasEntries
          ? "border border-[var(--color-card-border)] bg-[var(--color-card-bg)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] hover:border-[var(--color-text-muted)]/30"
          : "border border-dashed border-[var(--color-card-border)] bg-[var(--color-body-bg)]",
        `stagger-${Math.min(index + 1, 5)}`
      )}
    >
      {/* Top row: Icon + Title + Entry count */}
      <Link href={hasEntries ? cat.href : cat.newHref} className="flex items-start gap-3.5">
        <div className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105",
          hasEntries ? color.accentBg : "bg-[var(--color-dropdown-hover)]"
        )}>
          <CategoryIcon name={config.icon} className={cn("size-5", hasEntries ? `${color.text} opacity-80` : "text-[var(--color-text-secondary)]")} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className={cn(
              "text-base font-semibold",
              hasEntries ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]"
            )}>
              {categoryLabel(cat.slug)}
            </h3>
            {hasEntries && (
              <span className="shrink-0 text-sm text-[var(--color-text-muted)]">
                {cat.totalEntries} {cat.totalEntries === 1 ? t("dashboard.entry") : t("dashboard.entries")}
              </span>
            )}
          </div>

          {hasEntries ? (
            <>
              {cat.lastActivity && (
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {relativeTime(cat.lastActivity, language)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{t("entry.noEntries")}</p>
          )}
        </div>
      </Link>

      {/* Stat pills + action */}
      <div className="mt-4 flex items-center justify-between gap-3 pl-[3.25rem]">
        {hasEntries ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {pills.map((pill) => {
                const PillIcon = pill.icon;
                return (
                  <span key={pill.label} className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium", pill.className)}>
                    <PillIcon className="size-2.5" />
                    {pill.label}
                  </span>
                );
              })}
            </div>
            <Link
              href={cat.newHref}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              <Plus className="size-3.5" />
              {t("entry.newEntry")}
            </Link>
          </>
        ) : (
          <Link
            href={cat.newHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-button-primary-bg)] px-3 py-1.5 text-sm font-medium text-white transition-all hover:bg-[var(--color-button-primary-hover)] active:scale-[0.97]"
          >
            <Plus className="size-3.5" />
            {t("dashboard.createFirst")}
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
    ? t("dashboard.startDocumenting")
    : actionItems > 0
      ? `${actionItems} ${actionItems === 1 ? t("dashboard.itemNeedsAttention") : t("dashboard.itemsNeedAttention")}`
      : t("dashboard.allCaughtUp");

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-divider)] pb-5 mb-6 animate-fade-in-up">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{statusText}</p>
        </div>

        {hasAnyEntries && (totals.streakActivatedCount > 0 || totals.streakWinsCount > 0) && (
          <div className="inline-flex items-center gap-2">
            {totals.streakActivatedCount > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/15 bg-amber-500/[0.08] px-3 py-1.5 backdrop-blur-sm">
                <Flame className="size-3.5 text-amber-500 opacity-70" />
                <span className="text-sm font-medium text-amber-600">{totals.streakActivatedCount}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{t("dashboard.active")}</span>
              </div>
            )}
            {totals.streakWinsCount > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-1.5 backdrop-blur-sm">
                <Trophy className="size-3.5 text-emerald-500 opacity-70" />
                <span className="text-sm font-medium text-emerald-600">{totals.streakWinsCount}</span>
                <span className="text-xs text-[var(--color-text-muted)]">{totals.streakWinsCount === 1 ? t("dashboard.win") : t("dashboard.wins")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Category Cards ─── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {sorted.map((cat, index) => (
          <CategoryCard key={cat.slug} cat={cat} index={index} />
        ))}
      </div>

      {/* ─── Empty State ─── */}
      {!hasAnyEntries && (
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--color-card-border)] bg-[var(--color-body-bg)] p-10 text-center animate-fade-in-up stagger-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-[var(--color-dropdown-hover)]">
            <FileText className="size-7 text-[var(--color-text-secondary)]" />
          </div>
          <p className="mt-4 text-base font-medium text-[var(--color-text-secondary)]">{t("dashboard.chooseCategory")}</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t("dashboard.trackActivities")}</p>
        </div>
      )}
    </div>
  );
}
