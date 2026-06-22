"use client";

import { useCallback, useMemo, useState } from "react";
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
import { formatDate, formatNumber } from "@/lib/i18n/locale";
import type { AuditEvent, AuditStats } from "@/lib/types/admin";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n";
import { CATEGORY_SLUGS } from "@/data/categoryRegistry";

export const ACTION_COLOR: Record<string, { color: string; bg: string }> = {
  CREATE: { color: "text-[var(--color-status-success)]", bg: "bg-[var(--color-status-success-bg)] border-[var(--color-status-success-border)]" },
  UPDATE: { color: "text-[var(--color-status-info)]", bg: "bg-[var(--color-status-info-bg)] border-[var(--color-status-info-border)]" },
  DELETE: { color: "text-[var(--color-status-error)]", bg: "bg-[var(--color-status-error-bg)] border-[var(--color-status-error-border)]" },
  REQUEST_EDIT: { color: "text-[var(--color-status-warning)]", bg: "bg-[var(--color-status-warning-bg)] border-[var(--color-status-warning-border)]" },
  GRANT_EDIT: { color: "text-[var(--color-palette-purple-fg)]", bg: "bg-[var(--color-palette-purple-bg)] border-[var(--color-palette-purple-border)]" },
  UPLOAD_ADD: { color: "text-[var(--color-palette-cyan-fg)]", bg: "bg-[var(--color-palette-cyan-bg)] border-[var(--color-palette-cyan-border)]" },
  UPLOAD_REMOVE: { color: "text-[var(--color-palette-orange-fg)]", bg: "bg-[var(--color-palette-orange-bg)] border-[var(--color-palette-orange-border)]" },
  UPLOAD_REPLACE: { color: "text-[var(--color-palette-indigo-fg)]", bg: "bg-[var(--color-palette-indigo-bg)] border-[var(--color-palette-indigo-border)]" },
};

const ACTION_LABEL_KEYS: Record<string, TranslationKey> = {
  CREATE: "adminAudit.actionCreated",
  UPDATE: "adminAudit.actionUpdated",
  DELETE: "adminAudit.actionDeleted",
  REQUEST_EDIT: "adminAudit.actionEditRequested",
  GRANT_EDIT: "adminAudit.actionEditGranted",
  UPLOAD_ADD: "adminAudit.actionUploadAdded",
  UPLOAD_REMOVE: "adminAudit.actionUploadRemoved",
  UPLOAD_REPLACE: "adminAudit.actionUploadReplaced",
};

export const ALL_ACTIONS = Object.keys(ACTION_COLOR);

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
  return formatDate(new Date(then), "en", { day: "numeric", month: "short" });
}

function formatDateTime(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "-";
  return formatDate(d, "en", {
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

// formatDateHeading is now inside components that use t()

function AnimatedCount({ value }: { value: number }) {
  const display = useCountUp(value, 400);
  return <>{formatNumber(display, "en")}</>;
}

function ActionBadge({ action }: { action: string }) {
  const { t } = useTranslation();
  const colorInfo = ACTION_COLOR[action] ?? { color: "text-[var(--color-text-primary)]", bg: "bg-[var(--color-dropdown-hover)] border-[var(--color-glass-border)]" };
  const labelKey = ACTION_LABEL_KEYS[action];
  const label = labelKey ? t(labelKey) : action;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorInfo.bg} ${colorInfo.color}`}>
      {label}
    </span>
  );
}

function StatMini({ label, value, icon: Icon, accent = "var(--color-primary)" }: { label: string; value: number; icon: typeof Activity; accent?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex size-10 items-center justify-center rounded-lg" style={{ backgroundColor: accent }}>
        <Icon className="size-5 text-[var(--color-text-on-accent)]" />
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
  const { t } = useTranslation();
  const total = stats.totalEvents || 1;
  const actions = Object.entries(stats.byAction).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-2">
      {actions.map(([action, count]) => {
        const labelKey = ACTION_LABEL_KEYS[action];
        const label = labelKey ? t(labelKey) : action;
        const pct = (count / total) * 100;
        return (
          <div key={action} className="flex items-center gap-3 text-sm">
            <div className="w-28 text-xs text-[var(--color-text-secondary)] truncate">{label}</div>
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
  const { t, categoryLabel } = useTranslation();
  const hasFilters = filters.search || filters.action || filters.category || filters.dateRange;

  const actionOptions = useMemo(() => [
    { label: t("adminAudit.allActions"), value: "" },
    ...ALL_ACTIONS.map((a) => {
      const key = ACTION_LABEL_KEYS[a];
      return { label: key ? t(key) : a, value: a };
    }),
  ], [t]);

  const categoryOptions = useMemo(() => [
    { label: t("adminAudit.allCategories"), value: "" },
    ...CATEGORY_SLUGS.map((slug) => ({
      label: categoryLabel(slug),
      value: slug,
    })),
  ], [t, categoryLabel]);

  const dateRangeOptions = useMemo(() => [
    { label: t("adminAudit.allTime"), value: "" },
    { label: t("adminAudit.last24h"), value: "1d" },
    { label: t("adminAudit.last7d"), value: "7d" },
    { label: t("adminAudit.last30d"), value: "30d" },
    { label: t("adminAudit.last90d"), value: "90d" },
  ], [t]);

  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder={t("adminAudit.searchPlaceholder")}
            aria-label={t("adminAudit.searchAriaLabel")}
            className="h-9 w-full rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-input-bg)] pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-text-primary)]/10"
          />
        </div>

        <div className="w-36">
          <SelectDropdown
            value={filters.action}
            onChange={(value) => onChange({ ...filters, action: value })}
            options={actionOptions}
            placeholder={t("adminAudit.allActions")}
          />
        </div>

        <div className="w-40">
          <SelectDropdown
            value={filters.category}
            onChange={(value) => onChange({ ...filters, category: value })}
            options={categoryOptions}
            placeholder={t("adminAudit.allCategories")}
          />
        </div>

        <div className="w-36">
          <SelectDropdown
            value={filters.dateRange}
            onChange={(value) => onChange({ ...filters, dateRange: value })}
            options={dateRangeOptions}
            placeholder={t("adminAudit.allTime")}
          />
        </div>

        {hasFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] hover:text-[var(--color-text-primary)]"
          >
            <X className="size-3.5" />
            {t("adminAudit.clear")}
          </button>
        )}
      </div>

      <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
        {resultCount} {resultCount === 1 ? t("adminAudit.event") : t("adminAudit.events")}
        {hasFilters ? ` ${t("adminAudit.matchingFilters")}` : ""}
      </div>
    </div>
  );
}

function TimelineEvent({ event, isLast }: { event: AuditEvent; isLast: boolean }) {
  const { t, categoryLabel } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center">
        <div className="mt-1.5 size-2.5 rounded-full bg-[var(--color-text-muted)] ring-4 ring-[var(--color-glass-bg)]" />
        {!isLast && <div className="w-px flex-1 bg-[var(--color-glass-border)]" />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="group w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-3 text-left shadow-sm transition-all duration-200 hover:border-[var(--color-text-muted)] hover:shadow-md"
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
                    {` ${t("adminAudit.on")} `}
                    <span className="font-medium text-[var(--color-text-primary)]">{emailName(event.userEmail)}</span>
                    {t("adminAudit.sEntry")}
                  </>
                )}
                {` ${t("adminAudit.in")} `}
                <span className="text-[var(--color-text-secondary)]">{categoryLabel(event.category)}</span>
              </div>
            </div>
            <ChevronDown className={`size-4 text-[var(--color-text-secondary)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </div>

          {expanded && (
            <div className="mt-3 space-y-2 border-t border-[var(--color-glass-border)] pt-3 text-xs animate-fade-in">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[var(--color-text-secondary)]">{t("adminAudit.colEntryId")}</span>
                  <div className="font-mono text-[var(--color-text-secondary)]">{event.entryId.slice(0, 8)}...</div>
                </div>
                <div>
                  <span className="text-[var(--color-text-secondary)]">{t("adminAudit.colTime")}</span>
                  <div className="text-[var(--color-text-secondary)]">{formatDateTime(event.ts)}</div>
                </div>
                {event.statusFrom && (
                  <div>
                    <span className="text-[var(--color-text-secondary)]">{t("adminAudit.colStatusFrom")}</span>
                    <div className="text-[var(--color-text-secondary)]">{event.statusFrom}</div>
                  </div>
                )}
                {event.statusTo && (
                  <div>
                    <span className="text-[var(--color-text-secondary)]">{t("adminAudit.colStatusTo")}</span>
                    <div className="text-[var(--color-text-secondary)]">{event.statusTo}</div>
                  </div>
                )}
              </div>
              {event.summary !== t("adminAudit.noTrackedFieldChanges") && (
                <div>
                  <span className="text-[var(--color-text-secondary)]">{t("adminAudit.colChanges")}</span>
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
  const { t } = useTranslation();
  const grouped = useMemo(() => groupEventsByDate(events), [events]);

  const formatDateHeading = useCallback((dateStr: string): string => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    if (dateStr === today) return t("adminAudit.today");
    if (dateStr === yesterday) return t("adminAudit.yesterday");
    return formatDate(new Date(dateStr), "en", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [t]);

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-inset)] py-16 text-center">
        <Activity className="size-8 text-[var(--color-text-muted)] mb-3" />
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">{t("adminAudit.noEventsFound")}</div>
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("adminAudit.tryAdjustingFilters")}</div>
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
  const { t, categoryLabel } = useTranslation();

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-inset)] py-16 text-center">
        <Activity className="size-8 text-[var(--color-text-muted)] mb-3" />
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">{t("adminAudit.noEventsFound")}</div>
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("adminAudit.tryAdjustingFilters")}</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] shadow-sm">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-glass-border)] bg-[var(--color-dropdown-hover)] text-left text-xs uppercase tracking-wide text-[var(--color-text-primary)]">
            <th className="px-3 py-2.5 font-medium">{t("adminAudit.colTime")}</th>
            <th className="px-3 py-2.5 font-medium">{t("adminAudit.colAction")}</th>
            <th className="px-3 py-2.5 font-medium">{t("adminAudit.colActor")}</th>
            <th className="px-3 py-2.5 font-medium">{t("adminAudit.colOwner")}</th>
            <th className="px-3 py-2.5 font-medium">{t("adminAudit.colCategory")}</th>
            <th className="px-3 py-2.5 font-medium">{t("adminAudit.colEntry")}</th>
            <th className="px-3 py-2.5 font-medium">{t("adminAudit.colDetails")}</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <tr
              key={`${event.ts}:${event.entryId}:${event.action}`}
              className={`border-b border-[var(--color-glass-border)] align-top transition-colors hover:bg-[var(--color-dropdown-hover)] ${
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
              <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{categoryLabel(event.category)}</td>
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
  const { t, categoryLabel } = useTranslation();
  const uniqueActors = Object.keys(stats.byActor).length;
  const uniqueUsers = Object.keys(stats.byUser).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatMini label={t("adminAudit.totalEvents")} value={stats.totalEvents} icon={Activity} accent="var(--color-status-info)" />
        <StatMini label={t("adminAudit.activeUsers")} value={uniqueUsers} icon={User} accent="var(--color-status-success)" />
        <StatMini label={t("adminAudit.actors")} value={uniqueActors} icon={Shield} accent="var(--color-palette-purple-fg)" />
        <StatMini label={t("adminAudit.categories")} value={Object.keys(stats.byCategory).length} icon={FileText} accent="var(--color-palette-amber-fg)" />
      </div>

      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{t("adminAudit.recentActivity")}</h4>
          <span className="text-xs text-[var(--color-text-secondary)]">{t("adminAudit.last14Days")}</span>
        </div>
        <ActivitySparkline data={stats.recentDays} />
      </div>

      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">{t("adminAudit.actionBreakdown")}</h4>
        <ActionBreakdownBar stats={stats} />
      </div>

      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">{t("adminAudit.byCategory")}</h4>
        <div className="space-y-2">
          {Object.entries(stats.byCategory)
            .sort(([, a], [, b]) => b - a)
            .map(([cat, count]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">{categoryLabel(cat)}</span>
                <span className="rounded-full bg-[var(--color-dropdown-hover)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">{count}</span>
              </div>
            ))}
        </div>
      </div>

      {stats.topEntries.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-card-bg)] p-4 shadow-sm">
          <h4 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">{t("adminAudit.mostActiveEntries")}</h4>
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
