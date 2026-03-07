"use client";

import EntryShell from "@/components/entry/EntryShell";
import SectionCard from "@/components/layout/SectionCard";

type CardContent = {
  title: string;
  subtitle?: string;
  className?: string;
  content: React.ReactNode;
};

type CategoryEntryPageShellProps = {
  entryShell: Omit<React.ComponentProps<typeof EntryShell>, "children">;
  loading: boolean;
  loadingMessage?: React.ReactNode;
  showForm: boolean;
  topContent?: React.ReactNode;
  formCard?: CardContent | null;
  listCard?: CardContent | null;
  confirmationDialog?: React.ReactNode;
};

export default function CategoryEntryPageShell({
  entryShell,
  loading,
  loadingMessage = "Loading...",
  showForm,
  topContent,
  formCard,
  listCard,
  confirmationDialog,
}: CategoryEntryPageShellProps) {
  return (
    <EntryShell {...entryShell}>
      <div className="space-y-6">
        {topContent}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-muted-foreground shadow-sm">
            {loadingMessage}
          </div>
        ) : null}

        {!loading && showForm && formCard ? (
          <SectionCard className={formCard.className} title={formCard.title} subtitle={formCard.subtitle}>
            {formCard.content}
          </SectionCard>
        ) : null}

        {!loading && !showForm && listCard ? (
          <SectionCard className={listCard.className} title={listCard.title} subtitle={listCard.subtitle}>
            {listCard.content}
          </SectionCard>
        ) : null}
      </div>
      {confirmationDialog}
    </EntryShell>
  );
}
