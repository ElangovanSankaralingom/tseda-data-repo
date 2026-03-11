"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  Flame,
  Mic,
  Pencil,
  Plus,
  Presentation,
  Trophy,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type CategoryOverview, type Totals } from "./dataEntryTypes";

type Props = {
  greeting: string;
  userName: string | null;
  categories: CategoryOverview[];
  totals: Totals;
};

const CATEGORY_THEME: Record<string, {
  icon: typeof BookOpen;
  accentBg: string;
  accentText: string;
  borderColor: string;
  buttonBg: string;
  buttonHover: string;
}> = {
  "fdp-attended": { icon: BookOpen, accentBg: "bg-blue-50", accentText: "text-blue-600", borderColor: "border-t-blue-500", buttonBg: "bg-blue-600", buttonHover: "hover:bg-blue-700" },
  "fdp-conducted": { icon: Presentation, accentBg: "bg-emerald-50", accentText: "text-emerald-600", borderColor: "border-t-emerald-500", buttonBg: "bg-emerald-600", buttonHover: "hover:bg-emerald-700" },
  "case-studies": { icon: FileText, accentBg: "bg-amber-50", accentText: "text-amber-600", borderColor: "border-t-amber-500", buttonBg: "bg-amber-600", buttonHover: "hover:bg-amber-700" },
  "guest-lectures": { icon: Mic, accentBg: "bg-purple-50", accentText: "text-purple-600", borderColor: "border-t-purple-500", buttonBg: "bg-purple-600", buttonHover: "hover:bg-purple-700" },
  workshops: { icon: Wrench, accentBg: "bg-rose-50", accentText: "text-rose-600", borderColor: "border-t-rose-500", buttonBg: "bg-rose-600", buttonHover: "hover:bg-rose-700" },
};

const DEFAULT_THEME = CATEGORY_THEME["fdp-attended"]!;

function sortByUrgency(categories: CategoryOverview[]): CategoryOverview[] {
  return [...categories].sort((a, b) => {
    const aScore = a.draftCount * 3 + a.editRequestedCount * 2 + a.streakActivated;
    const bScore = b.draftCount * 3 + b.editRequestedCount * 2 + b.streakActivated;
    if (aScore !== bScore) return bScore - aScore;
    if (a.totalEntries !== b.totalEntries) return b.totalEntries - a.totalEntries;
    return 0;
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ── Category Card ──────────────────────────────────────────────────
function CategoryCard({ cat, index }: { cat: CategoryOverview; index: number }) {
  const theme = CATEGORY_THEME[cat.slug] ?? DEFAULT_THEME;
  const Icon = theme.icon;
  const hasEntries = cat.totalEntries > 0;
  const actionableCount = cat.draftCount + cat.streakActivated + cat.editRequestedCount;

  return (
    <div
      className={cn(
        "group relative flex flex-col min-h-[160px] rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md animate-fade-in-up",
        hasEntries
          ? cn("border border-t-[3px] bg-white border-slate-200 shadow-sm", theme.borderColor)
          : "border border-dashed border-slate-300 bg-slate-50",
        `stagger-${Math.min(index + 1, 5)}`
      )}
    >
      {/* Notification badge */}
      {actionableCount > 0 && (
        <span className="absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
          {actionableCount}
        </span>
      )}

      {/* Top section: Icon + Title + Chevron */}
      <Link href={hasEntries ? cat.href : cat.newHref} className="flex flex-1 items-start gap-4">
        <div className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110",
          hasEntries ? theme.accentBg : "bg-slate-200"
        )}>
          <Icon className={cn("size-6", hasEntries ? theme.accentText : "text-slate-500")} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className={cn(
            "text-base font-semibold",
            hasEntries ? "text-slate-900" : "text-slate-600"
          )}>
            {cat.label}
          </h3>

          {hasEntries ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span>{cat.totalEntries} {cat.totalEntries === 1 ? "entry" : "entries"}</span>
              {cat.draftCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
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
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">No entries yet</p>
              <p className="mt-0 max-h-0 overflow-hidden text-xs italic text-slate-500 opacity-0 transition-all duration-200 group-hover:mt-2 group-hover:max-h-12 group-hover:opacity-100">
                Create your first entry to begin tracking this category
              </p>
            </>
          )}

          {cat.lastActivity && (
            <p className="mt-1 text-xs text-slate-400">Last: {relativeTime(cat.lastActivity)}</p>
          )}
        </div>

        {hasEntries && (
          <ChevronRight className="mt-1 size-5 shrink-0 text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-slate-600" />
        )}
      </Link>

      {/* Bottom: Action buttons */}
      <div className="mt-4 flex items-center gap-2 pl-16">
        {hasEntries ? (
          <>
            <Link
              href={cat.href}
              className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]"
            >
              View All
            </Link>
            <Link
              href={cat.newHref}
              className={`inline-flex h-8 items-center gap-1 rounded-lg ${theme.buttonBg} px-3 text-sm font-medium text-white transition-all ${theme.buttonHover} active:scale-[0.97]`}
            >
              <Plus className="size-3.5" />
              New Entry
            </Link>
          </>
        ) : (
          <Link
            href={cat.newHref}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-500 px-3 text-sm font-medium text-white transition-all hover:bg-[#1E3A5F] active:scale-[0.97]"
          >
            <Plus className="size-3.5" />
            Create First Entry
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────
export default function DataEntryClient({ greeting, userName, categories, totals }: Props) {
  const sorted = useMemo(() => sortByUrgency(categories), [categories]);
  const hasAnyEntries = totals.totalEntries > 0;
  const firstName = userName?.split(" ")[0] ?? null;
  const actionItems = totals.draftCount + totals.streakActivatedCount + totals.editRequestedCount;

  const statusText = !hasAnyEntries
    ? "Start documenting your professional development"
    : actionItems > 0
      ? `${actionItems} ${actionItems === 1 ? "item needs" : "items need"} your attention`
      : "You're all caught up";

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header — matches dashboard style */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 animate-fade-in-up">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{statusText}</p>
        </div>

        {hasAnyEntries && (
          <div className="flex items-center gap-3">
            {totals.streakActivatedCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 border border-amber-100">
                <Flame className="size-4" />
                <span>{totals.streakActivatedCount} active</span>
              </div>
            )}
            {totals.streakWinsCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 border border-emerald-100">
                <Trophy className="size-4" />
                <span>{totals.streakWinsCount} wins</span>
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
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center animate-fade-in-up stagger-3">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
            <FileText className="size-8 text-slate-600" />
          </div>
          <p className="mt-3 text-base font-medium text-slate-600">Choose a category above to begin</p>
          <p className="mt-1 text-sm text-slate-600">Track FDPs, lectures, workshops, and more</p>
        </div>
      )}
    </div>
  );
}
