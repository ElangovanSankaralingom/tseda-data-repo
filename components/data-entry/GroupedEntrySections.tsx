"use client";

import { useMemo, useState } from "react";
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
import {
  ENTRY_LIST_GROUP_ORDER,
  type EntryListGroup,
  type ListGroupedEntries,
} from "@/lib/entryCategorization";

// Keep legacy types for backwards compatibility with adapters that haven't migrated
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

export type { GroupedEntries, GroupedEntryRender, GroupedEntryListCardConfig, ListStats, SmartGroupedEntryRender };

const SECTION_CONFIGS: Record<EntryListGroup, SectionConfig> = {
  streak_runners: { title: "STREAK RUNNERS", icon: Zap, iconColor: "text-amber-500", urgentColor: "text-amber-600" },
  on_the_clock: { title: "ON THE CLOCK", icon: Clock, iconColor: "text-blue-500", urgentColor: "text-blue-600" },
  unlocked: { title: "UNLOCKED", icon: Unlock, iconColor: "text-purple-500" },
  in_the_works: { title: "IN THE WORKS", icon: Pencil, iconColor: "text-slate-500" },
  under_review: { title: "UNDER REVIEW", icon: Clock, iconColor: "text-amber-400" },
  locked_in: { title: "LOCKED IN", icon: Lock, iconColor: "text-emerald-500" },
};

import { type FilterKey } from "@/lib/types/ui";

const ACTIVE_GROUPS: Set<EntryListGroup> = new Set(["streak_runners", "on_the_clock", "unlocked"]);

function getFilterGroups(filterKey: FilterKey): Set<EntryListGroup> | null {
  if (filterKey === "all") return null; // show all
  if (filterKey === "active") return ACTIVE_GROUPS;
  if (filterKey === "drafts") return new Set(["in_the_works"]);
  if (filterKey === "finalized") return new Set(["locked_in"]);
  if (filterKey === "pending") return new Set(["under_review"]);
  return null;
}

function SectionHeader({ group, count, isUrgent }: { group: EntryListGroup; count: number; isUrgent?: boolean }) {
  const config = SECTION_CONFIGS[group];
  const Icon = config.icon;
  const color = isUrgent && config.urgentColor ? config.urgentColor : config.iconColor;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`inline-block ${isUrgent ? "animate-subtle-pulse" : ""}`}>
          <Icon className={`size-4 ${color}`} />
        </span>
        <span className={`text-xs font-bold uppercase tracking-wider ${isUrgent ? color : "text-slate-500"}`}>
          {config.title}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {count}
        </span>
      </div>
      <div className="h-px bg-slate-200" />
    </div>
  );
}

function Section<TEntry>({
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
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader group={group} count={items.length} isUrgent={isUrgent} />
      {items.map((entry, index) => renderEntry(entry, group, index))}
    </div>
  );
}

function DefaultEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
        <ClipboardList className="size-8 text-slate-700" />
      </div>
      <p className="mt-4 text-base font-medium text-slate-700">No entries yet</p>
      <p className="mt-1 text-sm text-slate-600">Create your first entry to get started</p>
    </div>
  );
}

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <Search className="mx-auto size-8 text-slate-700" />
      <p className="mt-3 text-sm text-slate-600">No entries match your filters</p>
      <p className="mt-1 text-xs text-slate-600">Try different keywords or clear your filters</p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
      >
        Clear filters
      </button>
    </div>
  );
}

function buildFilterTabs<TEntry>(groups: ListGroupedEntries<TEntry>): FilterTab[] {
  const total = ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => sum + groups[key].length, 0);
  const activeCount = groups.streak_runners.length + groups.on_the_clock.length + groups.unlocked.length;

  return [
    { key: "all", label: "All", count: total },
    { key: "active", label: "Active", count: activeCount },
    { key: "drafts", label: "Drafts", count: groups.in_the_works.length },
    { key: "finalized", label: "Finalized", count: groups.locked_in.length },
    { key: "pending", label: "Pending", count: groups.under_review.length },
  ];
}

function entryMatchesSearch(entry: unknown, query: string): boolean {
  const lower = query.toLowerCase();
  const str = JSON.stringify(entry).toLowerCase();
  return str.includes(lower);
}

// --- Smart grouped entry sections (new 6-group system) ---

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

export function SmartGroupedEntrySections<TEntry>({
  groupedEntries,
  renderEntry,
  emptyState,
  searchable = false,
  activeClassName,
}: SmartGroupedEntrySectionsProps<TEntry>) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
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

  if (!hasEntries) {
    return <>{emptyState ?? <DefaultEmptyState />}</>;
  }

  const tabs = buildFilterTabs(filteredGroups);
  const allowedGroups = getFilterGroups(activeFilter);
  const totalFiltered = ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => {
    if (allowedGroups && !allowedGroups.has(key)) return sum;
    return sum + filteredGroups[key].length;
  }, 0);
  const totalAll = ENTRY_LIST_GROUP_ORDER.reduce((sum, key) => sum + groupedEntries[key].length, 0);
  const isFiltered = searchQuery.trim() !== "" || activeFilter !== "all";

  return (
    <div className="space-y-4">
      {/* Search + Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {searchable && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entries..."
              aria-label="Search entries"
              className="h-9 w-full rounded-xl bg-slate-100 pl-9 pr-8 text-sm text-slate-700 outline-none placeholder:text-slate-500 focus:bg-white focus:ring-2 focus:ring-slate-300 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
        <FilterTabs
          tabs={tabs}
          activeKey={activeFilter}
          onChange={(key) => setActiveFilter(key as FilterKey)}
          activeClassName={activeClassName}
        />
      </div>

      {/* Showing count */}
      {isFiltered && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Showing {totalFiltered} of {totalAll} entries</span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setActiveFilter("all"); }}
              className="text-slate-500 hover:text-slate-700 underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Grouped sections */}
      {totalFiltered === 0 && isFiltered ? (
        <FilteredEmptyState onClear={() => { setSearchQuery(""); setActiveFilter("all"); }} />
      ) : (
        ENTRY_LIST_GROUP_ORDER.map((group) => {
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
        })
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
  // Legacy component — convert old 3-bucket format to new 6-bucket format
  const smartGroups: ListGroupedEntries<TEntry> = {
    streak_runners: [],
    on_the_clock: [],
    unlocked: [],
    in_the_works: groupedEntries.draft,
    under_review: [],
    locked_in: groupedEntries.completed,
  };
  // Put activated entries in streak_runners as best guess
  smartGroups.streak_runners = groupedEntries.activated;

  const smartRender: SmartGroupedEntryRender<TEntry> = (entry, _group, index) => {
    // Map back to legacy category for the render callback
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
  className = "bg-white/70 p-5",
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
