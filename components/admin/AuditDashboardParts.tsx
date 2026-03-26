"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Calendar,
  ChevronDown,
  FileText,
  Search,
  Shield,
  User,
  X,
} from "lucide-react";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { useCountUp } from "@/hooks/useCountUp";
import type { AuditEvent, AuditStats } from "@/lib/types/admin";

export const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  CREATE: { label: "Created", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  UPDATE: { label: "Updated", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  DELETE: { label: "Deleted", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  REQUEST_EDIT: { label: "Edit Requested", color: "text-amber-900", bg: "bg-amber-50 border-amber-200" },
  GRANT_EDIT: { label: "Edit Granted", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  UPLOAD_ADD: { label: "Upload Added", color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
  UPLOAD_REMOVE: { label: "Upload Removed", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  UPLOAD_REPLACE: { label: "Upload Replaced", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
};

export const ALL_ACTIONS = Object.keys(ACTION_LABELS);

export const CATEGORY_LABELS: Record<string, string> = {
  "fdp-attended": "FDP Attended",
  "fdp-conducted": "FDP Conducted",
  "case-studies": "Case Studies",
  "guest-lectures": "Guest Lectures",
  "workshops": "Workshops",
};

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

function AnimatedCount({ value }: { value: number }) {
  const display = useCountUp(value, 400);
  return <>{display.toLocaleString("en-IN")}</>;
}

function ActionBadge({ action }: { action: string }) {
  const info = ACTION_LABELS[action] ?? { label: action, color: "text-[var(--color-text-primary)]", bg: "bg-[var(--color-dropdown-hover)] border-[var(--color-card-border)]" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${info.bg} ${info.color}`}>
      {info.label}
    </span>
  );
}

function StatMini({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-dropdown-hover)]">
        <Icon className="size-5 text-[var(--color-text-secondary)]" />
      </div>
      <div>
        <div className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
          <AnimatedCount value={value} />
        </div>
        <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
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
          className="w-2 rounded-sm bg-[var(--color-text-muted)] transition-all duration-300 hover:bg-[var(--color-button-primary-bg)]"
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
            <div className="w-28 text-xs text-[var(--color-text-secondary)] truncate">{info?.label ?? action}</div>
            <div className="relative h-2 flex-1 rounded-full bg-[var(--color-dropdown-hover)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-text-muted)] transition-all duration-500 animate-grow-width"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-10 text-right text-xs font-medium text-[var(--color-text-secondary)]">{count}</div>
          </div>
        );
      })}
    </div>
  );
}

export type Filters = {
  search: string;
  action: string;
  category: string;
  dateRange: string;
};

export function FilterBar({
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
    <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by email, entry ID, or summary..."
            aria-label="Search audit logs"
            className="h-9 w-full rounded-lg border border-[var(--color-card-border)] bg-[var(--color-input-bg)] pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-text-primary)]/10"
          />
        </div>

        <div className="w-36">
          <SelectDropdown
            value={filters.action}
            onChange={(value) => onChange({ ...filters, action: value })}
            options={[
              { label: "All Actions", value: "" },
              ...ALL_ACTIONS.map((a) => ({ label: ACTION_LABELS[a]?.label ?? a, value: a })),
            ]}
            placeholder="All Actions"
          />
        </div>

        <div className="w-40">
          <SelectDropdown
            value={filters.category}
            onChange={(value) => onChange({ ...filters, category: value })}
            options={[
              { label: "All Categories", value: "" },
              ...Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ label, value: key })),
            ]}
            placeholder="All Categories"
          />
        </div>

        <div className="w-36">
          <SelectDropdown
            value={filters.dateRange}
            onChange={(value) => onChange({ ...filters, dateRange: value })}
            options={[
              { label: "All Time", value: "" },
              { label: "Last 24 Hours", value: "1d" },
              { label: "Last 7 Days", value: "7d" },
              { label: "Last 30 Days", value: "30d" },
              { label: "Last 90 Days", value: "90d" },
            ]}
            placeholder="All Time"
          />
        </div>

        {hasFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] hover:text-[var(--color-text-primary)]"
          >
            <X className="size-3.5" />
            Clear
          </button>
        )}
      </div>

      <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
        {resultCount} {resultCount === 1 ? "event" : "events"}
        {hasFilters ? " matching filters" : ""}
      </div>
    </div>
  );
}

function TimelineEvent({ event, isLast }: { event: AuditEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className="mt-1.5 size-2.5 rounded-full bg-[var(--color-text-muted)] ring-4 ring-[var(--color-card-bg)]" />
        {!isLast && <div className="w-px flex-1 bg-[var(--color-card-border)]" />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="group w-full rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-3 text-left shadow-sm transition-all duration-200 hover:border-[var(--color-text-muted)] hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <ActionBadge action={event.action} />
                <span className="text-xs text-[var(--color-text-secondary)]">{formatRelative(event.ts)}</span>
              </div>
              <div className="mt-1.5 text-sm text-[var(--color-text-primary)]">
                <span className="font-medium text-[var(--color-text-primary)]">{emailName(event.actorEmail)}</span>
                {event.actorEmail !== event.userEmail && (
                  <>
                    {" on "}
                    <span className="font-medium text-[var(--color-text-primary)]">{emailName(event.userEmail)}</span>
                    {"'s entry"}
                  </>
                )}
                {" in "}
                <span className="text-[var(--color-text-secondary)]">{CATEGORY_LABELS[event.category] ?? event.category}</span>
              </div>
            </div>
            <ChevronDown className={`size-4 text-[var(--color-text-secondary)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </div>

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-[var(--color-card-border)] pt-3 text-xs animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[var(--color-text-secondary)]">Entry ID</span>
                  <div className="font-mono text-[var(--color-text-secondary)]">{event.entryId.slice(0, 8)}...</div>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">Time</span>
                  <div className="text-[var(--color-text-secondary)]">{formatDateTime(event.ts)}</div>
                </div>
                {event.statusFrom && (
                  <div>
                    <span className="text-[var(--color-text-secondary)]">Status From</span>
                    <div className="text-[var(--color-text-secondary)]">{event.statusFrom}</div>
                  </div>
                )}
                {event.statusTo && (
                  <div>
                    <span className="text-[var(--color-text-secondary)]">Status To</span>
                    <div className="text-[var(--color-text-secondary)]">{event.statusTo}</div>
                  </div>
                )}
              </div>
              {event.summary !== "No tracked field changes." && (
                <div>
                  <span className="text-[var(--color-text-secondary)]">Changes</span>
                  <div className="mt-0.5 text-[var(--color-text-secondary)]">{event.summary}</div>
                </div>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export function TimelineView({ events }: { events: AuditEvent[] }) {
  const grouped = useMemo(() => groupEventsByDate(events), [events]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-card-border)] bg-[var(--color-card-bg)] py-16 text-center">
        <Activity className="size-8 text-[var(--color-text-muted)] mb-3" />
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">No audit events found</div>
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">Try adjusting your filters</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([date, dayEvents]) => (
        <div key={date}>
          <div className="mb-3 flex items-center gap-2">
            <Calendar className="size-4 text-[var(--color-text-secondary)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{formatDateHeading(date)}</h3>
            <span className="rounded-full bg-[var(--color-dropdown-hover)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
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

export function TableView({ events }: { events: AuditEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-card-border)] bg-[var(--color-card-bg)] py-16 text-center">
        <Activity className="size-8 text-[var(--color-text-muted)] mb-3" />
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">No audit events found</div>
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">Try adjusting your filters</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-card-border)] bg-[var(--color-dropdown-hover)] text-left text-xs uppercase tracking-wide text-[var(--color-text-primary)]">
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
              className={`border-b border-[var(--color-card-border)] align-top transition-colors hover:bg-[var(--color-dropdown-hover)] ${
                i < 5 ? `animate-fade-in-up stagger-${Math.min(i + 1, 8)}` : ""
              }`}
            >
              <td className="px-3 py-2.5 whitespace-nowrap">
                <div className="text-[var(--color-text-primary)]">{formatRelative(event.ts)}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{formatDateTime(event.ts)}</div>
              </td>
              <td className="px-3 py-2.5">
                <ActionBadge action={event.action} />
              </td>
              <td className="px-3 py-2.5">
                <div className="font-medium text-[var(--color-text-primary)]">{emailName(event.actorEmail)}</div>
                <div className="text-xs text-[var(--color-text-secondary)]">{event.actorRole}</div>
              </td>
              <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{emailName(event.userEmail)}</td>
              <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{CATEGORY_LABELS[event.category] ?? event.category}</td>
              <td className="px-3 py-2.5">
                <span className="font-mono text-xs text-[var(--color-text-secondary)]">{event.entryId.slice(0, 8)}</span>
              </td>
              <td className="px-3 py-2.5 max-w-[260px]">
                <div className="truncate text-xs text-[var(--color-text-secondary)]" title={event.summary}>
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

export function StatsSidebar({ stats }: { stats: AuditStats }) {
  const uniqueActors = Object.keys(stats.byActor).length;
  const uniqueUsers = Object.keys(stats.byUser).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatMini label="Total Events" value={stats.totalEvents} icon={Activity} />
        <StatMini label="Active Users" value={uniqueUsers} icon={User} />
        <StatMini label="Actors" value={uniqueActors} icon={Shield} />
        <StatMini label="Categories" value={Object.keys(stats.byCategory).length} icon={FileText} />
      </div>

      <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Activity</h4>
          <span className="text-xs text-[var(--color-text-secondary)]">Last 14 days</span>
        </div>
        <ActivitySparkline data={stats.recentDays} />
      </div>

      <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Action Breakdown</h4>
        <ActionBreakdownBar stats={stats} />
      </div>

      <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">By Category</h4>
        <div className="space-y-2">
          {Object.entries(stats.byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="rounded-full bg-[var(--color-dropdown-hover)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {stats.topEntries.length > 0 && (
        <div className="rounded-xl border border-[var(--color-card-border)] bg-[var(--color-card-bg)] p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Most Active Entries</h4>
          <div className="space-y-2">
            {stats.topEntries.slice(0, 5).map((entry, i) => (
              <div key={`${entry.category}:${entry.entryId}`} className="flex items-center gap-2 text-xs">
                <span className="flex size-5 items-center justify-center rounded-full bg-[var(--color-dropdown-hover)] text-[10px] font-bold text-[var(--color-text-secondary)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[var(--color-text-secondary)]">{entry.entryId.slice(0, 8)}</span>
                  <span className="mx-1 text-[var(--color-text-muted)]">|</span>
                  <span className="text-[var(--color-text-secondary)]">{emailName(entry.userEmail)}</span>
                </div>
                <span className="text-[var(--color-text-secondary)] font-medium">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
