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
} from "lucide-react";
import type { AnalyticsSnapshot } from "@/lib/analytics/compute";
import {
  filterByDateRange,
  daysAgo,
  groupAndCount,
} from "@/lib/analytics/compare";
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  snapshot: AnalyticsSnapshot;
};

// ---------------------------------------------------------------------------
// Time range
// ---------------------------------------------------------------------------

const RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
  { key: "12m", label: "12 months", days: 365 },
  { key: "all", label: "All time", days: 0 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function rangeToDateBounds(key: RangeKey, now: Date) {
  const r = RANGES.find((x) => x.key === key)!;
  if (r.days === 0) return { from: "2000-01-01", to: "2099-12-31" };
  return { from: daysAgo(r.days, now), to: now.toISOString().slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(ms: number | null) {
  if (ms === null) return "Never";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function AnalyticsDashboard({ snapshot: initial }: Props) {
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
    const byDay = groupAndCount(filtered, (e) => DAY_NAMES[new Date(e.date).getDay()]);
    let best = { day: "-", count: 0 };
    for (const [day, count] of Object.entries(byDay)) {
      if (count > best.count) best = { day, count };
    }
    return best;
  }, [filtered]);

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
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 sm:p-8 animate-fade-in-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-6 text-white/80" />
              <h1 className="text-2xl font-bold text-white">Analytics</h1>
            </div>
            <p className="mt-1 text-sm text-slate-300">
              How T&apos;SEDA is being used — the full picture
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Updated {formatAge(cacheAge)}
            </span>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
        {/* Time range selector */}
        <div className="mt-4 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                range === r.key
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          icon={ClipboardList}
          label="Entries"
          value={totalEntries}
          accent="border-t-2 border-t-blue-400"
          iconBg="bg-blue-100"
          iconColor="text-blue-500"
          hoverRing="hover:ring-2 hover:ring-blue-200/50"
          current={totalEntries}
          previous={prevTotalEntries}
          stagger={1}
        />
        <MetricCard
          icon={Users}
          label="Active Users"
          value={activeUsers}
          accent="border-t-2 border-t-emerald-400"
          iconBg="bg-emerald-100"
          iconColor="text-emerald-500"
          hoverRing="hover:ring-2 hover:ring-emerald-200/50"
          current={activeUsers}
          previous={prevActiveUsers}
          stagger={2}
        />
        <MetricCard
          icon={Target}
          label="Completion"
          value={completionRate}
          suffix="%"
          accent="border-t-2 border-t-amber-400"
          iconBg="bg-amber-100"
          iconColor="text-amber-500"
          hoverRing="hover:ring-2 hover:ring-amber-200/50"
          current={completionRate}
          previous={prevCompletionRate}
          stagger={3}
        />
        <MetricCard
          icon={Trophy}
          label="Streak Wins"
          value={snapshot.streaks.totalWins}
          accent="border-t-2 border-t-yellow-400"
          iconBg="bg-yellow-100"
          iconColor="text-yellow-500"
          hoverRing="hover:ring-2 hover:ring-yellow-200/50"
          current={snapshot.streaks.totalWins}
          previous={snapshot.streaks.totalWins}
          stagger={4}
        />
        <MetricCard
          icon={BarChart3}
          label="Avg / User"
          value={avgPerUser}
          accent="border-t-2 border-t-purple-400"
          iconBg="bg-purple-100"
          iconColor="text-purple-500"
          hoverRing="hover:ring-2 hover:ring-purple-200/50"
          current={avgPerUser}
          previous={prevAvgPerUser}
          stagger={5}
        />
        <MetricCard
          icon={Clock}
          label="Pending Edits"
          value={pendingRequests}
          accent="border-t-2 border-t-rose-400"
          iconBg="bg-rose-100"
          iconColor="text-rose-500"
          hoverRing="hover:ring-2 hover:ring-rose-200/50"
          current={pendingRequests}
          previous={pendingRequests}
          stagger={6}
        />
      </div>

      {/* Entry Trends */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-2">
        <SH title="Entry Activity" description="How entries are being created over time" />
        <AreaChart data={trendData} previousData={prevTrendData} />
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>
            Busiest day: <span className="font-medium text-slate-700">{busiestDay.day}</span> with avg{" "}
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
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-3">
          <SH title="By Category" description="Entry distribution" />
          <DonutChart
            segments={categoryData.map((c) => ({
              label: c.name,
              value: c.count,
              color: catColor(c.slug),
            }))}
            total={totalEntries}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-4">
          <SH title="Category Comparison" description="Performance by category" />
          <div className="rounded-lg border border-slate-100">
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
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-5">
        <SH title="Top Contributors" description="Faculty making the most impact" />
        <Leaderboard users={snapshot.users} />
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-6">
        <SH title="When People Work" description="Activity patterns over the last 12 weeks" />
        <Heatmap entries={snapshot.entries} />
      </div>

      {/* Streak + Edit Requests */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Streak funnel */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-7">
          <SH title="Streak Insights" description="How the gamification is working" />
          <div className="grid gap-6 sm:grid-cols-2">
            <StreakFunnel
              total={snapshot.streaks.totalActivated + snapshot.streaks.totalWins}
              activated={snapshot.streaks.totalActivated}
              wins={snapshot.streaks.totalWins}
            />
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                <Flame className="size-4 text-amber-500 animate-flame" />
                Streak Champions
              </h3>
              <div className="space-y-1.5">
                {snapshot.streaks.byUser.slice(0, 5).map((u, i) => (
                  <div key={u.email} className="flex items-center gap-2 text-sm">
                    <span className="w-4 text-xs font-bold text-slate-400">#{i + 1}</span>
                    <span className="flex-1 truncate text-slate-600">{u.name}</span>
                    <span className="font-semibold text-amber-600">{u.wins}</span>
                  </div>
                ))}
                {snapshot.streaks.byUser.length === 0 && (
                  <div className="text-xs text-slate-400">No streak wins yet</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit request metrics */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-8">
          <SH title="Edit Requests" description="How often entries need unlocking" />
          <div className="grid gap-4 grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{editRequestMetrics.total}</div>
              <div className="text-[10px] uppercase text-slate-400">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">
                {editRequestMetrics.avgResponseHrs}h
              </div>
              <div className="text-[10px] uppercase text-slate-400">Avg Response</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900">{editRequestMetrics.grantRate}%</div>
              <div className="text-[10px] uppercase text-slate-400">Grant Rate</div>
            </div>
          </div>
          {snapshot.editRequests.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-slate-500 mb-2">By Category</div>
              {snapshot.categories.map((cat) => {
                const count = snapshot.editRequests.filter(
                  (r) => r.category === cat.slug,
                ).length;
                if (count === 0) return null;
                return (
                  <div key={cat.slug} className="flex items-center justify-between text-sm py-1">
                    <span className="text-slate-600">{cat.name}</span>
                    <span className="font-medium text-slate-800">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Data Health Summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm animate-fade-in-up stagger-8">
        <SH title="System Health" description="Quick pulse check" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <a
            href="/admin/integrity"
            className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100">
              <Target className="size-4 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700">Integrity</div>
              <div className="text-[10px] text-slate-400">View scan results</div>
            </div>
          </a>
          <a
            href="/admin/backups"
            className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-blue-100">
              <ClipboardList className="size-4 text-blue-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700">Backups</div>
              <div className="text-[10px] text-slate-400">Manage backups</div>
            </div>
          </a>
          <a
            href="/admin/maintenance"
            className="flex items-center gap-3 rounded-lg border border-slate-100 p-3 transition-colors hover:bg-slate-50"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-100">
              <Clock className="size-4 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-700">Maintenance</div>
              <div className="text-[10px] text-slate-400">View job status</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
