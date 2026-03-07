"use client";

import CategoryEntryPageShell from "@/components/data-entry/CategoryEntryPageShell";
import Toast from "@/components/ui/Toast";
import { EntryHeaderActionsBar } from "@/components/entry/EntryHeaderActions";
import type { UiToast } from "@/lib/ui/notify";

type CategoryEntryRuntimeProps = {
  entryShell: Omit<React.ComponentProps<typeof CategoryEntryPageShell>["entryShell"], "actions">;
  headerActions: React.ComponentProps<typeof EntryHeaderActionsBar>;
  loading: boolean;
  loadingMessage?: React.ReactNode;
  showForm: boolean;
  toast?: UiToast | null;
  formCard?: React.ComponentProps<typeof CategoryEntryPageShell>["formCard"];
  listCard?: React.ComponentProps<typeof CategoryEntryPageShell>["listCard"];
  confirmationDialog?: React.ReactNode;
};

export default function CategoryEntryRuntime({
  entryShell,
  headerActions,
  loading,
  loadingMessage,
  showForm,
  toast,
  formCard,
  listCard,
  confirmationDialog,
}: CategoryEntryRuntimeProps) {
  return (
    <CategoryEntryPageShell
      entryShell={{
        ...entryShell,
        actions: <EntryHeaderActionsBar {...headerActions} />,
      }}
      loading={loading}
      loadingMessage={loadingMessage}
      showForm={showForm}
      topContent={<Toast toast={toast} />}
      formCard={formCard}
      listCard={listCard}
      confirmationDialog={confirmationDialog}
    />
  );
}
