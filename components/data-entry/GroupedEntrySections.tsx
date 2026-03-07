"use client";

import { useState } from "react";
import {
  Clock,
  ClipboardList,
  Lock,
  Pencil,
  Unlock,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import FilterTabs, { type FilterTab } from "@/components/ui/FilterTabs";
import {
  ENTRY_LIST_GROUP_ORDER,
  type EntryListGroup,
  type ListGroupedEntries,
} from "@/lib/entryCategorization";

// Keep legacy types for backwards compatibility with adapters that haven't migrated
import type { EntryDisplayCategory } from "@/lib/entries/displayLifecycle";

export type GroupedEntries<TEntry> = {
  draft: TEntry[];
  activated: TEntry[];
  completed: TEntry[];
};

export type GroupedEntryRender<TEntry> = (
  entry: TEntry,
  category: EntryDisplayCategory,
  index: number
) => React.ReactNode;

// --- New smart grouping types ---

export type SmartGroupedEntryRender<TEntry> = (
  entry: TEntry,
  group: EntryListGroup,
  index: number
) => React.ReactNode;

type SectionConfig = {
  title: string;
  icon: LucideIcon;
  iconColor: string;
};

const SECTION_CONFIGS: Record<EntryListGroup, SectionConfig> = {
  streak_runners: { title: "STREAK RUNNERS", icon: Zap, iconColor: "text-amber-500" },
  on_the_clock: { title: "ON THE CLOCK", icon: Clock, iconColor: "text-blue-500" },
  unlocked: { title: "UNLOCKED", icon: Unlock, iconColor: "text-purple-500" },
  in_the_works: { title: "IN THE WORKS", icon: Pencil, iconColor: "text-slate-400" },
  under_review: { title: "UNDER REVIEW", icon: Clock, iconColor: "text-amber-400" },
  locked_in: { title: "LOCKED IN", icon: Lock, iconColor: "text-emerald-500" },
};

type FilterKey = "all" | "active" | "drafts" | "finalized" | "pending";

const ACTIVE_GROUPS: Set<EntryListGroup> = new Set(["streak_runners", "on_the_clock", "unlocked"]);

function getFilterGroups(filterKey: FilterKey): Set<EntryListGroup> | null {
  if (filterKey === "all") return null; // show all
  if (filterKey === "active") return ACTIVE_GROUPS;
  if (filterKey === "drafts") return new Set(["in_the_works"]);
  if (filterKey === "finalized") return new Set(["locked_in"]);
  if (filterKey === "pending") return new Set(["under_review"]);
  return null;
}

function SectionHeader({ group, count }: { group: EntryListGroup; count: number }) {
  const config = SECTION_CONFIGS[group];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`size-5 ${config.iconColor}`} />
        <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          {config.title}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
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
}: {
  group: EntryListGroup;
  items: TEntry[];
  renderEntry: SmartGroupedEntryRender<TEntry>;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <SectionHeader group={group} count={items.length} />
      {items.map((entry, index) => renderEntry(entry, group, index))}
    </div>
  );
}

function DefaultEmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
        <ClipboardList className="size-8 text-slate-400" />
      </div>
      <p className="mt-4 text-base font-medium text-slate-600">No entries yet</p>
      <p className="mt-1 text-sm text-slate-400">Create your first entry to get started</p>
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

// --- Smart grouped entry sections (new 6-group system) ---

type SmartGroupedEntrySectionsProps<TEntry> = {
  groupedEntries: ListGroupedEntries<TEntry>;
  renderEntry: SmartGroupedEntryRender<TEntry>;
  emptyState?: React.ReactNode;
};

export function SmartGroupedEntrySections<TEntry>({
  groupedEntries,
  renderEntry,
  emptyState,
}: SmartGroupedEntrySectionsProps<TEntry>) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const hasEntries = ENTRY_LIST_GROUP_ORDER.some((key) => groupedEntries[key].length > 0);

  if (!hasEntries) {
    return <>{emptyState ?? <DefaultEmptyState />}</>;
  }

  const tabs = buildFilterTabs(groupedEntries);
  const allowedGroups = getFilterGroups(activeFilter);

  return (
    <div className="space-y-5">
      <FilterTabs
        tabs={tabs}
        activeKey={activeFilter}
        onChange={(key) => setActiveFilter(key as FilterKey)}
      />
      {ENTRY_LIST_GROUP_ORDER.map((group) => {
        if (allowedGroups && !allowedGroups.has(group)) return null;
        return (
          <Section
            key={group}
            group={group}
            items={groupedEntries[group]}
            renderEntry={renderEntry}
          />
        );
      })}
    </div>
  );
}

// --- Legacy grouped entry sections (backwards compat) ---

type GroupedEntrySectionsProps<TEntry> = {
  groupedEntries: GroupedEntries<TEntry>;
  renderEntry: GroupedEntryRender<TEntry>;
  draftTitle?: string;
  activatedTitle?: string;
  completedTitle?: string;
  emptyState?: React.ReactNode;
};

export type GroupedEntryListCardConfig<TEntry> = {
  title: string;
  subtitle?: string;
  className?: string;
  groupedEntries: ListGroupedEntries<TEntry>;
  renderEntry: SmartGroupedEntryRender<TEntry>;
  emptyState?: React.ReactNode;
};

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
  return {
    title,
    subtitle,
    className,
    content: (
      <SmartGroupedEntrySections
        groupedEntries={groupedEntries}
        renderEntry={renderEntry}
        emptyState={emptyState}
      />
    ),
  };
}
