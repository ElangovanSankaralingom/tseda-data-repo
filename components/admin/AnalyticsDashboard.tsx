"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Users,
  Target,
  Trophy,
  BarChart3,
  Clock,
  RefreshCw,
  Flame,
  FileWarning,
} from "lucide-react";
import Link from "next/link";
import type { AnalyticsSnapshot } from "@/lib/analytics/compute";
import {
  filterByDateRange,
  daysAgo,
  groupAndCount,
} from "@/lib/analytics/compare";
import { adminIntegrity, adminBackups, adminMaintenance } from "@/lib/entryNavigation";
import {
  ComparisonBadge,
  MetricCard,
  AreaChart,
  DonutChart,
  Heatmap,
  Leaderboard,
  StreakFunnel,
  CategoryRow,
  SH,
  pct,
  catColor,
} from "./analytics/AnalyticsCharts";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  snapshot: AnalyticsSnapshot;
};

import { RANGES, type RangeKey } from "./adminLocalTypes";

function rangeToDateBounds(key: RangeKey, now: Date) {
  const r = RANGES.find((x) => x.key === key)!;
  if (r.days === 0) return { from: "2000-01-01", to: "2099-12-31" };
  return { from: daysAgo(r.days, now), to: now.toISOString().slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(ms: number | null, tr: (key: string) => string) {
  if (ms === null) return tr("time.never");
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return tr("time.justNow");
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function getDayNames(tr: (key: string) => string): string[] {
  return [tr("time.sun"), tr("time.mon"), tr("time.tue"), tr("time.wed"), tr("time.thu"), tr("time.fri"), tr("time.sat")];
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AnalyticsDashboard({ snapshot: initial }: Props) {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState(initial);
  const [range, setRange] = useState<RangeKey>("30d");
  const [refreshing, setRefreshing] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(() => {
    const age = Date.now() - Date.parse(initial.computedAt);
    return Number.isFinite(age) ? age : null;
  });

  // Tick cache age every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheAge(Date.now() - Date.parse(snapshot.computedAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [snapshot.computedAt]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/analytics", { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        setSnapshot(json.data);
        setCacheAge(0);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Filtered data
  const now = useMemo(() => new Date(), []);
  const bounds = useMemo(() => rangeToDateBounds(range, now), [range, now]);
  const prevBounds = useMemo(() => {
    const r = RANGES.find((x) => x.key === range)!;
    if (r.days === 0) return bounds;
    return { from: daysAgo(r.days * 2, now), to: daysAgo(r.days + 1, now) };
  }, [range, now, bounds]);

  const filtered = useMemo(
    () => filterByDateRange(snapshot.entries, bounds.from, bounds.to),
    [snapshot.entries, bounds],
  );
  const prevFiltered = useMemo(
    () => filterByDateRange(snapshot.entries, prevBounds.from, prevBounds.to),
    [snapshot.entries, prevBounds],
  );

  // Metrics
  const totalEntries = filtered.length;
  const prevTotalEntries = prevFiltered.length;
  const activeUsers = useMemo(
    () => new Set(filtered.map((e) => e.userEmail)).size,
    [filtered],
  );
  const prevActiveUsers = useMemo(
    () => new Set(prevFiltered.map((e) => e.userEmail)).size,
    [prevFiltered],
  );
  const generatedCount = useMemo(
    () => filtered.filter((e) => e.status !== "DRAFT").length,
    [filtered],
  );
  const prevGeneratedCount = useMemo(
    () => prevFiltered.filter((e) => e.status !== "DRAFT").length,
    [prevFiltered],
  );
  const completionRate = totalEntries > 0 ? pct(generatedCount, totalEntries) : 0;
  const prevCompletionRate =
    prevTotalEntries > 0 ? pct(prevGeneratedCount, prevTotalEntries) : 0;
  const avgPerUser = snapshot.totalUsers > 0 ? Math.round(totalEntries / snapshot.totalUsers) : 0;
  const prevAvgPerUser =
    snapshot.totalUsers > 0 ? Math.round(prevTotalEntries / snapshot.totalUsers) : 0;
  const pendingRequests = useMemo(
    () =>
      snapshot.editRequests.filter(
        (r) => !r.grantedAt && r.requestedAt >= bounds.from,
      ).length,
    [snapshot.editRequests, bounds],
  );

  // Trend data for area chart
  const trendData = useMemo(() => {
    const grouped = groupAndCount(filtered, (e) => {
      // Group by week if > 30 days, else by day
      const r = RANGES.find((x) => x.key === range)!;
      if (r.days > 60) {
        // Monthly
        return e.date.slice(0, 7);
      }
      if (r.days > 14) {
        // Weekly: ISO week start (Monday)
        const d = new Date(e.date);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d.toISOString().slice(0, 10);
      }
      return e.date;
    });
    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [filtered, range]);

  const prevTrendData = useMemo(() => {
    const grouped = groupAndCount(prevFiltered, (e) => {
      const r = RANGES.find((x) => x.key === range)!;
      if (r.days > 60) return e.date.slice(0, 7);
      if (r.days > 14) {
        const d = new Date(e.date);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d.toISOString().slice(0, 10);
      }
      return e.date;
    });
    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [prevFiltered, range]);

  // Category data for donut + bars
  const categoryData = useMemo(() => {
    const grouped = groupAndCount(filtered, (e) => e.category);
    const prevGrouped = groupAndCount(prevFiltered, (e) => e.category);
    return snapshot.categories.map((cat) => ({
      slug: cat.slug,
      name: cat.name,
      count: grouped[cat.slug] ?? 0,
      prevCount: prevGrouped[cat.slug] ?? 0,
      statusBreakdown: cat.entriesByStatus,
    }));
  }, [filtered, prevFiltered, snapshot.categories]);

  const maxCategoryCount = Math.max(...categoryData.map((c) => c.count), 1);

  // Busiest day
  const busiestDay = useMemo(() => {
    const dayNames = getDayNames(t as (key: string) => string);
    const byDay = groupAndCount(filtered, (e) => dayNames[new Date(e.date).getDay()]);
    let best = { day: "-", count: 0 };
    for (const [day, count] of Object.entries(byDay)) {
      if (count > best.count) best = { day, count };
    }
    return best;
  }, [filtered, t]);

  // Edit request metrics
  const editRequestMetrics = useMemo(() => {
    const reqs = snapshot.editRequests;
    const total = reqs.length;
    const granted = reqs.filter((r) => r.grantedAt).length;
    const pending = reqs.filter((r) => !r.grantedAt).length;
    const responseTimes = reqs
      .filter((r) => r.grantedAt)
      .map((r) => Date.parse(r.grantedAt!) - Date.parse(r.requestedAt))
      .filter((ms) => Number.isFinite(ms) && ms > 0);
    const avgResponseMs =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
    const avgResponseHrs = Math.round(avgResponseMs / (1000 * 60 * 60) * 10) / 10;
    const grantRate = total > 0 ? pct(granted, total) : 0;
    return { total, granted, pending, avgResponseHrs, grantRate };
  }, [snapshot.editRequests]);

  return (
    <div className="space-y-8">
      {/* Controls toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in-up">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                range === r.key
                  ? "bg-[var(--color-button-primary-bg)] text-white"
                  : "bg-[var(--color-dropdown-hover)] text-[var(--color-text-secondary)] hover:bg-[var(--color-glass-border)]"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)]">
            {t("adminAnalytics.updated")} {formatAge(cacheAge, t as (key: string) => string)}
          </span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] disabled:opacity-50"
          >
            <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
            {t("adminAnalytics.refresh")}
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <MetricCard
          icon={ClipboardList}
          label={t("adminAnalytics.entries")}
          value={totalEntries}
          accent="border-t-2 border-t-blue-400"
          iconBg="bg-blue-500/15"
          iconColor="text-blue-500"
          hoverRing="hover:ring-2 hover:ring-blue-500/20"
          current={totalEntries}
          previous={prevTotalEntries}
          stagger={1}
        />
        <MetricCard
          icon={Users}
          label={t("adminAnalytics.activeUsers")}
          value={activeUsers}
          accent="border-t-2 border-t-emerald-400"
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-500"
          hoverRing="hover:ring-2 hover:ring-emerald-500/20"
          current={activeUsers}
          previous={prevActiveUsers}
          stagger={2}
        />
        <MetricCard
          icon={Target}
          label={t("adminAnalytics.completion")}
          value={completionRate}
          suffix="%"
          accent="border-t-2 border-t-amber-400"
          iconBg="bg-amber-500/15"
          iconColor="text-amber-500"
          hoverRing="hover:ring-2 hover:ring-amber-500/20"
          current={completionRate}
          previous={prevCompletionRate}
          stagger={3}
        />
        <MetricCard
          icon={Trophy}
          label={t("adminAnalytics.streakWins")}
          value={snapshot.streaks.totalWins}
          accent="border-t-2 border-t-yellow-400"
          iconBg="bg-yellow-500/15"
          iconColor="text-yellow-500"
          hoverRing="hover:ring-2 hover:ring-yellow-500/20"
          current={snapshot.streaks.totalWins}
          previous={snapshot.streaks.totalWins}
          stagger={4}
        />
        <MetricCard
          icon={BarChart3}
          label={t("adminAnalytics.avgPerUser")}
          value={avgPerUser}
          accent="border-t-2 border-t-purple-400"
          iconBg="bg-purple-500/15"
          iconColor="text-purple-500"
          hoverRing="hover:ring-2 hover:ring-purple-500/20"
          current={avgPerUser}
          previous={prevAvgPerUser}
          stagger={5}
        />
        <MetricCard
          icon={Clock}
          label={t("adminAnalytics.pendingEdits")}
          value={pendingRequests}
          accent="border-t-2 border-t-rose-400"
          iconBg="bg-rose-500/15"
          iconColor="text-rose-500"
          hoverRing="hover:ring-2 hover:ring-rose-500/20"
          current={pendingRequests}
          previous={pendingRequests}
          stagger={6}
        />
        <MetricCard
          icon={FileWarning}
          label={t("adminAnalytics.stalePdfs")}
          value={snapshot.stalePdfCount}
          accent="border-t-2 border-t-orange-400"
          iconBg="bg-orange-500/15"
          iconColor="text-orange-500"
          hoverRing="hover:ring-2 hover:ring-orange-500/20"
          current={snapshot.stalePdfCount}
          previous={snapshot.stalePdfCount}
          stagger={7}
        />
      </div>

      {/* Entry Trends */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-2">
        <SH title={t("adminAnalytics.entryActivity")} description={t("adminAnalytics.entryActivityDesc")} />
        <AreaChart data={trendData} previousData={prevTrendData} />
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--color-text-secondary)]">
          <span>
            Busiest day: <span className="font-medium text-[var(--color-text-secondary)]">{busiestDay.day}</span> with avg{" "}
            {busiestDay.count} entries
          </span>
          <span>
            Growth:{" "}
            <ComparisonBadge current={totalEntries} previous={prevTotalEntries} />
          </span>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-3">
          <SH title={t("adminAnalytics.byCategoryChart")} description={t("adminAnalytics.entryDistribution")} />
          <DonutChart
            segments={categoryData.map((c) => ({
              label: c.name,
              value: c.count,
              color: catColor(c.slug),
            }))}
            total={totalEntries}
          />
        </div>
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-4">
          <SH title={t("adminAnalytics.categoryComparison")} description={t("adminAnalytics.performanceByCategory")} />
          <div className="rounded-lg border border-[var(--color-divider)]">
            {categoryData
              .slice()
              .sort((a, b) => b.count - a.count)
              .map((c) => (
                <CategoryRow
                  key={c.slug}
                  slug={c.slug}
                  name={c.name}
                  count={c.count}
                  maxCount={maxCategoryCount}
                  growth={{ current: c.count, previous: c.prevCount }}
                  statusBreakdown={c.statusBreakdown}
                />
              ))}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-5">
        <SH title={t("adminAnalytics.topContributors")} description={t("adminAnalytics.topContributorsDesc")} />
        <Leaderboard users={snapshot.users} />
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-6">
        <SH title={t("adminAnalytics.whenPeopleWork")} description={t("adminAnalytics.whenPeopleWorkDesc")} />
        <Heatmap entries={snapshot.entries} />
      </div>

      {/* Streak + Edit Requests */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Streak funnel */}
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-7">
          <SH title={t("adminAnalytics.streakInsights")} description={t("adminAnalytics.streakInsightsDesc")} />
          <div className="grid gap-6 sm:grid-cols-2">
            <StreakFunnel
              total={snapshot.streaks.totalActivated + snapshot.streaks.totalWins}
              activated={snapshot.streaks.totalActivated}
              wins={snapshot.streaks.totalWins}
            />
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-secondary)]">
                <Flame className="size-4 text-amber-500 animate-flame" />
                Streak Champions
              </h3>
              <div className="space-y-1.5">
                {snapshot.streaks.byUser.slice(0, 5).map((u, i) => (
                  <div key={u.email} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-xs font-bold text-[var(--color-text-secondary)]">#{i + 1}</span>
                    <span className="flex-1 truncate text-[var(--color-text-secondary)]">{u.name}</span>
                    <span className="font-semibold text-amber-400">{u.wins}</span>
                  </div>
                ))}
                {snapshot.streaks.byUser.length === 0 && (
                  <div className="text-xs text-[var(--color-text-secondary)]">No streak wins yet</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit request metrics */}
        <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-8">
          <SH title={t("adminAnalytics.editRequests")} description={t("adminAnalytics.editRequestsDesc")} />
          <div className="grid gap-4 grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{editRequestMetrics.total}</div>
              <div className="text-[10px] uppercase text-[var(--color-text-secondary)]">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">
                {editRequestMetrics.avgResponseHrs}h
              </div>
              <div className="text-[10px] uppercase text-[var(--color-text-secondary)]">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[var(--color-text-primary)]">{editRequestMetrics.grantRate}%</div>
              <div className="text-[10px] uppercase text-[var(--color-text-secondary)]">Grant Rate</div>
            </div>
          </div>
          {snapshot.editRequests.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">{t("adminAudit.byCategory")}</div>
              {snapshot.categories.map((cat) => {
                const count = snapshot.editRequests.filter(
                  (r) => r.category === cat.slug,
                ).length;
                if (count === 0) return null;
                return (
                  <div key={cat.slug} className="flex items-center justify-between text-sm py-1">
                    <span className="text-[var(--color-text-secondary)]">{cat.name}</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Data Health Summary */}
      <div className="rounded-xl border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 shadow-sm animate-fade-in-up stagger-8">
        <SH title={t("adminAnalytics.systemHealth")} description={t("adminAnalytics.systemHealthDesc")} />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Link
            href={adminIntegrity()}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-divider)] p-3 transition-colors hover:bg-[var(--color-dropdown-hover)]"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/10">
              <Target className="size-4 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--color-text-secondary)]">{t("adminConsole.integrity")}</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{t("adminConsole.viewScanResults")}</div>
            </div>
          </Link>
          <a
            href={adminBackups()}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-divider)] p-3 transition-colors hover:bg-[var(--color-dropdown-hover)]"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/10">
              <ClipboardList className="size-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--color-text-secondary)]">{t("adminConsole.backup")}</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{t("adminConsole.manageBackups")}</div>
            </div>
          </a>
          <a
            href={adminMaintenance()}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-divider)] p-3 transition-colors hover:bg-[var(--color-dropdown-hover)]"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/10">
              <Clock className="size-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--color-text-secondary)]">{t("adminConsole.maintenance")}</div>
              <div className="text-[10px] text-[var(--color-text-secondary)]">{t("adminConsole.viewJobStatus")}</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
