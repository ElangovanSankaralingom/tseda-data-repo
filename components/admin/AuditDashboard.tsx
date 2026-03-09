"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  FileText,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from "lucide-react";
import { useCountUp } from "@/hooks/useCountUp";
import type { AuditEvent, AuditStats } from "@/lib/types/admin";

type Props = {
  initialEvents: AuditEvent[];
  initialStats: AuditStats | null;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CREATE: { label: "Created", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  UPDATE: { label: "Updated", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  DELETE: { label: "Deleted", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  REQUEST_EDIT: { label: "Edit Requested", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  GRANT_EDIT: { label: "Edit Granted", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  UPLOAD_ADD: { label: "Upload Added", color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  UPLOAD_REMOVE: { label: "Upload Removed", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  UPLOAD_REPLACE: { label: "Upload Replaced", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

const CATEGORY_LABELS: Record<string, string> = {
  "fdp-attended": "FDP Attended",
  "fdp-conducted": "FDP Conducted",
  "case-studies": "Case Studies",
  "guest-lectures": "Guest Lectures",
  "workshops": "Workshops",
};

type ViewMode = "timeline" | "table";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(ts: string): string {
  const now = Date.now();
  const then = Date.parse(ts);
  if (Number.isNaN(then)) return "-";
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatDateTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function emailName(email: string): string {
  return email.split("@")[0] || email;
}

function groupEventsByDate(events: AuditEvent[]): Map<string, AuditEvent[]> {
  const groups = new Map<string, AuditEvent[]>();
  for (const event of events) {
    const key = event.ts.slice(0, 10);
    const list = groups.get(key);
    if (list) list.push(event);
    else groups.set(key, [event]);
  }
  return groups;
}

function formatDateHeading(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AnimatedCount({ value }: { value: number }) {
  const display = useCountUp(value, 400);
  return <>{display.toLocaleString("en-IN")}</>;
}

function ActionBadge({ action }: { action: string }) {
  const info = ACTION_LABELS[action] ?? { label: action, color: "text-slate-700", bg: "bg-slate-50 border-slate-200" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${info.bg} ${info.color}`}>
      {info.label}
    </span>
  );
}

function StatMini({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100">
        <Icon className="size-5 text-slate-600" />
      </div>
      <div>
        <div className="text-xl font-bold text-slate-900 tracking-tight">
          <AnimatedCount value={value} />
        </div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function ActivitySparkline({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);
  const recent = data.slice(0, 14).reverse();

  return (
    <div className="flex items-end gap-0.5 h-8">
      {recent.map((d) => (
        <div
          key={d.date}
          className="w-2 rounded-sm bg-slate-300 transition-all duration-300 hover:bg-[#1E3A5F]"
          style={{ height: `${Math.max((d.count / max) * 100, 8)}%` }}
          title={`${d.date}: ${d.count} events`}
        />
      ))}
    </div>
  );
}

function ActionBreakdownBar({ stats }: { stats: AuditStats }) {
  const total = stats.totalEvents || 1;
  const actions = Object.entries(stats.byAction).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-2">
      {actions.map(([action, count]) => {
        const info = ACTION_LABELS[action];
        const pct = (count / total) * 100;
        return (
          <div key={action} className="flex items-center gap-3 text-sm">
            <div className="w-28 text-xs text-slate-500 truncate">{info?.label ?? action}</div>
            <div className="relative h-2 flex-1 rounded-full bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-slate-400 transition-all duration-500 animate-grow-width"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-10 text-right text-xs font-medium text-slate-600">{count}</div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

type Filters = {
  search: string;
  action: string;
  category: string;
  dateRange: string;
};

function FilterBar({
  filters,
  onChange,
  onReset,
  resultCount,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  onReset: () => void;
  resultCount: number;
}) {
  const hasFilters = filters.search || filters.action || filters.category || filters.dateRange;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by email, entry ID, or summary..."
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        {/* Action filter */}
        <div className="relative">
          <select
            value={filters.action}
            onChange={(e) => onChange({ ...filters, action: e.target.value })}
            className="select-styled h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm outline-none transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]?.label ?? a}</option>
            ))}
          </select>
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={filters.category}
            onChange={(e) => onChange({ ...filters, category: e.target.value })}
            className="select-styled h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm outline-none transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="relative">
          <select
            value={filters.dateRange}
            onChange={(e) => onChange({ ...filters, dateRange: e.target.value })}
            className="select-styled h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-sm outline-none transition-colors hover:border-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="">All Time</option>
            <option value="1d">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="mt-2 text-xs text-slate-400">
        {resultCount} {resultCount === 1 ? "event" : "events"}
        {hasFilters ? " matching filters" : ""}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline View
// ---------------------------------------------------------------------------

function TimelineEvent({ event, isLast }: { event: AuditEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className="mt-1.5 size-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
        {!isLast && <div className="w-px flex-1 bg-slate-200" />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ActionBadge action={event.action} />
                <span className="text-xs text-slate-400">{formatRelative(event.ts)}</span>
              </div>
              <div className="mt-1.5 text-sm text-slate-700">
                <span className="font-medium text-slate-900">{emailName(event.actorEmail)}</span>
                {event.actorEmail !== event.userEmail && (
                  <>
                    {" on "}
                    <span className="font-medium text-slate-900">{emailName(event.userEmail)}</span>
                    {"'s entry"}
                  </>
                )}
                {" in "}
                <span className="text-slate-600">{CATEGORY_LABELS[event.category] ?? event.category}</span>
              </div>
            </div>
            <ChevronDown className={`size-4 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </div>

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400">Entry ID</span>
                  <div className="font-mono text-slate-600">{event.entryId.slice(0, 8)}...</div>
                </div>
                <div>
                  <span className="text-slate-400">Time</span>
                  <div className="text-slate-600">{formatDateTime(event.ts)}</div>
                </div>
                {event.statusFrom && (
                  <div>
                    <span className="text-slate-400">Status From</span>
                    <div className="text-slate-600">{event.statusFrom}</div>
                  </div>
                )}
                {event.statusTo && (
                  <div>
                    <span className="text-slate-400">Status To</span>
                    <div className="text-slate-600">{event.statusTo}</div>
                  </div>
                )}
              </div>
              {event.summary !== "No tracked field changes." && (
                <div>
                  <span className="text-slate-400">Changes</span>
                  <div className="mt-0.5 text-slate-600">{event.summary}</div>
                </div>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

function TimelineView({ events }: { events: AuditEvent[] }) {
  const grouped = useMemo(() => groupEventsByDate(events), [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
        <Activity className="size-8 text-slate-300 mb-3" />
        <div className="text-sm font-medium text-slate-500">No audit events found</div>
        <div className="mt-1 text-xs text-slate-400">Try adjusting your filters</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([date, dayEvents]) => (
        <div key={date}>
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="size-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700">{formatDateHeading(date)}</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {dayEvents.length}
            </span>
          </div>
          <div className="ml-1">
            {dayEvents.map((event, i) => (
              <TimelineEvent
                key={`${event.ts}:${event.entryId}:${event.action}`}
                event={event}
                isLast={i === dayEvents.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table View
// ---------------------------------------------------------------------------

function TableView({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
        <Activity className="size-8 text-slate-300 mb-3" />
        <div className="text-sm font-medium text-slate-500">No audit events found</div>
        <div className="mt-1 text-xs text-slate-400">Try adjusting your filters</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2.5 font-medium">Time</th>
            <th className="px-3 py-2.5 font-medium">Action</th>
            <th className="px-3 py-2.5 font-medium">Actor</th>
            <th className="px-3 py-2.5 font-medium">Owner</th>
            <th className="px-3 py-2.5 font-medium">Category</th>
            <th className="px-3 py-2.5 font-medium">Entry</th>
            <th className="px-3 py-2.5 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <tr
              key={`${event.ts}:${event.entryId}:${event.action}`}
              className={`border-b border-slate-100 align-top transition-colors hover:bg-slate-50/60 ${
                i < 5 ? `animate-fade-in-up stagger-${Math.min(i + 1, 8)}` : ""
              }`}
            >
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="text-slate-700">{formatRelative(event.ts)}</div>
                <div className="text-xs text-slate-400">{formatDateTime(event.ts)}</div>
              </td>
              <td className="px-3 py-2.5">
                <ActionBadge action={event.action} />
              </td>
              <td className="px-3 py-2.5">
                <div className="font-medium text-slate-700">{emailName(event.actorEmail)}</div>
                <div className="text-xs text-slate-400">{event.actorRole}</div>
              </td>
              <td className="px-3 py-2.5 text-slate-600">{emailName(event.userEmail)}</td>
              <td className="px-3 py-2.5 text-slate-600">{CATEGORY_LABELS[event.category] ?? event.category}</td>
              <td className="px-3 py-2.5">
                <span className="font-mono text-xs text-slate-500">{event.entryId.slice(0, 8)}</span>
              </td>
              <td className="px-3 py-2.5 max-w-[260px]">
                <div className="truncate text-xs text-slate-500" title={event.summary}>
                  {event.summary}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stats Sidebar
// ---------------------------------------------------------------------------

function StatsSidebar({ stats }: { stats: AuditStats }) {
  const uniqueActors = Object.keys(stats.byActor).length;
  const uniqueUsers = Object.keys(stats.byUser).length;

  return (
    <div className="space-y-4">
      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <StatMini label="Total Events" value={stats.totalEvents} icon={Activity} />
        <StatMini label="Active Users" value={uniqueUsers} icon={User} />
        <StatMini label="Actors" value={uniqueActors} icon={Shield} />
        <StatMini label="Categories" value={Object.keys(stats.byCategory).length} icon={FileText} />
      </div>

      {/* Activity sparkline */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Recent Activity</h4>
          <span className="text-xs text-slate-400">Last 14 days</span>
        </div>
        <ActivitySparkline data={stats.recentDays} />
      </div>

      {/* Action breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Action Breakdown</h4>
        <ActionBreakdownBar stats={stats} />
      </div>

      {/* Top categories */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">By Category</h4>
        <div className="space-y-2">
          {Object.entries(stats.byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {/* Most active entries */}
      {stats.topEntries.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">Most Active Entries</h4>
          <div className="space-y-2">
            {stats.topEntries.slice(0, 5).map((entry, i) => (
              <div key={`${entry.category}:${entry.entryId}`} className="flex items-center gap-2 text-xs">
                <span className="flex size-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-slate-600">{entry.entryId.slice(0, 8)}</span>
                  <span className="mx-1 text-slate-300">|</span>
                  <span className="text-slate-400">{emailName(entry.userEmail)}</span>
                </div>
                <span className="text-slate-500 font-medium">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const DEFAULT_FILTERS: Filters = { search: "", action: "", category: "", dateRange: "" };

export default function AuditDashboard({ initialEvents, initialStats }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [stats, setStats] = useState(initialStats);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [view, setView] = useState<ViewMode>("timeline");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Client-side filtering
  const filtered = useMemo(() => {
    let result = events;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.actorEmail.toLowerCase().includes(q) ||
          e.userEmail.toLowerCase().includes(q) ||
          e.entryId.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q)
      );
    }

    if (filters.action) {
      result = result.filter((e) => e.action === filters.action);
    }

    if (filters.category) {
      result = result.filter((e) => e.category === filters.category);
    }

    if (filters.dateRange) {
      const now = Date.now();
      const daysMap: Record<string, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };
      const days = daysMap[filters.dateRange];
      if (days) {
        const cutoff = now - days * 86_400_000;
        result = result.filter((e) => Date.parse(e.ts) >= cutoff);
      }
    }

    return result;
  }, [events, filters]);

  // Refresh from API
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, statsRes] = await Promise.all([
        fetch("/api/admin/audit?limit=500"),
        fetch("/api/admin/audit?mode=stats"),
      ]);
      if (eventsRes.ok) {
        const body = await eventsRes.json();
        if (body.data) setEvents(body.data);
      }
      if (statsRes.ok) {
        const body = await statsRes.json();
        if (body.data) setStats(body.data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* View toggle + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          <button
            onClick={() => setView("timeline")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              view === "timeline"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setView("table")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
              view === "table"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Table
          </button>
        </div>

        <button
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        resultCount={filtered.length}
      />

      {/* Main content: events + sidebar */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Events */}
        <div>
          {view === "timeline" ? (
            <TimelineView events={filtered} />
          ) : (
            <TableView events={filtered} />
          )}
        </div>

        {/* Sidebar stats */}
        {stats && (
          <div className="hidden lg:block">
            <StatsSidebar stats={stats} />
          </div>
        )}
      </div>

      {/* Mobile stats (collapsible) */}
      {stats && (
        <div className="lg:hidden">
          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm">
              <ChevronRight className="size-4 text-slate-400 transition-transform duration-200 group-open:rotate-90" />
              View Statistics
            </summary>
            <div className="mt-3">
              <StatsSidebar stats={stats} />
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
