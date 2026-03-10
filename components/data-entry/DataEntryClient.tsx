"use client";

import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  FileText,
  Flame,
  Mic,

  Presentation,
  Trophy,
  Wrench,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import { type CategoryOverview, type Totals } from "./dataEntryTypes";

type Props = {
  greeting: string;
  userName: string | null;
  categories: CategoryOverview[];
  totals: Totals;
};

const ICON_MAP: Record<string, typeof BookOpen> = {
  "fdp-attended": BookOpen,
  "fdp-conducted": Presentation,
  "case-studies": FileText,
  "guest-lectures": Mic,
  workshops: Wrench,
};

const ACCENT: Record<string, { strip: string; iconBg: string; iconText: string; bar: string }> = {
  "fdp-attended": { strip: "bg-blue-500", iconBg: "bg-blue-50", iconText: "text-blue-600", bar: "bg-blue-500" },
  "fdp-conducted": { strip: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-600", bar: "bg-emerald-500" },
  "case-studies": { strip: "bg-amber-500", iconBg: "bg-amber-50", iconText: "text-amber-600", bar: "bg-amber-500" },
  "guest-lectures": { strip: "bg-purple-500", iconBg: "bg-purple-50", iconText: "text-purple-600", bar: "bg-purple-500" },
  workshops: { strip: "bg-rose-500", iconBg: "bg-rose-50", iconText: "text-rose-600", bar: "bg-rose-500" },
};

const DEFAULT_ACCENT = ACCENT["fdp-attended"];

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

function AnimatedNumber({ value }: { value: number }) {
  const count = useCountUp(value);
  return <>{count.toLocaleString("en-IN")}</>;
}

function HeroSection({ greeting, userName, totals }: { greeting: string; userName: string | null; totals: Totals }) {
  const hasEntries = totals.totalEntries > 0;
  const totalStreak = totals.streakActivatedCount + totals.streakWinsCount;
  const completionPct = totalStreak > 0 ? Math.round((totals.streakWinsCount / totalStreak) * 100) : 0;
  const remaining = totals.draftCount + totals.streakActivatedCount;
  const firstName = userName?.split(" ")[0] ?? null;

  const statusText = !hasEntries
    ? "Start your first entry to begin tracking progress"
    : remaining > 0
      ? `${remaining} ${remaining === 1 ? "item" : "items"} need${remaining === 1 ? "s" : ""} your attention`
      : totals.streakWinsCount > 0
        ? "All entries up to date!"
        : "Here's your progress overview";

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-8 mb-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-300">{statusText}</p>
        </div>

        {hasEntries && (
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2">
              <Flame className="size-4 text-amber-400 animate-flame" />
              <span className="text-sm font-semibold text-white">
                <AnimatedNumber value={totals.streakActivatedCount} />
              </span>
              <span className="text-xs text-slate-500">active</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2">
              <Trophy className="size-4 text-yellow-400" />
              <span className="text-sm font-semibold text-white">
                <AnimatedNumber value={totals.streakWinsCount} />
              </span>
              <span className="text-xs text-slate-500">wins</span>
            </div>
          </div>
        )}
      </div>

      {hasEntries && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
            <AnimatedNumber value={totals.totalEntries} /> entries
          </span>
          {totals.draftCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">
              {totals.draftCount} {totals.draftCount === 1 ? "draft" : "drafts"}
            </span>
          )}
          {totals.editRequestedCount > 0 && (
            <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-300">
              {totals.editRequestedCount} edit {totals.editRequestedCount === 1 ? "request" : "requests"}
            </span>
          )}
          {totalStreak > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-700"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <span className="text-xs text-slate-500">{completionPct}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EntryTypeBadges({ cat }: { cat: CategoryOverview }) {
  const hasBadges = cat.streakActivated > 0 || cat.streakWins > 0 || cat.draftCount > 0 || cat.completedNonStreak > 0;
  if (!hasBadges) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {cat.streakActivated > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
          title={`${cat.streakActivated} streak ${cat.streakActivated === 1 ? "entry" : "entries"} in progress`}
        >
          ⚡ {cat.streakActivated}
        </span>
      )}
      {cat.streakWins > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
          title={`${cat.streakWins} streak ${cat.streakWins === 1 ? "entry" : "entries"} completed`}
        >
          🏆 {cat.streakWins}
        </span>
      )}
      {cat.draftCount > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
          title={`${cat.draftCount} ${cat.draftCount === 1 ? "draft" : "drafts"}`}
        >
          📝 {cat.draftCount}
        </span>
      )}
      {cat.completedNonStreak > 0 && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
          title={`${cat.completedNonStreak} completed ${cat.completedNonStreak === 1 ? "entry" : "entries"}`}
        >
          ✓ {cat.completedNonStreak}
        </span>
      )}
    </div>
  );
}

function CategoryCard({
  cat,
  maxEntries,
  index,
}: {
  cat: CategoryOverview;
  maxEntries: number;
  index: number;
}) {
  const Icon = ICON_MAP[cat.slug] ?? FileText;
  const accent = ACCENT[cat.slug] ?? DEFAULT_ACCENT;
  const hasActivity = cat.totalEntries > 0;
  // Actionable items only: streak in-progress + drafts
  const actionableCount = cat.streakActivated + cat.draftCount;
  const barWidth = hasActivity ? Math.max((cat.totalEntries / maxEntries) * 100, 8) : 0;

  return (
    <Link
      href={cat.href}
      className={`group relative flex overflow-visible rounded-xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up ${
        actionableCount > 0 ? "border-amber-200 hover:border-amber-300" : "border-slate-200 hover:border-slate-300"
      } stagger-${Math.min(index + 1, 5)}`}
    >
      {/* Notification badge — actionable items only */}
      {actionableCount > 0 && (
        <span className="absolute -top-2 -right-2 z-10 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white shadow-sm">
          {actionableCount}
        </span>
      )}

      <div className={`w-1 shrink-0 rounded-l-xl transition-all duration-200 group-hover:w-1.5 ${accent.strip}`} />

      <div className="flex flex-1 flex-col p-4 min-w-0">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 ${accent.iconBg}`}
          >
            <Icon className={`size-5 ${accent.iconText}`} />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 truncate">{cat.label}</h2>
            <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{cat.subtitle}</p>
          </div>

          <ChevronRight className="mt-1 size-5 shrink-0 text-slate-500 transition-all duration-200 group-hover:translate-x-1 group-hover:text-slate-500" />
        </div>

        {hasActivity ? (
          <>
            <div className="mt-3 text-xs font-medium text-slate-700">
              {cat.totalEntries} {cat.totalEntries === 1 ? "entry" : "entries"}
            </div>

            <div className="mt-2">
              <EntryTypeBadges cat={cat} />
            </div>

            <div className="mt-2 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${accent.bar}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </>
        ) : (
          <p className="mt-3 text-xs text-slate-500 italic">No entries yet — get started!</p>
        )}

        {cat.lastActivity && (
          <div className="mt-1.5 text-[11px] text-slate-500">
            Last activity: {relativeTime(cat.lastActivity)}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function DataEntryClient({ greeting, userName, categories, totals }: Props) {
  const sorted = sortByUrgency(categories);
  const maxEntries = Math.max(...categories.map((c) => c.totalEntries), 1);
  const hasAnyEntries = totals.totalEntries > 0;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <HeroSection greeting={greeting} userName={userName} totals={totals} />

      {/* Category cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {sorted.map((cat, index) => (
          <CategoryCard key={cat.slug} cat={cat} maxEntries={maxEntries} index={index} />
        ))}
      </div>

      {!hasAnyEntries && (
        <div className="mt-8 text-center animate-fade-in-up stagger-3">
          <p className="text-sm text-slate-500">Choose a category above to create your first entry.</p>
        </div>
      )}
    </div>
  );
}
