"use client";

import { memo, useMemo, useState, useCallback } from "react";
import {
  Clock,
  ClipboardList,
  Lock,
  Flame,
  Pencil,
  Search,
  Unlock,
  X,
} from "lucide-react";
import FilterTabs, { type FilterTab } from "@/components/ui/FilterTabs";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  ENTRY_LIST_GROUP_ORDER,
  type EntryListGroup,
  type ListGroupedEntries,
} from "@/lib/entryCategorization";

import type { EntryDisplayCategory } from "@/lib/entries/displayLifecycle";
import {
  type GroupedEntries,
  type GroupedEntryRender,
  type GroupedEntrySectionsProps,
  type GroupedEntryListCardConfig,
  type ListStats,
  type SectionConfig,
  type SmartGroupedEntryRender,
  type SmartGroupedEntrySectionsProps,
} from "./dataEntryTypes";
import {
  GROUP_HEX,
  GROUP_CONTAINERS,
} from "@/components/entry/entryCardStyles";

export type { GroupedEntries, GroupedEntryRender, GroupedEntryListCardConfig, ListStats, SmartGroupedEntryRender };

/*
  ─────────────────────────────────────────────────────────
   LAYERED SECTION SYSTEM

   Each group of entries lives inside a CONTAINER SURFACE —
   a visual wrapper that establishes the group's identity.

   Active groups get tinted containers with soft borders.
   Drafts get NO container — flat, inline, minimal.
   Finalized gets a dark RECESSED container.
   Under review gets a dashed outline container.

   The SEGMENTED STATUS BAR is CHUNKY — solid blocks of
   color with bold counts. Not thin glass lines.

   ┌═══ STREAK RUNNERS (warm amber container) ═══════════┐
   │                                                       │
   │  ⚡ Streak Runners ──────────────────── 3             │
   │                                                       │
   │  [card] [card] [card]                                 │
   │                                                       │
   └═══════════════════════════════════════════════════════┘

   ✏ In The Works ────────────────────────── 4
   [card] [card] [card] [card]

   ┌─ ─ ─ UNDER REVIEW (dashed orange) ─ ─ ─ ─ ─ ─ ─ ─ ┐
   │  🕐 Under Review ──────────────────── 1              │
   │  [card]                                               │
   └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

   ┌══ LOCKED IN (dark recessed) ════════════════════════┐
   │  🔒 Locked In ─────────────────────── 8              │
   │  [card] [card] ...                                    │
   └══════════════════════════════════════════════════════┘
  ─────────────────────────────────────────────────────────
*/

const SECTION_CONFIGS: Record<EntryListGroup, SectionConfig> = {
  streak_runners: { title: "entry.streakRunners", icon: Flame, iconColor: "text-[var(--color-palette-amber-fg)]", urgentColor: "text-[var(--color-status-warning)]" },
  on_the_clock: { title: "entry.onTheClock", icon: Clock, iconColor: "text-[var(--color-palette-blue-fg)]", urgentColor: "text-[var(--color-status-info)]" },
  unlocked: { title: "entry.unlocked", icon: Unlock, iconColor: "text-[var(--color-palette-blue-fg)]" },
  in_the_works: { title: "entry.inTheWorks", icon: Pencil, iconColor: "text-[var(--color-text-secondary)]" },
  under_review: { title: "entry.underReview", icon: Clock, iconColor: "text-[var(--color-palette-orange-fg)]" },
  locked_in: { title: "entry.lockedIn", icon: Lock, iconColor: "text-[var(--color-status-success)]" },
};

/* Segment identity colors — same hue source as GROUP_HEX (entryCardStyles). */
const SEGMENT_COLORS: Record<EntryListGroup, string> = {
  streak_runners: "var(--color-palette-amber-fg)",
  on_the_clock: "var(--color-palette-blue-fg)",
  unlocked: "var(--color-palette-blue-fg)",
  in_the_works: "var(--color-text-tertiary)",
  under_review: "var(--color-palette-orange-fg)",
  locked_in: "var(--color-status-success)",
};

const SEGMENT_TEXT_COLORS: Record<EntryListGroup, string> = {
  streak_runners: "text-[var(--color-palette-amber-fg)]",
  on_the_clock: "text-[var(--color-palette-blue-fg)]",
  unlocked: "text-[var(--color-palette-blue-fg)]",
  in_the_works: "text-[var(--color-text-tertiary)]",
  under_review: "text-[var(--color-palette-orange-fg)]",
  locked_in: "text-[var(--color-status-success)]",
};

import { type FilterKey } from "@/lib/types/ui";

const ACTIVE_GROUPS: Set<EntryListGroup> = new Set(["streak_runners", "on_the_clock", "unlocked"]);

function getFilterGroups(filterKey: FilterKey): Set<EntryListGroup> | null {
  if (filterKey === "all") return null;
  if (filterKey === "active") return ACTIVE_GROUPS;
  if (filterKey === "drafts") return new Set(["in_the_works"]);
  if (filterKey === "finalized") return new Set(["locked_in"]);
  if (filterKey === "pending") return new Set(["under_review"]);
  return null;
}

/* ── CHUNKY Segmented Status Bar ──
   Solid blocks. Bold counts. Not thin glass.
   Each segment is a fat colored block with the count
   rendered large inside. Clicking filters.
*/
function SegmentedStatusBar<TEntry>({
  groups,
  activeGroup,
  onSelect,
}: {
  groups: ListGroupedEntries<TEntry>;
  activeGroup: EntryListGroup | null;
  onSelect: (group: EntryListGroup | null) => void;
}) {
  const { t } = useTranslation();
  const total = ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => sum + groups[key].length, 0);
  if (total === 0) return null;

  const activeSegments = ENTRY_LIST_GROUP_ORDER.filter(g => groups[g].length > 0);

  return (
    <div className="space-y-2.5">
      {/* Chunky segmented bar */}
      <div
        className="flex h-11 overflow-hidden rounded-2xl"
        style={{
          background: "var(--color-card-bg)",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), inset 0 1px 2px rgba(20,30,70,0.04), 0 1px 2px rgba(20,30,70,0.04)",
        }}
      >
        {activeSegments.map((group, i) => {
          const count = groups[group].length;
          const pct = (count / total) * 100;
          const isActive = activeGroup === group;
          const isFiltered = activeGroup !== null && !isActive;
          const config = SECTION_CONFIGS[group];
          const Icon = config.icon;
          const hex = GROUP_HEX[group];

          return (
            <button
              key={group}
              type="button"
              onClick={() => onSelect(isActive ? null : group)}
              className={`relative flex items-center justify-center gap-1.5 transition-all duration-400 ${
                isFiltered ? "opacity-40" : "opacity-100"
              }`}
              style={{
                width: `${Math.max(pct, 10)}%`,
                background: isActive
                  ? `linear-gradient(135deg, color-mix(in srgb, ${hex} 26%, transparent) 0%, color-mix(in srgb, ${hex} 18%, transparent) 100%)`
                  : `color-mix(in srgb, ${hex} 12%, transparent)`,
                borderRight: i < activeSegments.length - 1
                  ? "1px solid var(--color-card-border)"
                  : "none",
              }}
              aria-label={`${t(config.title as Parameters<typeof t>[0])}: ${count}`}
            >
              {/* Active indicator glow */}
              {isActive && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow: `inset 0 -3px 0 color-mix(in srgb, ${hex} 50%, transparent), inset 0 0 16px color-mix(in srgb, ${hex} 13%, transparent)`,
                  }}
                />
              )}
              <Icon className={`size-3.5 shrink-0 ${SEGMENT_TEXT_COLORS[group]}`} />
              <span className={`text-sm font-black tabular-nums ${SEGMENT_TEXT_COLORS[group]}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Legend row — only when not filtered */}
      {activeGroup === null && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-1">
          {activeSegments.map((group) => (
            <span key={group} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)]">
              <span
                className="size-1.5 rounded-sm"
                style={{ background: SEGMENT_COLORS[group] }}
              />
              {t(SECTION_CONFIGS[group].title as Parameters<typeof t>[0])}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Section Header — with timeline dot connector ── */
function SectionHeader({ group, count, isUrgent }: {
  group: EntryListGroup;
  count: number;
  isUrgent?: boolean;
}) {
  const { t } = useTranslation();
  const config = SECTION_CONFIGS[group];
  const Icon = config.icon;
  const color = isUrgent && config.urgentColor ? config.urgentColor : config.iconColor;
  const hex = GROUP_HEX[group];

  return (
    <div className="flex items-center gap-2.5 mb-3 animate-section-header" style={{ animationDelay: "50ms" }}>
      <div
        className={`flex size-7 items-center justify-center rounded-lg ${isUrgent ? "animate-status-glow" : ""}`}
        style={{
          background: hex,
          boxShadow: `0 4px 12px color-mix(in srgb, ${hex} 35%, transparent)`,
          "--glow-color": `color-mix(in srgb, ${hex} 35%, transparent)`,
        } as React.CSSProperties}
      >
        <Icon className={`size-3.5 text-[var(--color-text-on-accent)] ${isUrgent ? "animate-subtle-pulse" : ""}`} />
      </div>
      <span className={`text-sm font-bold uppercase tracking-wider ${isUrgent ? color : "text-[var(--color-text-secondary)]"}`}>
        {t(config.title as Parameters<typeof t>[0])}
      </span>
      <span
        className="flex size-6 items-center justify-center rounded-md font-mono text-xs font-black"
        style={{
          background: `color-mix(in srgb, ${hex} 15%, transparent)`,
          color: `${hex}`,
          border: `1.5px solid color-mix(in srgb, ${hex} 21%, transparent)`,
        }}
      >
        {count}
      </span>
      <div className="flex-1 h-[2px]" style={{ background: `linear-gradient(to right, color-mix(in srgb, ${hex} 21%, transparent), transparent)` }} />
    </div>
  );
}

/*
  ── COLLAPSED STACK ──
  For groups with many entries (finalized), show the first
  COLLAPSE_THRESHOLD items normally, then collapse the rest
  into a physical "stacked cards" peek view with a count.
  Click to expand.

  ┌─ entry 1 ─────────────────────┐
  ├─ entry 2 ─────────────────────┤
  ├─ entry 3 ─────────────────────┤
  │  ┌─────────────────────────┐  │
  │  │   + 5 more entries      │  │
  │  │  ┌───────────────────┐  │  │
  │  │  │                   │  │  │
  │  └──┴───────────────────┘──┘  │
*/
const COLLAPSE_THRESHOLD = 3;

function CollapsedStack({ count, hex, onExpand }: { count: number; hex: string; onExpand: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onExpand}
      className="relative w-full group/stack"
      aria-label={`Show ${count} more entries`}
    >
      {/* Stacked card peek — two layers behind */}
      <div
        className="absolute top-2 left-2 right-2 h-8 rounded-lg"
        style={{ background: `color-mix(in srgb, ${hex} 2%, transparent)`, border: `1px solid color-mix(in srgb, ${hex} 3%, transparent)` }}
      />
      <div
        className="absolute top-1 left-1 right-1 h-8 rounded-lg"
        style={{ background: `color-mix(in srgb, ${hex} 3%, transparent)`, border: `1px solid color-mix(in srgb, ${hex} 6%, transparent)` }}
      />
      {/* Front card */}
      <div
        className="relative rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all duration-200 group-hover/stack:translate-y-[-1px]"
        style={{
          background: `color-mix(in srgb, ${hex} 7%, transparent)`,
          border: `1px solid color-mix(in srgb, ${hex} 13%, transparent)`,
        }}
      >
        <span className="font-mono text-sm font-bold" style={{ color: hex }}>
          +{count}
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {t('common.more')} {count === 1 ? t('dashboard.entry') : t('dashboard.entries')}
        </span>
      </div>
    </button>
  );
}

/* ── Section Container — WRAPS cards in a container surface ── */
function SectionContainer<TEntry>({
  group,
  items,
  renderEntry,
  isUrgent,
}: {
  group: EntryListGroup;
  items: TEntry[];
  renderEntry: SmartGroupedEntryRender<TEntry>;
  isUrgent?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;

  const container = GROUP_CONTAINERS[group];
  const hex = GROUP_HEX[group];

  // Determine if this section should collapse
  const shouldCollapse = (group === "locked_in" || group === "in_the_works") && items.length > COLLAPSE_THRESHOLD && !expanded;
  const visibleItems = shouldCollapse ? items.slice(0, COLLAPSE_THRESHOLD) : items;
  const hiddenCount = shouldCollapse ? items.length - COLLAPSE_THRESHOLD : 0;
  const expandedItems = expanded ? items.slice(COLLAPSE_THRESHOLD) : [];

  // Groups WITH container surface — wrapped in a tinted/bordered panel
  // This creates the LAYERING — each section has its own visual identity
  if (container.hasContainer) {
    // locked_in rows have no gap between them (bottom dividers handle spacing)
    const innerSpacing = group === "locked_in" ? "space-y-0" : "space-y-2.5";

    return (
      <div
        className={`rounded-2xl ${group === "locked_in" ? "overflow-hidden" : ""} ${container.padding}`}
        style={{
          background: container.background,
          border: container.border,
        }}
      >
        <SectionHeader group={group} count={items.length} isUrgent={isUrgent} />
        <div className={innerSpacing}>
          {visibleItems.map((entry, index) => renderEntry(entry, group, index))}
          {expanded && expandedItems.length > 0 && (
            <div className={`animate-section-expand ${innerSpacing}`}>
              {expandedItems.map((entry, index) => renderEntry(entry, group, COLLAPSE_THRESHOLD + index))}
            </div>
          )}
          {shouldCollapse && (
            <CollapsedStack count={hiddenCount} hex={hex} onExpand={() => setExpanded(true)} />
          )}
        </div>
      </div>
    );
  }

  // Groups WITHOUT container — flat, inline (drafts)
  return (
    <div>
      <SectionHeader group={group} count={items.length} isUrgent={isUrgent} />
      <div className="space-y-2">
        {visibleItems.map((entry, index) => renderEntry(entry, group, index))}
        {expanded && expandedItems.length > 0 && (
          <div className="animate-section-expand space-y-2">
            {expandedItems.map((entry, index) => renderEntry(entry, group, COLLAPSE_THRESHOLD + index))}
          </div>
        )}
        {shouldCollapse && (
          <CollapsedStack count={hiddenCount} hex={hex} onExpand={() => setExpanded(true)} />
        )}
      </div>
    </div>
  );
}

const Section = memo(SectionContainer) as typeof SectionContainer;

/* ── Empty States ── */
function DefaultEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl p-10 text-center"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px dashed var(--color-border-subtle)",
      }}
    >
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--color-glass-bg)" }}
      >
        <ClipboardList className="size-8" style={{ color: "var(--color-text-muted)" }} />
      </div>
      <p className="mt-4 text-base font-medium" style={{ color: "var(--color-text-muted)" }}>{t('entry.noEntries')}</p>
      <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>{t('entry.createFirstToStart')}</p>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: "var(--color-surface-raised)",
        border: "1px dashed var(--color-border-subtle)",
      }}
    >
      <Search className="mx-auto size-8" style={{ color: "var(--color-text-muted)" }} />
      <p className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>{t('entry.noEntriesMatch')}</p>
      <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>{t('entry.tryDifferentFilters')}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-glass-hover)] transition-colors"
      >
        {t('entry.clearFilters')}
      </button>
    </div>
  );
}

function buildFilterTabs<TEntry>(groups: ListGroupedEntries<TEntry>, t: (key: string) => string): FilterTab[] {
  const total = ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => sum + groups[key].length, 0);
  const activeCount = groups.streak_runners.length + groups.on_the_clock.length + groups.unlocked.length;

  return [
    { key: "all", label: t('common.all'), count: total },
    { key: "active", label: t('common.active'), count: activeCount },
    { key: "drafts", label: t('common.drafts'), count: groups.in_the_works.length },
    { key: "finalized", label: t('common.finalized'), count: groups.locked_in.length },
    { key: "pending", label: t('common.pending'), count: groups.under_review.length },
  ];
}

function entryMatchesSearch(entry: unknown, query: string): boolean {
  const lower = query.toLowerCase();
  const str = JSON.stringify(entry).toLowerCase();
  return str.includes(lower);
}

// --- Smart grouped entry sections ---

export function computeListStats<T>(groups: ListGroupedEntries<T>): ListStats {
  return {
    total: ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => sum + groups[key].length, 0),
    drafts: groups.in_the_works.length,
    active: groups.streak_runners.length + groups.on_the_clock.length + groups.unlocked.length,
    finalized: groups.locked_in.length,
    pending: groups.under_review.length,
    streakActive: groups.streak_runners.length,
  };
}

/** Map a single group filter back to a FilterKey for interop */
function groupToFilterKey(group: EntryListGroup | null): FilterKey {
  if (!group) return "all";
  if (group === "in_the_works") return "drafts";
  if (group === "locked_in") return "finalized";
  if (group === "under_review") return "pending";
  return "all";
}

export function SmartGroupedEntrySections<TEntry>({
  groupedEntries,
  renderEntry,
  emptyState,
  searchable = false,
  activeClassName,
}: SmartGroupedEntrySectionsProps<TEntry>) {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [segmentGroup, setSegmentGroup] = useState<EntryListGroup | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const hasEntries = ENTRY_LIST_GROUP_ORDER.some((key) => groupedEntries[key].length > 0);

  // Filter entries by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groupedEntries;
    const filtered: ListGroupedEntries<TEntry> = {
      streak_runners: [],
      on_the_clock: [],
      unlocked: [],
      in_the_works: [],
      under_review: [],
      locked_in: [],
    };
    for (const key of ENTRY_LIST_GROUP_ORDER) {
      filtered[key] = groupedEntries[key].filter((e) => entryMatchesSearch(e, searchQuery));
    }
    return filtered;
  }, [groupedEntries, searchQuery]);

  const handleSegmentSelect = useCallback((group: EntryListGroup | null) => {
    setSegmentGroup(group);
    setActiveFilter(groupToFilterKey(group));
  }, []);

  if (!hasEntries) {
    return <>{emptyState ?? <DefaultEmptyState />}</>;
  }

  const tabs = buildFilterTabs(filteredGroups, t as (key: string) => string);
  // If segment bar selected a specific group, use that. Otherwise use filter tabs.
  const allowedGroups = segmentGroup
    ? new Set([segmentGroup])
    : getFilterGroups(activeFilter);

  const totalFiltered = ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => {
    if (allowedGroups && !allowedGroups.has(key)) return sum;
    return sum + filteredGroups[key].length;
  }, 0);
  const totalAll = ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => sum + groupedEntries[key].length, 0);
  const isFiltered = searchQuery.trim() !== "" || activeFilter !== "all" || segmentGroup !== null;

  return (
    <div className="space-y-5">
      {/* ── Chunky Segmented Status Bar ── */}
      <SegmentedStatusBar
        groups={filteredGroups}
        activeGroup={segmentGroup}
        onSelect={handleSegmentSelect}
      />

      {/* ── Search + Filter Tabs ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {searchable && (
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--color-icon-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('entry.searchEntries')}
              aria-label="Search entries"
              className="h-8 w-full rounded-xl bg-[var(--color-input-bg)] pl-9 pr-8 text-xs text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-placeholder)] focus:ring-1 focus:ring-[var(--color-input-focus-ring)] transition-all border border-transparent focus:border-[var(--color-input-border)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-icon-muted)] hover:text-[var(--color-icon-default)]"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        )}
        <FilterTabs
          tabs={tabs}
          activeKey={activeFilter}
          onChange={(key) => { setActiveFilter(key as FilterKey); setSegmentGroup(null); }}
          activeClassName={activeClassName}
        />
      </div>

      {/* Showing count */}
      {isFiltered && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] px-1">
          <span>{t('common.showing')} {totalFiltered} {t('common.of')} {totalAll} {t('dashboard.entries')}</span>
          {(searchQuery || segmentGroup) && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setActiveFilter("all"); setSegmentGroup(null); }}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] underline"
            >
              {t('common.clear')}
            </button>
          )}
        </div>
      )}

      {/* ═══ ENTRIES — no wrapper container, cards float directly ═══ */}
      {totalFiltered === 0 && isFiltered ? (
        <FilteredEmptyState onClear={() => { setSearchQuery(""); setActiveFilter("all"); setSegmentGroup(null); }} />
      ) : (
        <div className="space-y-4">
          {ENTRY_LIST_GROUP_ORDER.map((group) => {
            if (allowedGroups && !allowedGroups.has(group)) return null;
            return (
              <Section
                key={group}
                group={group}
                items={filteredGroups[group]}
                renderEntry={renderEntry}
                isUrgent={group === "streak_runners" || group === "on_the_clock"}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Legacy grouped entry sections (backwards compat) ---

export default function GroupedEntrySections<TEntry>({
  groupedEntries,
  renderEntry,
  emptyState,
}: GroupedEntrySectionsProps<TEntry>) {
  const smartGroups: ListGroupedEntries<TEntry> = {
    streak_runners: [],
    on_the_clock: [],
    unlocked: [],
    in_the_works: groupedEntries.draft,
    under_review: [],
    locked_in: groupedEntries.completed,
  };
  smartGroups.streak_runners = groupedEntries.activated;

  const smartRender: SmartGroupedEntryRender<TEntry> = (entry, _group, index) => {
    const legacyCategory: EntryDisplayCategory =
      _group === "in_the_works" ? "draft"
        : _group === "locked_in" ? "completed"
          : "streak_active";
    return renderEntry(entry, legacyCategory, index);
  };

  return (
    <SmartGroupedEntrySections
      groupedEntries={smartGroups}
      renderEntry={smartRender}
      emptyState={emptyState}
    />
  );
}

export function createGroupedEntryListCard<TEntry>({
  title,
  subtitle,
  className = "bg-[var(--color-glass-bg)]/70 p-5",
  groupedEntries,
  renderEntry,
  emptyState,
}: GroupedEntryListCardConfig<TEntry>) {
  const stats = computeListStats(groupedEntries);
  return {
    title,
    subtitle,
    className,
    stats,
    content: (
      <SmartGroupedEntrySections
        groupedEntries={groupedEntries}
        renderEntry={renderEntry}
        emptyState={emptyState}
        searchable
      />
    ),
  };
}
