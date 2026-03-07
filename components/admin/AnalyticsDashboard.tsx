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
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  Flame,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import type { AnalyticsSnapshot } from "@/lib/analytics/compute";
import {
  compare,
  filterByDateRange,
  daysAgo,
  groupAndCount,
} from "@/lib/analytics/compare";

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

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CATEGORY_COLORS: Record<string, string> = {
  "fdp-attended": "#3B82F6",
  "fdp-conducted": "#8B5CF6",
  "case-studies": "#F59E0B",
  "guest-lectures": "#10B981",
  workshops: "#EF4444",
};

function catColor(slug: string) {
  return CATEGORY_COLORS[slug] ?? "#64748B";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AnimatedCount({ value, suffix }: { value: number; suffix?: string }) {
  const count = useCountUp(value);
  return (
    <span>
      {count.toLocaleString("en-IN")}
      {suffix}
    </span>
  );
}

function ComparisonBadge({ current, previous }: { current: number; previous: number }) {
  const c = compare(current, previous);
  if (c.direction === "flat") {
    return (
      <span className="flex items-center gap-0.5 text-xs text-slate-400">
        <Minus className="size-3" /> No change
      </span>
    );
  }
  const isUp = c.direction === "up";
  return (
    <span
      className={`flex items-center gap-0.5 text-xs font-medium ${
        isUp ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {Math.abs(c.percentChange)}% vs prev
    </span>
  );
}

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

type MetricCardProps = {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  accent: string;
  iconBg: string;
  iconColor: string;
  hoverRing: string;
  current: number;
  previous: number;
  suffix?: string;
  stagger: number;
};

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
  iconBg,
  iconColor,
  hoverRing,
  current,
  previous,
  suffix,
  stagger,
}: MetricCardProps) {
  return (
    <div
      className={`group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg animate-fade-in-up ${accent} ${hoverRing} stagger-${stagger}`}
    >
      <div
        className={`flex size-10 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 ${iconBg}`}
      >
        <Icon className={`size-5 ${iconColor}`} />
      </div>
      <div className="mt-3">
        <div className="text-3xl font-bold tabular-nums text-slate-900">
          <AnimatedCount value={value} suffix={suffix} />
        </div>
        <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </div>
      </div>
      <div className="mt-2">
        <ComparisonBadge current={current} previous={previous} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Area Chart
// ---------------------------------------------------------------------------

function AreaChart({
  data,
  previousData,
  width = 700,
  height = 200,
}: {
  data: { label: string; value: number }[];
  previousData?: { label: string; value: number }[];
  width?: number;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-slate-400">
        Not enough data for chart
      </div>
    );
  }

  const padY = 24;
  const padX = 40;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const allValues = [
    ...data.map((d) => d.value),
    ...(previousData ?? []).map((d) => d.value),
  ];
  const maxVal = Math.max(...allValues, 1);

  function toPoint(i: number, v: number) {
    const x = padX + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const y = padY + chartH - (v / maxVal) * chartH;
    return { x, y };
  }

  const points = data.map((d, i) => toPoint(i, d.value));
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${padX},${padY + chartH} ${line} ${points[points.length - 1].x},${padY + chartH}`;

  const prevPoints = previousData?.map((d, i) => toPoint(i, d.value));
  const prevLine = prevPoints?.map((p) => `${p.x},${p.y}`).join(" ");

  // Y axis labels
  const yLabels = [0, Math.round(maxVal / 2), maxVal];

  // X axis labels (show first, middle, last)
  const xLabelIndices = data.length <= 5
    ? data.map((_, i) => i)
    : [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0F172A" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yLabels.map((v) => {
        const y = padY + chartH - (v / maxVal) * chartH;
        return (
          <g key={v}>
            <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#E2E8F0" strokeWidth="1" />
            <text x={padX - 6} y={y + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
              {v}
            </text>
          </g>
        );
      })}
      {/* Previous period line */}
      {prevLine && (
        <polyline
          points={prevLine}
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}
      {/* Area fill */}
      <polygon points={area} fill="url(#areaFill)" />
      {/* Main line */}
      <polyline points={line} fill="none" stroke="#0F172A" strokeWidth="2" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#0F172A">
          <title>
            {data[i].label}: {data[i].value}
          </title>
        </circle>
      ))}
      {/* X labels */}
      {xLabelIndices.map((i) => {
        const p = points[i];
        if (!p) return null;
        return (
          <text
            key={i}
            x={p.x}
            y={height - 4}
            textAnchor="middle"
            className="fill-slate-400 text-[10px]"
          >
            {data[i].label}
          </text>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Donut Chart
// ---------------------------------------------------------------------------

function DonutChart({
  segments,
  total,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
}) {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = 70;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const pctVal = total > 0 ? s.value / total : 0;
      const dash = pctVal * circumference;
      const arc = { ...s, dash, gap: circumference - dash, offset };
      offset += dash;
      return arc;
    });

  return (
    <div className="flex flex-col items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="16"
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            className="transition-all duration-500"
          >
            <title>
              {arc.label}: {arc.value} ({pct(arc.value, total)}%)
            </title>
          </circle>
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-slate-900 text-2xl font-bold"
        >
          {total}
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-slate-400 text-[10px] uppercase tracking-wide"
        >
          entries
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
              <span className="font-medium">{s.value}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

function Heatmap({ entries }: { entries: { date: string }[] }) {
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      map[e.date] = (map[e.date] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  // Build last 12 weeks of dates
  const weeks = useMemo(() => {
    const result: string[][] = [];
    const today = new Date();
    const startDay = new Date(today);
    startDay.setDate(startDay.getDate() - 83); // ~12 weeks
    // Align to Monday
    while (startDay.getDay() !== 1) startDay.setDate(startDay.getDate() - 1);

    let current = new Date(startDay);
    let week: string[] = [];
    while (current <= today) {
      week.push(current.toISOString().slice(0, 10));
      if (week.length === 7) {
        result.push(week);
        week = [];
      }
      current = new Date(current);
      current.setDate(current.getDate() + 1);
    }
    if (week.length > 0) result.push(week);
    return result;
  }, []);

  function cellColor(count: number) {
    if (count === 0) return "bg-slate-100";
    if (count <= 2) return "bg-emerald-200";
    if (count <= 5) return "bg-emerald-400";
    if (count <= 10) return "bg-emerald-600";
    return "bg-emerald-800";
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {/* Day labels */}
        <div className="flex shrink-0 flex-col gap-1 pr-1 pt-0">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="flex h-3 w-4 items-center text-[9px] text-slate-400">
              {i % 2 === 0 ? d : ""}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((date) => {
              const c = counts[date] ?? 0;
              return (
                <div
                  key={date}
                  className={`size-3 rounded-sm ${cellColor(c)} transition-colors`}
                  title={`${date}: ${c} ${c === 1 ? "entry" : "entries"}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <span>Less</span>
        <span className="size-3 rounded-sm bg-slate-100" />
        <span className="size-3 rounded-sm bg-emerald-200" />
        <span className="size-3 rounded-sm bg-emerald-400" />
        <span className="size-3 rounded-sm bg-emerald-600" />
        <span className="size-3 rounded-sm bg-emerald-800" />
        <span>More</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------

function Leaderboard({ users }: { users: { email: string; name: string; entryCount: number; streakWins: number }[] }) {
  const top = users.slice(0, 10);
  if (top.length === 0) {
    return <div className="text-sm text-slate-400">No users with entries yet</div>;
  }

  const medals = ["👑", "🥈", "🥉"];
  const podium = top.slice(0, 3);
  const rest = top.slice(3);

  return (
    <div className="space-y-4">
      {/* Podium */}
      <div className="flex items-end justify-center gap-3">
        {[1, 0, 2].map((idx) => {
          const user = podium[idx];
          if (!user) return <div key={idx} className="w-28" />;
          const isFirst = idx === 0;
          return (
            <div
              key={user.email}
              className={`flex w-28 flex-col items-center rounded-xl border p-3 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                isFirst
                  ? "border-amber-200 bg-gradient-to-b from-amber-50 to-white shadow-sm"
                  : "border-slate-200 bg-gradient-to-b from-slate-50 to-white"
              } ${isFirst ? "pb-5" : "pb-3"}`}
            >
              <span className="text-xl">{medals[idx]}</span>
              <div
                className={`mt-1 flex items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 ${
                  isFirst ? "size-14" : "size-10"
                }`}
              >
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="mt-2 w-full truncate text-xs font-semibold text-slate-800">
                {user.name}
              </div>
              <div className="text-lg font-bold text-slate-900">{user.entryCount}</div>
              <div className="text-[10px] text-slate-400">entries</div>
              {user.streakWins > 0 && (
                <div className="mt-1 flex items-center gap-0.5 text-[10px] text-amber-600">
                  <Trophy className="size-3" /> {user.streakWins}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Rest */}
      {rest.length > 0 && (
        <div className="rounded-lg border border-slate-200">
          {rest.map((user, i) => (
            <div
              key={user.email}
              className={`flex items-center gap-3 px-4 py-2.5 ${
                i % 2 === 0 ? "bg-white" : "bg-slate-50"
              } ${i < rest.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              <span className="w-5 text-xs font-bold text-slate-400">#{i + 4}</span>
              <div className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                {user.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-700">{user.name}</div>
              </div>
              <div className="text-sm font-semibold tabular-nums text-slate-900">
                {user.entryCount}
              </div>
              {user.streakWins > 0 && (
                <div className="flex items-center gap-0.5 text-xs text-amber-600">
                  <Trophy className="size-3" /> {user.streakWins}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Streak Funnel
// ---------------------------------------------------------------------------

function StreakFunnel({
  total,
  activated,
  wins,
}: {
  total: number;
  activated: number;
  wins: number;
}) {
  const bars = [
    { label: "Total Eligible", value: activated + wins, color: "bg-slate-500" },
    { label: "In Progress", value: activated, color: "bg-amber-500" },
    { label: "Completed", value: wins, color: "bg-emerald-500" },
  ];
  const maxVal = Math.max(...bars.map((b) => b.value), 1);

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{bar.label}</span>
            <span className="font-semibold text-slate-800">{bar.value}</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${bar.color} transition-all duration-700`}
              style={{ width: `${pct(bar.value, maxVal)}%` }}
            />
          </div>
        </div>
      ))}
      {total > 0 && (
        <div className="text-xs text-slate-400">
          Completion rate: {pct(wins, activated + wins)}%
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Row
// ---------------------------------------------------------------------------

function CategoryRow({
  slug,
  name,
  count,
  maxCount,
  growth,
  statusBreakdown,
}: {
  slug: string;
  name: string;
  count: number;
  maxCount: number;
  growth: { current: number; previous: number };
  statusBreakdown: Record<string, number>;
}) {
  const [expanded, setExpanded] = useState(false);
  const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const c = compare(growth.current, growth.previous);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: catColor(slug) }} />
        <span className="w-28 shrink-0 truncate text-sm font-medium text-slate-700 sm:w-36">{name}</span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{ width: `${barPct}%`, backgroundColor: catColor(slug) }}
          />
        </div>
        <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-800">
          {count}
        </span>
        {c.direction !== "flat" && (
          <span
            className={`text-[10px] font-medium ${
              c.direction === "up" ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {c.direction === "up" ? "↑" : "↓"} {Math.abs(c.percentChange)}%
          </span>
        )}
        <ChevronDown
          className={`size-4 text-slate-300 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
      {expanded && Object.keys(statusBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2.5 pl-9">
          {Object.entries(statusBreakdown).map(([status, cnt]) => (
            <span
              key={status}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
            >
              {status}: {cnt}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SH({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

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
