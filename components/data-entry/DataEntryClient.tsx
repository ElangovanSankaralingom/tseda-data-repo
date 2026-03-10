"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BookOpen,
  Clock,
  FileText,
  Flame,
  Mic,
  Pencil,
  Plus,
  Presentation,
  Sparkles,
  Trophy,
  Wrench,
} from "lucide-react";
import { type CategoryOverview, type Totals } from "./dataEntryTypes";

type Props = {
  greeting: string;
  userName: string | null;
  categories: CategoryOverview[];
  totals: Totals;
};

// ── Theme per category ─────────────────────────────────────────────
const CATEGORY_THEME: Record<string, {
  icon: typeof BookOpen;
  gradient: string;
  gradientEmpty: string;
  iconColor: string;
  buttonBg: string;
  buttonHover: string;
}> = {
  "fdp-attended": {
    icon: BookOpen,
    gradient: "from-blue-100 to-blue-50",
    gradientEmpty: "from-slate-100 to-slate-50",
    iconColor: "text-blue-500",
    buttonBg: "bg-blue-500",
    buttonHover: "hover:bg-blue-600",
  },
  "fdp-conducted": {
    icon: Presentation,
    gradient: "from-emerald-100 to-emerald-50",
    gradientEmpty: "from-slate-100 to-slate-50",
    iconColor: "text-emerald-500",
    buttonBg: "bg-emerald-500",
    buttonHover: "hover:bg-emerald-600",
  },
  "case-studies": {
    icon: FileText,
    gradient: "from-amber-100 to-amber-50",
    gradientEmpty: "from-slate-100 to-slate-50",
    iconColor: "text-amber-500",
    buttonBg: "bg-amber-500",
    buttonHover: "hover:bg-amber-600",
  },
  "guest-lectures": {
    icon: Mic,
    gradient: "from-purple-100 to-purple-50",
    gradientEmpty: "from-slate-100 to-slate-50",
    iconColor: "text-purple-500",
    buttonBg: "bg-purple-500",
    buttonHover: "hover:bg-purple-600",
  },
  workshops: {
    icon: Wrench,
    gradient: "from-rose-100 to-rose-50",
    gradientEmpty: "from-slate-100 to-slate-50",
    iconColor: "text-rose-500",
    buttonBg: "bg-rose-500",
    buttonHover: "hover:bg-rose-600",
  },
};

const DEFAULT_THEME = CATEGORY_THEME["fdp-attended"]!;

// ── Helpers ────────────────────────────────────────────────────────
function sortByUrgency(categories: CategoryOverview[]): CategoryOverview[] {
  return [...categories].sort((a, b) => {
    const aScore = a.draftCount * 3 + a.editRequestedCount * 2 + a.streakActivated;
    const bScore = b.draftCount * 3 + b.editRequestedCount * 2 + b.streakActivated;
    if (aScore !== bScore) return bScore - aScore;
    if (a.totalEntries !== b.totalEntries) return b.totalEntries - a.totalEntries;
    return 0;
  });
}

function getStatusMessage(totals: Totals): string {
  const { totalEntries, draftCount, streakActivatedCount } = totals;
  if (totalEntries === 0) return "Start documenting your professional development";
  if (draftCount > 0) return `You have ${draftCount} ${draftCount === 1 ? "draft" : "drafts"} to complete`;
  if (streakActivatedCount > 0) return `${streakActivatedCount} streak ${streakActivatedCount === 1 ? "entry needs" : "entries need"} your attention`;
  return "You\u2019re all caught up!";
}

// ── Stat Pill ──────────────────────────────────────────────────────
function StatPill({
  icon: Icon,
  label,
  value,
  className = "text-slate-600 bg-slate-50 border-slate-200",
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  className?: string;
}) {
  if (value === 0) return null;
  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${className}`}>
      <Icon className="size-3.5" />
      <span className="text-sm font-bold">{value}</span>
      <span className="text-xs opacity-75">{label}</span>
    </div>
  );
}

// ── Category Card ──────────────────────────────────────────────────
function CategoryCard({ cat, index }: { cat: CategoryOverview; index: number }) {
  const theme = CATEGORY_THEME[cat.slug] ?? DEFAULT_THEME;
  const Icon = theme.icon;
  const hasEntries = cat.totalEntries > 0;
  const needsAttention = cat.draftCount > 0 || cat.streakActivated > 0 || cat.editRequestedCount > 0;
  const actionableCount = cat.draftCount + cat.streakActivated + cat.editRequestedCount;

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up stagger-${Math.min(index + 1, 5)}`}
    >
      {/* Top section: gradient background with large icon */}
      <div className={`relative flex h-[140px] items-center justify-center bg-gradient-to-br ${hasEntries ? theme.gradient : theme.gradientEmpty}`}>
        {/* Frosted icon circle */}
        <div className="flex size-[72px] items-center justify-center rounded-full bg-white/60 backdrop-blur-sm shadow-sm transition-transform duration-300 group-hover:scale-105">
          <Icon className={`size-8 ${hasEntries ? theme.iconColor : "text-slate-400"}`} />
        </div>

        {/* Notification badge */}
        {needsAttention && (
          <span className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-white shadow-sm">
            {actionableCount}
          </span>
        )}
      </div>

      {/* Bottom section: info + actions */}
      <div className="px-5 pb-5 pt-4">
        {/* Category name */}
        <h3 className="text-base font-bold text-slate-900">{cat.label}</h3>

        {/* Entry count */}
        <p className="mt-0.5 text-sm text-slate-500">
          {hasEntries ? `${cat.totalEntries} ${cat.totalEntries === 1 ? "entry" : "entries"}` : "No entries yet"}
        </p>

        {/* Status indicators */}
        {hasEntries && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {cat.draftCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                <Pencil className="size-3" />
                {cat.draftCount} {cat.draftCount === 1 ? "draft" : "drafts"}
              </span>
            )}
            {cat.streakActivated > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                <Flame className="size-3" />
                {cat.streakActivated} active
              </span>
            )}
            {cat.streakWins > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Trophy className="size-3" />
                {cat.streakWins} done
              </span>
            )}
            {cat.editRequestedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-600">
                <Clock className="size-3" />
                {cat.editRequestedCount} pending
              </span>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2">
          {hasEntries ? (
            <>
              <Link
                href={cat.href}
                className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                View All
              </Link>
              <Link
                href={cat.newHref}
                className={`inline-flex h-9 items-center gap-1 rounded-full px-4 text-sm font-medium text-white transition-all ${theme.buttonBg} ${theme.buttonHover}`}
              >
                <Plus className="size-3.5" />
                New
              </Link>
            </>
          ) : (
            <Link
              href={cat.newHref}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-slate-500 px-4 text-sm font-medium text-white transition-all hover:bg-slate-600"
            >
              <Plus className="size-3.5" />
              Create First
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function DataEntryClient({ greeting, userName, categories, totals }: Props) {
  const sorted = useMemo(() => sortByUrgency(categories), [categories]);
  const hasAnyEntries = totals.totalEntries > 0;
  const firstName = userName?.split(" ")[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header */}
      <div className="mb-8 text-center animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {getStatusMessage(totals)}
        </p>
      </div>

      {/* Stats bar */}
      {hasAnyEntries && (
        <div className="mb-8 flex items-center justify-center gap-3 flex-wrap animate-fade-in-up stagger-1">
          <StatPill icon={Sparkles} label="total" value={totals.totalEntries} />
          <StatPill icon={Flame} label="active" value={totals.streakActivatedCount} className="text-amber-600 bg-amber-50 border-amber-200" />
          <StatPill icon={Trophy} label="wins" value={totals.streakWinsCount} className="text-emerald-600 bg-emerald-50 border-emerald-200" />
        </div>
      )}

      {/* Category cards grid */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((cat, index) => (
          <CategoryCard key={cat.slug} cat={cat} index={index} />
        ))}
      </div>

      {/* Empty state hint */}
      {!hasAnyEntries && (
        <p className="mt-8 text-center text-sm text-slate-500 animate-fade-in-up stagger-3">
          Choose a category above to create your first entry.
        </p>
      )}
    </div>
  );
}
