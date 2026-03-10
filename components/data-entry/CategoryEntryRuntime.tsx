"use client";

import CategoryEntryPageShell from "@/components/data-entry/CategoryEntryPageShell";
import Toast from "@/components/ui/Toast";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
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
  onRequestEdit?: () => void;
  onCancelRequestEdit?: () => void;
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
  onRequestEdit,
  onCancelRequestEdit,
}: CategoryEntryRuntimeProps) {
  return (
    <ErrorBoundary section="Entry editor">
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
      onAddEntry={headerActions.onAdd}
      addEntryLabel={headerActions.addLabel}
      onRequestEdit={onRequestEdit}
      onCancelRequestEdit={onCancelRequestEdit}
    />
    </ErrorBoundary>
  );
}
