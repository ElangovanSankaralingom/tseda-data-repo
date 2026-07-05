"use client";

import { BarChart3, Layers, Trophy, Medal, Flame, FileEdit, CircleDashed } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { getCategoryConfig, CATEGORY_GROUP_ORDER, type CategoryGroup } from "@/data/categoryRegistry";
import type { TranslationKey } from "@/lib/i18n";

/**
 * DASHBOARD ANALYTICS CARDS (Elan, 2026-07) — the at-a-glance strip:
 * club distribution, status mix, and the gold/silver streak split.
 * Server-computed props from the SAME summary the bento grid uses, so the
 * numbers can never disagree with the cards below them.
 */

export type ClubStat = {
  group: CategoryGroup;
  entries: number;
  categories: number;
};

export type DashboardAnalyticsProps = {
  clubs: ClubStat[];
  totalEntries: number;
  draftCount: number;
  generatedCount: number;
  editRequestedCount: number;
  streakActivated: number;
  goldWins: number;
  silverWins: number;
};

const GROUP_LABEL_KEYS: Record<CategoryGroup, TranslationKey> = {
  professional: "dashboard.groupProfessionalDev",
  academic: "dashboard.groupAcademicActivities",
  creative: "dashboard.groupCreative",
  research: "dashboard.groupResearch",
  department: "dashboard.groupDepartment",
};

/** One representative accent per club (first category's chart hex). */
function clubHex(group: CategoryGroup): string {
  const order = CATEGORY_GROUP_ORDER.indexOf(group);
  const fallbacks = ["#2A48CE", "#7C3AED", "#EA580C", "#0D9488", "#52525B"];
  return fallbacks[order] ?? "#2A48CE";
}

export default function DashboardAnalytics(props: DashboardAnalyticsProps) {
  const { t } = useTranslation();
  const {
    clubs, totalEntries, draftCount, generatedCount, editRequestedCount,
    streakActivated, goldWins, silverWins,
  } = props;

  if (totalEntries === 0) return null;

  const maxClub = Math.max(...clubs.map((c) => c.entries), 1);
  const statusRows = [
    { key: "drafts", label: t("dashboardAnalytics.drafts"), value: draftCount, color: "var(--color-status-warning)", icon: FileEdit },
    { key: "active", label: t("dashboardAnalytics.active"), value: generatedCount, color: "var(--color-primary)", icon: Flame },
    { key: "review", label: t("dashboardAnalytics.underReview"), value: editRequestedCount, color: "var(--color-status-error)", icon: CircleDashed },
  ];
  const statusMax = Math.max(...statusRows.map((r) => r.value), 1);

  return (
    <section
      aria-label={t("dashboardAnalytics.title")}
      className="grid gap-4 lg:grid-cols-3 animate-fade-in-up"
    >
      {/* ── Card 1: Club distribution ── */}
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-5">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          <Layers className="size-3.5" />
          {t("dashboardAnalytics.byClub")}
        </div>
        <div className="mt-4 space-y-2.5">
          {clubs.filter((c) => c.categories > 0).map((club) => (
            <div key={club.group} className="flex items-center gap-3">
              <div className="w-36 shrink-0 truncate text-xs font-medium text-[var(--color-text-secondary)]">
                {t(GROUP_LABEL_KEYS[club.group])}
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-inset)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, (club.entries / maxClub) * 100)}%`, background: clubHex(club.group) }}
                />
              </div>
              <div className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-[var(--color-text-primary)]">
                {club.entries}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 2: Status mix ── */}
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-5">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          <BarChart3 className="size-3.5" />
          {t("dashboardAnalytics.statusMix")}
        </div>
        <div className="mt-4 space-y-2.5">
          {statusRows.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <row.icon className="size-3.5 shrink-0" style={{ color: row.color }} />
              <div className="w-28 shrink-0 truncate text-xs font-medium text-[var(--color-text-secondary)]">
                {row.label}
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-inset)]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(row.value > 0 ? 4 : 0, (row.value / statusMax) * 100)}%`, background: row.color }}
                />
              </div>
              <div className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-[var(--color-text-primary)]">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Card 3: Streak split — gold vs silver ── */}
      <div className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-panel)] p-5">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          <Trophy className="size-3.5 text-[var(--color-palette-yellow-fg)]" />
          {t("dashboardAnalytics.streaks")}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[var(--color-palette-yellow-bg)] p-3 text-center">
            <Trophy className="mx-auto size-4 text-[var(--color-palette-yellow-fg)]" />
            <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-palette-yellow-fg)]">{goldWins}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {t("streak.goldBadge")}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-inset)] p-3 text-center">
            <Medal className="mx-auto size-4 text-[var(--color-text-secondary)]" />
            <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-text-primary)]">{silverWins}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {t("streak.silverBadge")}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--color-surface-panel-raised)] p-3 text-center">
            <Flame className="mx-auto size-4 text-[var(--color-status-warning)]" />
            <div className="mt-1 text-xl font-black tabular-nums text-[var(--color-text-primary)]">{streakActivated}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {t("dashboardAnalytics.running")}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          {t("dashboardAnalytics.tierHint")}
        </p>
      </div>
    </section>
  );
}

/** Server-side helper: roll categories up into club stats. */
export function buildClubStats(
  perCategory: Array<{ slug: string; totalEntries: number }>,
): ClubStat[] {
  const byGroup = new Map<CategoryGroup, ClubStat>();
  for (const group of CATEGORY_GROUP_ORDER) {
    byGroup.set(group, { group, entries: 0, categories: 0 });
  }
  for (const row of perCategory) {
    const group = getCategoryConfig(row.slug).group;
    const stat = byGroup.get(group);
    if (!stat) continue;
    stat.entries += row.totalEntries;
    stat.categories += 1;
  }
  return CATEGORY_GROUP_ORDER.map((group) => byGroup.get(group)!).filter(Boolean);
}
