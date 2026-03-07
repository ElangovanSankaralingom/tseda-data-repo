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
      <div className="text-sm font-semibold">{title}</div>
      {items.map((entry, index) => renderEntry(entry, category, index))}
    </div>
  );
}

export default function GroupedEntrySections<TEntry>({
  groupedEntries,
  renderEntry,
  draftTitle = "Drafts",
  activatedTitle = "Streak Activated",
  completedTitle = "Completed",
  emptyState = <div className="text-sm text-muted-foreground">No entries yet.</div>,
}: GroupedEntrySectionsProps<TEntry>) {
  const hasEntries =
    groupedEntries.draft.length > 0 ||
    groupedEntries.activated.length > 0 ||
    groupedEntries.completed.length > 0;

  if (!hasEntries) {
    return <>{emptyState}</>;
  }

  return (
    <div className="space-y-3">
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
