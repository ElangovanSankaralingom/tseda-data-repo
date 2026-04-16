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
} from "lucide-react";
import CursorGlow from "@/components/dashboard/CursorGlow";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { categoryLabel } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import { useTiltEffect } from "@/hooks/useTiltEffect";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { getCategoryIcon } from "@/lib/ui/categoryIcons";
import type { CategoryKey } from "@/lib/entries/types";
import type { TranslationKey, Language } from "@/lib/i18n";
import { entryList } from "@/lib/entryNavigation";

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

type GroupKey = "all" | "professional" | "academic";

const GROUPS: Record<GroupKey, string[]> = {
  all: [],
  professional: ["fdp-attended", "fdp-conducted"],
  academic: ["case-studies", "guest-lectures", "workshops"],
};

const ACCENT_HEX: Record<string, string> = {
  "fdp-attended": "#3b82f6",
  "fdp-conducted": "#10b981",
  "guest-lectures": "#f59e0b",
  "case-studies": "#a855f7",
  "workshops": "#f43f5e",
};

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
    const slugs = GROUPS[activeGroup];
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

  const profCount = categories.filter((c) => GROUPS.professional.includes(c.slug)).length;
  const acadCount = categories.filter((c) => GROUPS.academic.includes(c.slug)).length;

  const groupTabs: { key: GroupKey; labelKey: TranslationKey; count: number }[] = [
    { key: "all", labelKey: "dashboard.categoriesLabel", count: categories.length },
    { key: "professional", labelKey: "dashboard.groupProfessionalDev", count: profCount },
    { key: "academic", labelKey: "dashboard.groupAcademicActivities", count: acadCount },
  ];

  return (
    <div className="relative space-y-7">
      <CursorGlow />

      {/* ── Segmented tab bar ── */}
      <div className="flex items-center gap-5">
        <div className="inline-flex items-center gap-1 rounded-2xl bg-[rgba(0,0,0,0.4)] border border-white/[0.08] p-1.5">
          {groupTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveGroup(tab.key)}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-xs font-semibold tracking-wide transition-all duration-300",
                activeGroup === tab.key
                  ? "bg-white text-[rgba(0,0,0,0.85)] shadow-md"
                  : "text-[rgba(255,255,255,0.5)] hover:text-[rgba(255,255,255,0.8)] hover:bg-white/[0.06]"
              )}
            >
              {t(tab.labelKey)}
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  activeGroup === tab.key
                    ? "bg-[rgba(0,0,0,0.08)] text-[rgba(0,0,0,0.55)]"
                    : "bg-white/[0.08] text-[rgba(255,255,255,0.4)]"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      {/* ── Master-Detail Layout ── */}
      <ErrorBoundary section="Dashboard navigator">
        <div
          className="rounded-3xl p-5 lg:p-6"
          style={{
            backgroundColor: "#0e1019",
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
        <div className="flex flex-col gap-6 lg:flex-row">

          {/* ═══ LEFT: Category list ═══ */}
          <div className="lg:w-80 xl:w-[360px] shrink-0 animate-card-lift">
            <div className="flex">
              {/* ── Circuit trunk line + nodes ── */}
              <div className="relative flex flex-col items-center mr-4 shrink-0" style={{ width: "20px" }}>
                <div className="absolute top-5 bottom-5 w-px bg-white/[0.08] animate-spine-draw" />
                {filteredCategories.map((cat) => {
                  const isAct = cat.slug === effectiveSlug;
                  const hex = ACCENT_HEX[cat.slug] ?? "#ffffff";
                  return (
                    <div key={cat.slug} className="flex-1 flex items-center justify-center relative">
                      <div
                        className="absolute left-[10px] h-px transition-all duration-300"
                        style={{
                          width: "14px",
                          backgroundColor: isAct ? hex : "rgba(255,255,255,0.08)",
                        }}
                      />
                      <div
                        className={cn(
                          "relative size-[9px] rounded-full border-2 transition-all duration-300 z-10",
                          isAct ? "scale-125" : "border-[rgba(255,255,255,0.15)] bg-[rgba(0,0,0,0.5)]"
                        )}
                        style={isAct ? {
                          backgroundColor: hex,
                          borderColor: hex,
                          boxShadow: `0 0 10px ${hex}60`,
                        } : undefined}
                      />
                    </div>
                  );
                })}
              </div>

              {/* ── Category rows ── */}
              <div className="flex-1 space-y-2">
                {filteredCategories.map((cat, idx) => {
                  const isAct = cat.slug === effectiveSlug;
                  const hex = ACCENT_HEX[cat.slug] ?? "#ffffff";
                  const config = getCategoryConfig(cat.slug);
                  const Icon = getCategoryIcon(config.icon);

                  return (
                    <button
                      key={cat.slug}
                      onClick={() => setActiveSlug(cat.slug)}
                      className={cn(
                        "group relative flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-300 animate-fade-in-up",
                        isAct
                          ? "text-white"
                          : "hover:brightness-125"
                      )}
                      style={{
                        animationDelay: `${idx * 80}ms`,
                        ...(isAct ? {
                          backgroundColor: `${hex}35`,
                          border: `1px solid ${hex}60`,
                          boxShadow: `inset 3px 0 0 ${hex}, 0 4px 16px ${hex}20`,
                        } : {
                          backgroundColor: "#141620",
                          border: "1px solid rgba(255,255,255,0.14)",
                        }),
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: isAct ? hex : "#1c1e2a",
                        }}
                      >
                        <Icon
                          className="size-[18px]"
                          style={{ color: isAct ? "#fff" : "rgba(255,255,255,0.4)" }}
                        />
                      </div>

                      {/* Label + meta */}
                      <div className="min-w-0 flex-1">
                        <div
                          className={cn(
                            "truncate text-sm font-semibold leading-snug",
                            isAct ? "text-white" : "text-[rgba(255,255,255,0.65)]"
                          )}
                        >
                          {categoryLabel(cat.slug, language)}
                        </div>
                        <div className="flex items-center gap-2.5 mt-1">
                          <span
                            className="font-mono text-xs font-bold"
                            style={{ color: isAct ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)" }}
                          >
                            {cat.totalEntries} {cat.totalEntries === 1 ? "entry" : "entries"}
                          </span>
                          {cat.draftCount > 0 && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                              style={{
                                backgroundColor: isAct ? "rgba(255,255,255,0.15)" : "#1c1e2a",
                                color: isAct ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)",
                              }}
                            >
                              {cat.draftCount} Draft
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Keyboard badge + chevron */}
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "flex size-6 items-center justify-center rounded-lg font-mono text-[11px] font-bold border",
                          isAct
                            ? "text-white/60 border-white/[0.2] bg-white/[0.1]"
                            : "text-white/30 border-white/[0.08] bg-[#1c1e2a]"
                        )}>
                          {idx + 1}
                        </span>
                        <ChevronRight
                          className={cn(
                            "size-4 transition-all duration-300",
                            isAct ? "text-white/50" : "text-white/10 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                          )}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

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
  const hex = ACCENT_HEX[cat.slug] ?? "#ffffff";
  const displayCount = useCountUp(cat.totalEntries);
  const isEmpty = cat.totalEntries === 0;
  const { ref, style: tiltStyle, lightStyle, handlers } = useTiltEffect();

  const statCards = [
    { label: t("dashboard.generated"), count: cat.generatedCount, color: hex, icon: Sparkles },
    { label: t("dashboard.drafts"), count: cat.draftCount, color: "#94a3b8", icon: FileText },
    { label: t("dashboard.editRequested"), count: cat.editRequestedCount, color: "#f59e0b", icon: Clock },
  ].filter((s) => s.count > 0 || s.label === t("dashboard.generated"));

  return (
    <div ref={ref} style={tiltStyle} {...handlers} className="h-full">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border h-full",
          isEmpty
            ? "border-dashed border-white/[0.08]"
            : "border-white/[0.1]"
        )}
        style={{
          backgroundColor: isEmpty ? "#0c0d14" : "#10121c",
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
                <Icon className="size-6" style={{ color: "#fff" }} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {categoryLabel(cat.slug, language)}
                </h2>
                <p className="text-xs text-[rgba(255,255,255,0.5)] font-medium mt-1">
                  {t("dashboard.categoryBreakdown")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── ZONE 2: Stat cards — bright white surfaces ── */}
        <div className="px-7 pt-2 sm:px-9">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Hero total — BRIGHTEST card */}
            <div
              className="rounded-2xl p-6"
              style={{
                backgroundColor: "#161826",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div className="text-[11px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.55)]">
                {t("dashboard.totalEntries")}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-black tracking-tighter text-white leading-none">
                  {displayCount}
                </span>
                <span className="text-xs font-medium text-[rgba(255,255,255,0.4)]">
                  {isEmpty ? "entries" : cat.totalEntries === 1 ? "entry" : "entries"}
                </span>
              </div>
            </div>

            {/* Stat cards — each tinted with its own color */}
            {statCards.map((stat) => {
              const StatIcon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="rounded-2xl p-6 transition-all duration-300"
                  style={{
                    backgroundColor: "#161826",
                    border: `1px solid ${stat.color}35`,
                  }}
                >
                  <div
                    className="flex size-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: stat.color,
                    }}
                  >
                    <StatIcon className="size-[18px] text-white" />
                  </div>
                  <div className="mt-4">
                    <span className="font-mono text-2xl font-black tracking-tighter" style={{ color: stat.color }}>
                      {stat.count}
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11px] font-semibold text-[rgba(255,255,255,0.5)]">
                    {stat.label}
                  </div>
                </div>
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
                backgroundColor: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              <div
                className="h-[2px] opacity-60"
                style={{ backgroundColor: hex }}
              />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <FileCheck className="size-4 text-[rgba(255,255,255,0.4)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-[rgba(255,255,255,0.4)]">
                    {t("dashboard.recentActivity")}
                  </span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className="space-y-0.5">
                  {recentEntries.map((entry) => (
                    <Link
                      key={entry.id}
                      href={entry.route}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 -mx-1 transition-colors duration-200 hover:bg-white/[0.06] group"
                    >
                      <div className={cn("size-2.5 rounded-full shrink-0", getStatusColor(entry.status))} />
                      <span className="truncate text-[13px] font-medium text-[rgba(255,255,255,0.6)] group-hover:text-white transition-colors">
                        {entry.title}
                      </span>
                      {entry.updatedAtISO && (
                        <span className="ml-auto shrink-0 font-mono text-[11px] text-[rgba(255,255,255,0.3)]">
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
          <div className="flex items-center justify-between border-t border-white/[0.06] pt-5">
            {!isEmpty && cat.editGrantedCount > 0 ? (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{
                  backgroundColor: "rgba(59,130,246,0.18)",
                  border: "1px solid rgba(59,130,246,0.3)",
                }}
              >
                <span className="font-mono text-sm font-black text-blue-400">{cat.editGrantedCount}</span>
                <span className="text-[11px] font-semibold text-blue-400/60">Edit Granted</span>
              </div>
            ) : <div />}

            <Link
              href={entryList(cat.slug as CategoryKey)}
              className="inline-flex items-center gap-2.5 rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-wider text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.97]"
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
    case "DRAFT": return "bg-[rgba(255,255,255,0.3)]";
    case "GENERATED": return "bg-[var(--color-primary)]";
    case "EDIT_REQUESTED": return "bg-amber-400";
    case "EDIT_GRANTED": return "bg-blue-400";
    case "DELETE_REQUESTED": return "bg-rose-400";
    default: return "bg-[rgba(255,255,255,0.3)]";
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
