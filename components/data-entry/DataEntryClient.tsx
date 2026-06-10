"use client";

import Link from "next/link";
import { memo, useMemo } from "react";
import {
  ArrowUpRight,
  FileText,
  Flame,
  Plus,
  Trophy,
} from "lucide-react";
import { getCategoryConfig } from "@/data/categoryRegistry";
import { CategoryIcon } from "@/lib/ui/categoryIcons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { formatRelativeTime } from "@/lib/i18n/relativeTime";
import { type CategoryOverview, type Totals } from "./dataEntryTypes";

/*
  ─────────────────────────────────────────────────────────
   BENTO DASHBOARD — ported from dashboard CategoryCard DNA

   Each category card has:
   - NOTCH_CLIP (corner notch on top-right)
   - Color bleed gradient (accent into dark card)
   - Corner notch triangle (accent colored)
   - Thick left accent bar
   - Icon in a PILL (rounded-full with border)
   - BRIGHT counter panel (accent-tinted via color-mix)
   - DARK MICRO-PILLS inside bright panel (3 depth levels)

   Hero card gets full-width treatment.
   Standard cards get a 2-col grid.
   Empty cards get dashed borders, no clip.

   Surface depth:
   L0: Page bg
   L1: Card bg (dark, rgba(0,0,0,0.30))
   L2: Bright counter panel (color-mix(in srgb, ${hex} 6%, ...))
   L3: Dark micro-pills inside bright panel (rgba(0,0,0,0.4))
  ─────────────────────────────────────────────────────────
*/

const NOTCH_CLIP = "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)";

const ACCENT_HEX: Record<string, string> = {
  "fdp-attended": "#3b82f6",
  "fdp-conducted": "#10b981",
  "guest-lectures": "#f59e0b",
  "case-studies": "#a855f7",
  "workshops": "#f43f5e",
};

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

/* ── DARK MICRO-PILLS (L3 — dark inside bright panel = depth) ── */
function MicroPills({ cat }: { cat: CategoryOverview }) {
  const pills: { label: string; count: number; className: string }[] = [];
  if (cat.draftCount > 0) pills.push({ label: "DRF", count: cat.draftCount, className: "text-[var(--color-text-placeholder)] bg-[var(--color-surface-inset-deep)]" });
  if (cat.editRequestedCount > 0) pills.push({ label: "REQ", count: cat.editRequestedCount, className: "text-amber-400 bg-amber-400/10" });
  if (cat.editGrantedCount > 0) pills.push({ label: "EDT", count: cat.editGrantedCount, className: "text-[var(--color-primary)] bg-[var(--color-primary)]/10" });

  if (pills.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 items-end">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[9px] font-bold border border-[var(--color-border-subtle)]",
            pill.className
          )}
        >
          {pill.count}
          <span className="text-[7px] uppercase tracking-wider opacity-60">{pill.label}</span>
        </span>
      ))}
    </div>
  );
}

/* ── Mini Distribution Bar ── */
function MiniDistributionBar({ cat }: { cat: CategoryOverview }) {
  const total = cat.totalEntries;
  if (total === 0) return null;

  const segments = [
    { count: cat.draftCount, color: "var(--color-divider)" },
    { count: cat.streakActivated, color: "#fbbf24" },
    { count: cat.editRequestedCount, color: "#fb923c" },
    { count: cat.streakWins + cat.completedNonStreak, color: "#84cc16" },
  ].filter(s => s.count > 0);

  if (segments.length < 2) return null;

  return (
    <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full" style={{ background: "var(--color-surface-inset-deep)" }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="h-full transition-all duration-500"
          style={{
            width: `${(seg.count / total) * 100}%`,
            background: seg.color,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

/* ═══ HERO CARD — full width, NOTCH_CLIP, 3-depth surfaces ═══ */
const HeroCard = memo(function HeroCard({ cat }: { cat: CategoryOverview }) {
  const { t, language, categoryLabel } = useTranslation();
  const config = getCategoryConfig(cat.slug);
  const hex = ACCENT_HEX[cat.slug] ?? config.color.chartHex;

  return (
    <div className="group relative animate-fade-in-up">
      <Link
        href={cat.href}
        className="relative flex overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] transition-all duration-300 hover:-translate-y-1"
        style={{
          background: "var(--color-card-bg)",
          clipPath: NOTCH_CLIP,
        }}
      >
        {/* Color bleed gradient — VISIBLE */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to right, ${hex}20 0%, ${hex}0a 35%, transparent 65%)`,
            borderRadius: "inherit",
          }}
        />

        {/* Corner notch accent triangle */}
        <div
          className="absolute top-0 right-0 size-[24px] opacity-40"
          style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)", backgroundColor: hex }}
        />

        {/* Thick left accent bar */}
        <div
          className="w-2.5 shrink-0"
          style={{
            background: `linear-gradient(180deg, ${hex} 0%, ${hex}60 100%)`,
            boxShadow: `4px 0 20px ${hex}30`,
          }}
        />

        <div className="flex-1 p-6 relative">
          {/* Header: Icon pill + Label */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1"
              style={{
                borderColor: `${hex}30`,
                border: `1px solid ${hex}30`,
                backgroundColor: `${hex}15`,
              }}
            >
              <div
                className="flex size-8 items-center justify-center rounded-full"
                style={{ background: `${hex}35`, color: hex }}
              >
                <CategoryIcon name={config.icon} className="size-4" />
              </div>
              <span className="text-sm font-bold text-[var(--color-text-primary)] tracking-tight">{categoryLabel(cat.slug)}</span>
            </div>
            <div className="flex-1" />
            {cat.lastActivity && (
              <span className="text-[11px] text-[var(--color-text-tertiary)]">{formatRelativeTime(cat.lastActivity, language)}</span>
            )}
          </div>

          {/* L2: BRIGHT COUNTER PANEL — VISIBLE brightness */}
          <div
            className="mt-4 overflow-hidden rounded-xl px-4 py-3.5"
            style={{
              backgroundColor: `var(--color-border-default)`,
              border: `1px solid ${hex}25`,
              boxShadow: `inset 0 1px 0 var(--color-border-subtle)`,
            }}
          >
            <div className="flex items-end justify-between">
              <div>
                <span
                  className="font-mono text-4xl font-black tracking-tighter leading-none"
                  style={{ color: hex }}
                >
                  {cat.totalEntries}
                </span>
                <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-placeholder)]">
                  {cat.totalEntries === 1 ? t('dashboard.entry') : t('dashboard.entries')}
                </div>
              </div>

              {/* L3: Dark micro-pills INSIDE bright panel = 3 depths */}
              <MicroPills cat={cat} />
            </div>

            {/* Distribution bar inside the bright panel */}
            <MiniDistributionBar cat={cat} />
          </div>

          {/* Action row */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {cat.streakActivated > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                  <Flame className="size-3" />
                  {cat.streakActivated} {t("dashboard.active")}
                </span>
              )}
              {cat.streakWins > 0 && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
                  <Trophy className="size-3" />
                  {cat.streakWins} {t("dashboard.done")}
                </span>
              )}
            </div>
            <Link
              href={cat.newHref}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--color-text-on-accent)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ background: hex, boxShadow: `0 4px 16px ${hex}25` }}
              onClick={(e) => e.stopPropagation()}
            >
              <Plus className="size-3.5" />
              {t("entry.newEntry")}
            </Link>
          </div>
        </div>
      </Link>

      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
        style={{ boxShadow: `0 12px 48px ${hex}12` }}
      />
    </div>
  );
});

/* ═══ STANDARD CARD — compact, NOTCH_CLIP, 3-depth ═══ */
const StandardCard = memo(function StandardCard({ cat, index }: { cat: CategoryOverview; index: number }) {
  const { t, language, categoryLabel } = useTranslation();
  const config = getCategoryConfig(cat.slug);
  const hex = ACCENT_HEX[cat.slug] ?? config.color.chartHex;
  const hasEntries = cat.totalEntries > 0;

  return (
    <div
      className={cn(
        "group relative animate-fade-in-up",
        hasEntries && "hover:-translate-y-0.5",
        `stagger-${Math.min(index + 1, 5)}`
      )}
    >
      <Link
        href={hasEntries ? cat.href : cat.newHref}
        className={cn(
          "relative flex overflow-hidden rounded-2xl border transition-all duration-300",
          hasEntries
            ? "border-[var(--color-border-subtle)]"
            : "border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)]"
        )}
        style={hasEntries ? {
          background: "var(--color-card-bg)",
          clipPath: NOTCH_CLIP,
        } : undefined}
      >
        {/* Color bleed — VISIBLE */}
        {hasEntries && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(to right, ${hex}18 0%, ${hex}08 35%, transparent 65%)`,
              borderRadius: "inherit",
            }}
          />
        )}

        {/* Corner notch triangle */}
        {hasEntries && (
          <div
            className="absolute top-0 right-0 size-[20px] opacity-35"
            style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)", backgroundColor: hex }}
          />
        )}

        {/* Left accent bar */}
        <div
          className={cn("shrink-0", hasEntries ? "w-1.5" : "w-1")}
          style={{
            background: hasEntries
              ? `linear-gradient(180deg, ${hex} 0%, ${hex}40 100%)`
              : "var(--color-border-subtle)",
          }}
        />

        <div className="flex-1 p-4 relative">
          {/* Header: Icon pill + Label */}
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full pl-0.5 pr-2.5 py-0.5 border",
                !hasEntries && "border-[var(--color-border-subtle)] bg-[var(--color-glass-bg)]"
              )}
              style={hasEntries ? {
                borderColor: `${hex}30`,
                backgroundColor: `${hex}12`,
              } : undefined}
            >
              <div
                className={cn("flex size-6 items-center justify-center rounded-full")}
                style={{ background: hasEntries ? `${hex}30` : "var(--color-border-subtle)", color: hasEntries ? hex : undefined }}
              >
                <CategoryIcon
                  name={config.icon}
                  className={cn("size-3", hasEntries ? "" : "text-[var(--color-text-tertiary)]")}
                />
              </div>
              <span className={cn("text-xs font-bold tracking-tight", hasEntries ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-placeholder)]")}>
                {categoryLabel(cat.slug)}
              </span>
            </div>
          </div>

          {/* L2: Bright counter panel */}
          <div
            className={cn(
              "mt-3 overflow-hidden rounded-xl border px-3.5 py-2.5",
              !hasEntries && "bg-[var(--color-glass-bg)] border-[var(--color-border-subtle)]"
            )}
            style={hasEntries ? {
              backgroundColor: `var(--color-surface-raised)`,
              borderColor: `${hex}22`,
              boxShadow: `inset 0 1px 0 var(--color-border-subtle)`,
            } : undefined}
          >
            <div className="flex items-end justify-between">
              <div>
                <span
                  className="font-mono text-3xl font-black tracking-tighter leading-none"
                  style={{ color: hasEntries ? hex : "var(--color-text-placeholder)" }}
                >
                  {cat.totalEntries}
                </span>
                <div className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.25em] text-[var(--color-text-placeholder)]">
                  {hasEntries ? (cat.totalEntries === 1 ? t('dashboard.entry') : t('dashboard.entries')) : t('dashboard.entries')}
                </div>
              </div>

              {/* L3: Dark micro-pills */}
              {hasEntries && <MicroPills cat={cat} />}
            </div>

            {/* Distribution bar */}
            {hasEntries && <MiniDistributionBar cat={cat} />}
          </div>

          {/* Footer */}
          <div className="mt-2.5 flex items-center justify-between">
            {hasEntries ? (
              <>
                {cat.lastActivity ? (
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">{formatRelativeTime(cat.lastActivity, language)}</span>
                ) : <span />}
                <Link
                  href={cat.newHref}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-text-placeholder)] hover:text-[var(--color-text-secondary)] transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Plus className="size-3" />
                  {t("entry.newEntry")}
                </Link>
              </>
            ) : (
              <span className={cn("inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em]", config.color.cta)}>
                {t('dashboard.createFirst')}
                <ArrowUpRight className="size-3" />
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Hover glow */}
      {hasEntries && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
          style={{ boxShadow: `0 8px 32px ${hex}08` }}
        />
      )}
    </div>
  );
});

/* ═══ MAIN COMPONENT ═══ */
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

  // Split: first card with entries = hero, rest = grid
  const heroCategory = sorted.find(c => c.totalEntries > 0);
  const gridCategories = heroCategory
    ? sorted.filter(c => c.slug !== heroCategory.slug)
    : sorted;

  return (
    <div className="mx-auto w-full max-w-5xl animate-page-enter">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-5 mb-6 animate-fade-in-up">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-placeholder)]">{statusText}</p>
        </div>

        {hasAnyEntries && (totals.streakActivatedCount > 0 || totals.streakWinsCount > 0) && (
          <div className="inline-flex items-center gap-2">
            {totals.streakActivatedCount > 0 && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  background: "rgba(251,191,36,0.06)",
                  border: "1px solid rgba(251,191,36,0.10)",
                }}
              >
                <Flame className="size-3.5 text-amber-400" />
                <span className="text-sm font-medium text-amber-300">{totals.streakActivatedCount}</span>
                <span className="text-xs text-[var(--color-text-placeholder)]">{t("dashboard.active")}</span>
              </div>
            )}
            {totals.streakWinsCount > 0 && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                style={{
                  background: "rgba(132,204,22,0.06)",
                  border: "1px solid rgba(132,204,22,0.10)",
                }}
              >
                <Trophy className="size-3.5 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">{totals.streakWinsCount}</span>
                <span className="text-xs text-[var(--color-text-placeholder)]">{totals.streakWinsCount === 1 ? t("dashboard.win") : t("dashboard.wins")}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Hero Category ─── */}
      {heroCategory && (
        <div className="mb-4">
          <HeroCard cat={heroCategory} />
        </div>
      )}

      {/* ─── Grid Categories ─── */}
      {gridCategories.length > 0 && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          {gridCategories.map((cat, index) => (
            <StandardCard key={cat.slug} cat={cat} index={index} />
          ))}
        </div>
      )}

      {/* ─── Empty State ─── */}
      {!hasAnyEntries && (
        <div
          className="mt-8 rounded-2xl p-10 text-center animate-fade-in-up stagger-3"
          style={{
            background: "var(--color-glass-bg)",
            border: "1px dashed var(--color-border-default)",
          }}
        >
          <div
            className="mx-auto flex size-14 items-center justify-center rounded-xl"
            style={{ background: "var(--color-surface-raised)" }}
          >
            <FileText className="size-7 text-[var(--color-text-placeholder)]" />
          </div>
          <p className="mt-4 text-base font-medium text-[var(--color-text-placeholder)]">{t("dashboard.chooseCategory")}</p>
          <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{t("dashboard.trackActivities")}</p>
        </div>
      )}
    </div>
  );
}
