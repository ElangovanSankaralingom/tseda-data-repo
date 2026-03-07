import { ClipboardList } from "lucide-react";
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
  groupedEntries: GroupedEntries<TEntry>;
  renderEntry: GroupedEntryRender<TEntry>;
  draftTitle?: string;
  activatedTitle?: string;
  completedTitle?: string;
  emptyState?: React.ReactNode;
};

function Section<TEntry>({
  title,
  items,
  category,
  renderEntry,
}: {
  title: string;
  items: TEntry[];
  category: EntryDisplayCategory;
  renderEntry: (entry: TEntry, category: EntryDisplayCategory, index: number) => React.ReactNode;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      {items.map((entry, index) => renderEntry(entry, category, index))}
    </div>
  );
}

function DefaultEmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <ClipboardList className="mx-auto size-12 text-slate-300" />
      <p className="mt-3 text-base font-medium text-slate-500">No entries yet</p>
      <p className="mt-1 text-sm text-slate-400">Create your first entry to get started</p>
    </div>
  );
}

export default function GroupedEntrySections<TEntry>({
  groupedEntries,
  renderEntry,
  draftTitle = "Drafts",
  activatedTitle = "Streak Activated",
  completedTitle = "Completed",
  emptyState,
}: GroupedEntrySectionsProps<TEntry>) {
  const hasEntries =
    groupedEntries.draft.length > 0 ||
    groupedEntries.activated.length > 0 ||
    groupedEntries.completed.length > 0;

  if (!hasEntries) {
    return <>{emptyState ?? <DefaultEmptyState />}</>;
  }

  return (
    <div className="space-y-4">
      <Section
        title={draftTitle}
        items={groupedEntries.draft}
        category="draft"
        renderEntry={renderEntry}
      />
      <Section
        title={activatedTitle}
        items={groupedEntries.activated}
        category="streak_active"
        renderEntry={renderEntry}
      />
      <Section
        title={completedTitle}
        items={groupedEntries.completed}
        category="completed"
        renderEntry={renderEntry}
      />
    </div>
  );
}

export function createGroupedEntryListCard<TEntry>({
  title,
  subtitle,
  className = "bg-white/70 p-5",
  groupedEntries,
  renderEntry,
  draftTitle,
  activatedTitle,
  completedTitle,
  emptyState,
}: GroupedEntryListCardConfig<TEntry>) {
  return {
    title,
    subtitle,
    className,
    content: (
      <GroupedEntrySections
        groupedEntries={groupedEntries}
        renderEntry={renderEntry}
        draftTitle={draftTitle}
        activatedTitle={activatedTitle}
        completedTitle={completedTitle}
        emptyState={emptyState}
      />
    ),
  };
}
