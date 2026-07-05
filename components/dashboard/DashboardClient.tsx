"use client";

import { useEffect, useCallback, useState, useMemo } from "react";
import Link from "next/link";
import {
  FileCheck,
  ArrowUpRight,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  Unlock,
} from "lucide-react";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { categoryLabel } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import { getCategoryConfig, CATEGORY_GROUP_ORDER, CATEGORY_LIST, type CategoryGroup } from "@/data/categoryRegistry";
import { getCategoryIcon } from "@/lib/ui/categoryIcons";
import type { CategoryKey } from "@/lib/entries/types";
import type { TranslationKey, Language } from "@/lib/i18n";
import { entryList } from "@/lib/entryNavigation";
import "@/lib/theme/themeTokens";

/*
  ───────────────────────────────────────────────────────
   DASHBOARD CLIENT — Master-Detail Navigator.

   ZONES (each visually distinct):
   - Tab bar: White active pill on dark strip
   - Category list: Dark card, colored active states
   - Detail panel: Accent-colored header gradient,
     white stat cards, colored insets
   - Recent activity: Dark inset with colored dots

   Rule: category accent colors are STRUCTURAL.
   They define surfaces, not just icons.
  ───────────────────────────────────────────────────────
*/

type CategorySummary = {
  slug: string;
  totalEntries: number;
  draftCount: number;
  generatedCount: number;
  editRequestedCount: number;
  editGrantedCount: number;
};

type RecentEntry = {
  id: string;
  categoryKey: string;
  categoryLabel: string;
  title: string;
  status: string;
  updatedAtISO: string | null;
  route: string;
};

type GroupKey = "all" | CategoryGroup;

// Display names for the registry-driven clubs. Adding a club = one entry in
// CATEGORY_GROUP_ORDER (registry) + one labelKey here + i18n keys.
const GROUP_LABEL_KEYS: Record<CategoryGroup, TranslationKey> = {
  professional: "dashboard.groupProfessionalDev",
  academic: "dashboard.groupAcademicActivities",
  research: "dashboard.groupResearch",
};

function slugsOfGroup(group: CategoryGroup): string[] {
  return CATEGORY_LIST.filter((slug) => getCategoryConfig(slug).group === group);
}

export default function DashboardClient({
  categories,
  recentEntries,
}: {
  categories: CategorySummary[];
  recentEntries: RecentEntry[];
}) {
  const { t, language } = useTranslation();

  const [activeGroup, setActiveGroup] = useState<GroupKey>("all");
  const [activeSlug, setActiveSlug] = useState<string>(categories[0]?.slug ?? "");

  const filteredCategories = useMemo(() => {
    if (activeGroup === "all") return categories;
    const slugs = slugsOfGroup(activeGroup);
    return categories.filter((c) => slugs.includes(c.slug));
  }, [activeGroup, categories]);

  // Derive the effective active slug — if current selection isn't in filtered list, fall back
  const effectiveSlug = filteredCategories.some((c) => c.slug === activeSlug)
    ? activeSlug
    : (filteredCategories[0]?.slug ?? activeSlug);

  const activeCat = categories.find((c) => c.slug === effectiveSlug) ?? categories[0];

  const activeCategoryRecent = useMemo(
    () => recentEntries.filter((e) => e.categoryKey === effectiveSlug).slice(0, 4),
    [recentEntries, effectiveSlug]
  );

  const handleKeyNav = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= filteredCategories.length) {
        const cat = filteredCategories[num - 1];
        if (cat) setActiveSlug(cat.slug);
      }
    },
    [filteredCategories]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyNav);
    return () => window.removeEventListener("keydown", handleKeyNav);
  }, [handleKeyNav]);

  // Registry-driven clubs: a tab appears for every group that has at least
  // one category on this dashboard — new clubs surface automatically.
  const groupTabs: { key: GroupKey; labelKey: TranslationKey; count: number }[] = [
    { key: "all", labelKey: "dashboard.categoriesLabel", count: categories.length },
    ...CATEGORY_GROUP_ORDER.map((group) => ({
      key: group as GroupKey,
      labelKey: GROUP_LABEL_KEYS[group],
      count: categories.filter((c) => slugsOfGroup(group).includes(c.slug)).length,
    })).filter((tab) => tab.count > 0),
  ];

  return (
    <div className="relative space-y-7">

      {/* ── Segmented tab bar ── */}
      <div className="flex items-center gap-5">
        <div className="inline-flex items-center gap-1.5 rounded-[15px] bg-[var(--color-glass-bg)] backdrop-blur-md border border-[var(--color-border-subtle)] p-1.5">
          {groupTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveGroup(tab.key)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-[13px] font-semibold tracking-wide transition-all duration-200 active:scale-95",
                activeGroup === tab.key
                  ? "bg-[var(--color-button-primary-bg)] text-[var(--color-button-primary-text)] shadow-md"
                  : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)]"
              )}
            >
              {t(tab.labelKey)}
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  activeGroup === tab.key
                    ? "bg-[var(--color-surface-on-accent)] text-[var(--color-text-on-accent-muted)]"
                    : "bg-[var(--color-border-subtle)] text-[var(--color-text-placeholder)]"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 h-px bg-[var(--color-divider)]" />
      </div>

      {/* ── Master-Detail Layout ── */}
      <ErrorBoundary section="Dashboard navigator">
        <div
          className="rounded-3xl p-5 lg:p-6 backdrop-blur-xl"
          style={{
            backgroundColor: "var(--color-glass-bg)",
            border: "1px solid var(--color-border-default)",
            boxShadow: "0 1px 2px rgba(30,40,90,0.04), 0 10px 22px -18px rgba(30,40,90,0.12), inset 0 1px 0 rgba(255,255,255,0.6)",
          }}
        >
        <div className="flex flex-col gap-6 lg:flex-row">

          {/* ═══ LEFT: Category list ═══
               Scrollable rail (2026-07): the category set keeps growing, so
               the list caps its height and scrolls instead of stretching the
               whole page — a bottom fade signals there is more below. */}
          <div className="lg:w-80 xl:w-[360px] shrink-0 animate-card-lift relative">
            <div
              className="flex flex-col gap-2.5 lg:max-h-[calc(100vh-260px)] lg:min-h-[420px] lg:overflow-y-auto lg:pr-1.5 lg:pb-6"
              style={{ scrollbarWidth: "thin", scrollbarColor: "var(--color-border-strong) transparent" }}
            >
              {filteredCategories.map((cat, idx) => {
                const isAct = cat.slug === effectiveSlug;
                const config = getCategoryConfig(cat.slug);
                const hex = config.color.chartHex;
                const Icon = getCategoryIcon(config.icon);
                const total = cat.totalEntries;
                const gen = cat.generatedCount;
                const dr = cat.draftCount;
                const done = Math.max(total - gen - dr, 0);
                const pct = (n: number) => (total > 0 ? (n / total) * 100 + "%" : "0%");
                return (
                  <button
                    key={cat.slug}
                    onClick={() => setActiveSlug(cat.slug)}
                    className={cn("group w-full rounded-2xl px-4 py-3.5 text-left transition-all duration-300 will-change-transform active:scale-[0.98] animate-fade-in-up", !isAct && "hover:-translate-y-0.5 hover:bg-[var(--color-surface-inset)]")}
                    style={{ animationDelay: `${idx * 55}ms`, ...(isAct ? { backgroundColor: hex + "12", border: "1px solid " + hex + "33" } : { backgroundColor: "var(--color-surface-panel-tile)", border: "1px solid var(--color-border-default)" }) }}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-3 group-active:scale-95" style={{ backgroundColor: hex, opacity: isAct ? 1 : 0.92 }}>
                        <Icon className="size-[19px]" style={{ color: "var(--color-text-on-accent)" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn("truncate text-[15px] font-bold tracking-[-0.01em]", isAct ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]")}>{categoryLabel(cat.slug, language)}</div>
                        <div className="mt-0.5 font-mono text-xs font-semibold tabular-nums" style={{ color: isAct ? "var(--color-text-secondary)" : "var(--color-text-tertiary)" }}>{total} {total === 1 ? "entry" : "entries"}</div>
                      </div>
                      {isAct ? (
                        <ChevronRight className="size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" style={{ color: hex }} />
                      ) : (
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] font-mono text-[11px] font-bold text-[var(--color-text-muted)]">{idx + 1}</span>
                      )}
                    </div>
                    {isAct && total > 0 && (
                      <div className="mt-3 flex h-1 overflow-hidden rounded-full" style={{ background: "var(--color-surface-inset-deep)" }}>
                        <div style={{ width: pct(gen), background: hex }} />
                        <div style={{ width: pct(dr), background: "var(--color-status-warning)" }} />
                        <div style={{ width: pct(done), background: "var(--color-status-success)" }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            {/* Bottom fade — signals more categories below the fold. */}
            {filteredCategories.length > 6 && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-10 lg:block"
                style={{ background: "linear-gradient(to bottom, transparent, var(--color-surface-panel))" }}
              />
            )}
          </div>

          {/* ═══ RIGHT: Detail panel ═══ */}
          {activeCat && (
            <div className="flex-1 animate-detail-slide" key={effectiveSlug}>
              <CategoryDetailPanel
                cat={activeCat}
                recentEntries={activeCategoryRecent}
                language={language}
              />
            </div>
          )}
        </div>
        </div>
      </ErrorBoundary>
    </div>
  );
}

/*
  ───────────────────────────────────────────────────────
   DETAIL PANEL — Three distinct zones:
   1. Colored header (accent gradient — VISIBLE)
   2. White stat cards (bright, contrasting)
   3. Dark activity inset (recessed)
  ───────────────────────────────────────────────────────
*/
function CategoryDetailPanel({
  cat,
  recentEntries,
  language,
}: {
  cat: CategorySummary;
  recentEntries: RecentEntry[];
  language: Language;
}) {
  const { t } = useTranslation();
  const config = getCategoryConfig(cat.slug);
  const Icon = getCategoryIcon(config.icon);
  const hex = config.color.chartHex;
  const displayCount = useCountUp(cat.totalEntries);
  const isEmpty = cat.totalEntries === 0;
  const { ref, style: tiltStyle, lightStyle, handlers } = useTiltEffect();

  // Tiles map to the entry-list sections; clicking deep-links + scrolls there.
  // Only tiles with entries are shown (Total is always rendered separately).
  const statCards = [
    { label: t("dashboard.generated"), count: cat.generatedCount, color: hex, icon: Sparkles, focus: "generated" },
    { label: t("dashboard.drafts"), count: cat.draftCount, color: "#94a3b8", icon: FileText, focus: "in_the_works" },
    { label: t("dashboard.editRequested"), count: cat.editRequestedCount, color: "#f59e0b", icon: Clock, focus: "under_review" },
    { label: t("dashboard.editGranted"), count: cat.editGrantedCount, color: "#3b82f6", icon: Unlock, focus: "unlocked" },
  ].filter((s) => s.count > 0);
  const listHref = entryList(cat.slug as CategoryKey);

  return (
    <div ref={ref} style={tiltStyle} {...handlers} className="h-full">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border h-full backdrop-blur-xl",
          isEmpty
            ? "border-dashed border-[var(--color-border-subtle)]"
            : "border-[var(--color-border-default)]"
        )}
        style={{
          backgroundColor: "var(--color-glass-bg)",
        }}
      >
        <div style={lightStyle} />

        {/* ── ZONE 1: Colored header — accent gradient, VISIBLE ── */}
        <div
          style={{
            background: `linear-gradient(160deg, ${hex}30 0%, ${hex}10 50%, transparent 80%)`,
          }}
        >
          <div className="h-[3px] animate-bar-draw" style={{ backgroundColor: hex }} />
          <div className="px-7 pt-7 pb-6 sm:px-9 sm:pt-9 sm:pb-7">
            <div className="flex items-center gap-4">
              <div
                className="flex size-14 items-center justify-center rounded-2xl"
                style={{
                  backgroundColor: hex,
                  boxShadow: `0 4px 16px ${hex}40`,
                }}
              >
                {/* eslint-disable-next-line react-hooks/static-components */}
                <Icon className="size-6" style={{ color: "var(--color-text-on-accent)" }} />
              </div>
              <div>
                <h2 className="text-[26px] font-black text-[var(--color-text-primary)] tracking-[-0.025em]">
                  {categoryLabel(cat.slug, language)}
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] font-medium mt-1">
                  {t("dashboard.categoryBreakdown")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ZONE 2: Stat cards — bright white surfaces ── */}
        <div className="px-7 pt-2 sm:px-9">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Hero total — BRIGHTEST card · clicks to the top of the entry list */}
            <Link
              href={listHref}
              aria-label={`${t("dashboard.totalEntries")} — view all entries`}
              className="group/tile block rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
              style={{
                backgroundColor: "var(--color-surface-panel-tile)",
                border: "1px solid var(--color-border-default)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">
                  {t("dashboard.totalEntries")}
                </div>
                <ArrowUpRight className="size-4 text-[var(--color-text-placeholder)] opacity-0 -translate-x-1 transition-all duration-300 group-hover/tile:opacity-100 group-hover/tile:translate-x-0" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-[38px] font-black tracking-tighter text-[var(--color-text-primary)] leading-none">
                  {displayCount}
                </span>
                <span className="text-xs font-medium text-[var(--color-text-placeholder)]">
                  {isEmpty ? "entries" : cat.totalEntries === 1 ? "entry" : "entries"}
                </span>
              </div>
            </Link>

            {/* Stat tiles — each links to its matching entry-list section */}
            {statCards.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <Link
                  key={stat.label}
                  href={`${listHref}?focus=${stat.focus}`}
                  aria-label={`${stat.count} ${stat.label} — jump to section`}
                  className="group/tile block rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
                  style={{
                    backgroundColor: "var(--color-surface-panel-tile)",
                    border: `1px solid ${stat.color}35`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex size-10 items-center justify-center rounded-xl transition-transform duration-300 group-hover/tile:scale-110 group-hover/tile:-rotate-3"
                      style={{ backgroundColor: stat.color }}
                    >
                      <StatIcon className="size-[18px] text-[var(--color-text-on-accent)]" />
                    </div>
                    <ArrowUpRight className="size-4 opacity-0 -translate-x-1 transition-all duration-300 group-hover/tile:opacity-100 group-hover/tile:translate-x-0" style={{ color: stat.color }} />
                  </div>
                  <div className="mt-4">
                    <span className="font-mono text-2xl font-black tracking-tighter" style={{ color: stat.color }}>
                      {stat.count}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    {stat.label}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── ZONE 3: Recent activity — DARK inset (contrast!) ── */}
        <div className="px-7 pt-6 sm:px-9">
          {recentEntries.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: "var(--color-surface-panel-tile)",
                border: "1px solid var(--color-border-default)",
              }}
            >
              <div
                className="h-[2px] opacity-60"
                style={{ backgroundColor: hex }}
              />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <FileCheck className="size-4 text-[var(--color-icon-muted)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[var(--color-text-placeholder)]">
                    {t("dashboard.recentActivity")}
                  </span>
                  <div className="flex-1 h-px bg-[var(--color-divider)]" />
                </div>
                <div className="space-y-0.5">
                  {recentEntries.map((entry) => (
                    <Link
                      key={entry.id}
                      href={entry.route}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 transition-all duration-200 hover:translate-x-1 hover:bg-[var(--color-surface-raised)] active:scale-[0.99] group"
                    >
                      <div className={cn("size-2.5 rounded-full shrink-0", getStatusColor(entry.status))} />
                      <span className="truncate text-[13px] font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                        {entry.title}
                      </span>
                      {entry.updatedAtISO && (
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--color-text-tertiary)]">
                          {formatRelativeTime(entry.updatedAtISO)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-7 pb-7 pt-6 sm:px-9 sm:pb-9">
          <div className="flex items-center justify-end border-t border-[var(--color-divider)] pt-5">
            <Link
              href={listHref}
              className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-on-accent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
              style={{
                backgroundColor: hex,
                boxShadow: `0 4px 20px ${hex}35`,
              }}
            >
              {isEmpty ? "Start entering data" : t("dashboard.viewAll")}
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ── Helpers ── */

function getStatusColor(status: string): string {
  switch (status) {
    case "DRAFT": return "bg-[var(--color-text-tertiary)]";
    case "GENERATED": return "bg-[var(--color-primary)]";
    case "EDIT_REQUESTED": return "bg-[var(--color-status-warning)]";
    case "EDIT_GRANTED": return "bg-[var(--color-status-info)]";
    case "DELETE_REQUESTED": return "bg-[var(--color-status-error)]";
    default: return "bg-[var(--color-text-tertiary)]";
  }
}

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) return "";

  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return `${Math.floor(diffDays / 7)}w`;
}
