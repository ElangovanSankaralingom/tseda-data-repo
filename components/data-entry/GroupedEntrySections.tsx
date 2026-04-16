"use client";

import { memo, useMemo, useState, useCallback } from "react";
import {
  Clock,
  ClipboardList,
  Lock,
  Pencil,
  Search,
  Unlock,
  X,
  Zap,
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
  streak_runners: { title: "entry.streakRunners", icon: Zap, iconColor: "text-amber-400", urgentColor: "text-amber-500" },
  on_the_clock: { title: "entry.onTheClock", icon: Clock, iconColor: "text-blue-400", urgentColor: "text-blue-500" },
  unlocked: { title: "entry.unlocked", icon: Unlock, iconColor: "text-purple-400" },
  in_the_works: { title: "entry.inTheWorks", icon: Pencil, iconColor: "text-[var(--color-text-secondary)]" },
  under_review: { title: "entry.underReview", icon: Clock, iconColor: "text-orange-400" },
  locked_in: { title: "entry.lockedIn", icon: Lock, iconColor: "text-emerald-500" },
};

const SEGMENT_COLORS: Record<EntryListGroup, string> = {
  streak_runners: "#fbbf24",
  on_the_clock: "#60a5fa",
  unlocked: "#c084fc",
  in_the_works: "rgba(255,255,255,0.15)",
  under_review: "#fb923c",
  locked_in: "#84cc16",
};

const SEGMENT_TEXT_COLORS: Record<EntryListGroup, string> = {
  streak_runners: "text-amber-300",
  on_the_clock: "text-blue-300",
  unlocked: "text-purple-300",
  in_the_works: "text-white/50",
  under_review: "text-orange-300",
  locked_in: "text-emerald-300",
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
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.04)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.3)",
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
                isFiltered ? "opacity-25 saturate-50" : "opacity-100"
              }`}
              style={{
                width: `${Math.max(pct, 10)}%`,
                background: isActive
                  ? `linear-gradient(135deg, ${hex}50 0%, ${hex}30 100%)`
                  : `${hex}25`,
                borderRight: i < activeSegments.length - 1
                  ? "1px solid rgba(0,0,0,0.5)"
                  : "none",
              }}
              aria-label={`${t(config.title as Parameters<typeof t>[0])}: ${count}`}
            >
              {/* Active indicator glow */}
              {isActive && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    boxShadow: `inset 0 -3px 0 ${hex}80, inset 0 0 16px ${hex}20`,
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
            <span key={group} className="inline-flex items-center gap-1.5 text-[10px] text-white/25">
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
    <div className="flex items-center gap-2.5 mb-3 relative">
      {/* Timeline connector dot */}
      <div className="absolute -left-[29px] top-1/2 -translate-y-1/2 flex flex-col items-center z-10">
        <div
          className="size-[7px] rounded-full"
          style={{
            background: `${hex}80`,
            boxShadow: `0 0 6px ${hex}30`,
            border: `1px solid ${hex}40`,
          }}
        />
      </div>

      <div
        className="flex size-6 items-center justify-center rounded-lg"
        style={{
          background: `${hex}25`,
          border: `1px solid ${hex}35`,
        }}
      >
        <Icon className={`size-3 ${color} ${isUrgent ? "animate-subtle-pulse" : ""}`} />
      </div>
      <span className={`text-xs font-bold uppercase tracking-wider ${isUrgent ? color : "text-white/50"}`}>
        {t(config.title as Parameters<typeof t>[0])}
      </span>
      <span
        className="flex size-5 items-center justify-center rounded-md font-mono text-[10px] font-black"
        style={{
          background: `${hex}25`,
          color: `${hex}`,
          border: `1px solid ${hex}30`,
        }}
      >
        {count}
      </span>
      <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, ${hex}30, transparent)` }} />
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
        style={{ background: `${hex}06`, border: `1px solid ${hex}08` }}
      />
      <div
        className="absolute top-1 left-1 right-1 h-8 rounded-lg"
        style={{ background: `${hex}08`, border: `1px solid ${hex}10` }}
      />
      {/* Front card */}
      <div
        className="relative rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all duration-200 group-hover/stack:translate-y-[-1px]"
        style={{
          background: `${hex}12`,
          border: `1px solid ${hex}20`,
        }}
      >
        <span className="font-mono text-sm font-bold" style={{ color: hex }}>
          +{count}
        </span>
        <span className="text-xs text-white/35">
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

  // Locked-in gets a 2-column grid layout for its compact cards
  const isGrid = group === "locked_in";

  // Groups WITH container surface — wrapped in a tinted/bordered panel
  if (container.hasContainer) {
    return (
      <div
        className={`rounded-2xl ${container.padding}`}
        style={{
          background: container.background,
          border: container.border,
        }}
      >
        <SectionHeader group={group} count={items.length} isUrgent={isUrgent} />
        <div className={isGrid ? "grid grid-cols-1 sm:grid-cols-2 gap-2.5" : "space-y-2.5"}>
          {visibleItems.map((entry, index) => renderEntry(entry, group, index))}
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
        background: "rgba(255,255,255,0.015)",
        border: "1px dashed rgba(255,255,255,0.06)",
      }}
    >
      <div
        className="mx-auto flex size-16 items-center justify-center rounded-2xl"
        style={{ background: "rgba(255,255,255,0.03)" }}
      >
        <ClipboardList className="size-8 text-white/15" />
      </div>
      <p className="mt-4 text-base font-medium text-white/40">{t('entry.noEntries')}</p>
      <p className="mt-1 text-sm text-white/20">{t('entry.createFirstToStart')}</p>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="rounded-2xl p-8 text-center"
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px dashed rgba(255,255,255,0.06)",
      }}
    >
      <Search className="mx-auto size-8 text-white/15" />
      <p className="mt-3 text-sm text-white/40">{t('entry.noEntriesMatch')}</p>
      <p className="mt-1 text-xs text-white/20">{t('entry.tryDifferentFilters')}</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium text-white/30 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
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
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('entry.searchEntries')}
              aria-label="Search entries"
              className="h-8 w-full rounded-xl bg-white/[0.03] pl-9 pr-8 text-xs text-white/50 outline-none placeholder:text-white/15 focus:bg-white/[0.05] focus:ring-1 focus:ring-white/10 transition-all border border-transparent focus:border-white/[0.06]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"
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
        <div className="flex items-center gap-2 text-xs text-white/20 px-1">
          <span>{t('common.showing')} {totalFiltered} {t('common.of')} {totalAll} {t('dashboard.entries')}</span>
          {(searchQuery || segmentGroup) && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setActiveFilter("all"); setSegmentGroup(null); }}
              className="text-white/30 hover:text-white/50 underline"
            >
              {t('common.clear')}
            </button>
          )}
        </div>
      )}

      {/* ═══ ENTRIES CONTAINER — "RECENT ACTIVITY" style panel ═══ */}
      {totalFiltered === 0 && isFiltered ? (
        <FilteredEmptyState onClear={() => { setSearchQuery(""); setActiveFilter("all"); setSegmentGroup(null); }} />
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Subtle top accent line */}
          <div
            className="h-px"
            style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 50%, transparent 100%)" }}
          />
          {/* Timeline spine container — vertical line on the left */}
          <div className="relative pl-8 pr-5 py-5">
            {/* Vertical timeline line — very subtle */}
            <div
              className="absolute left-[18px] top-8 bottom-8 w-px"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 60%, transparent 100%)",
              }}
            />
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
          </div>
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
