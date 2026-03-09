"use client";

/**
 * Audit dashboard main component.
 *
 * Sub-components (FilterBar, TimelineView, TableView, StatsSidebar)
 * live in ./AuditDashboardParts.tsx
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import type { AuditEvent, AuditStats } from "@/lib/types/admin";
import {
  FilterBar,
  StatsSidebar,
  TableView,
  TimelineView,
  type Filters,
} from "./AuditDashboardParts";

type Props = {
  initialEvents: AuditEvent[];
  initialStats: AuditStats | null;
};

type ViewMode = "timeline" | "table";

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
