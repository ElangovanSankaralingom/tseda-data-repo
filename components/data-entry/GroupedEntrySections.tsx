import type { EntryDisplayCategory } from "@/lib/entries/displayLifecycle";

type GroupedEntries<TEntry> = {
  draft: TEntry[];
  activated: TEntry[];
  completed: TEntry[];
};

type GroupedEntrySectionsProps<TEntry> = {
  groupedEntries: GroupedEntries<TEntry>;
  renderEntry: (entry: TEntry, category: EntryDisplayCategory, index: number) => React.ReactNode;
  draftTitle?: string;
  activatedTitle?: string;
  completedTitle?: string;
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
}: GroupedEntrySectionsProps<TEntry>) {
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
