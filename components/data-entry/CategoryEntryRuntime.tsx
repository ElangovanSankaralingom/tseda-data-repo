"use client";

import CategoryEntryPageShell from "@/components/data-entry/CategoryEntryPageShell";
import { EntryHeaderActionsBar } from "@/components/entry/EntryHeaderActions";

type RuntimeToast =
  | {
      type: "ok" | "err";
      msg: string;
    }
  | null
  | undefined;

type CategoryEntryRuntimeProps = {
  entryShell: Omit<React.ComponentProps<typeof CategoryEntryPageShell>["entryShell"], "actions">;
  headerActions: React.ComponentProps<typeof EntryHeaderActionsBar>;
  loading: boolean;
  loadingMessage?: React.ReactNode;
  showForm: boolean;
  toast?: RuntimeToast;
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
  const toastBanner = toast ? (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        toast.type === "ok"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {toast.msg}
    </div>
  ) : null;

  return (
    <CategoryEntryPageShell
      entryShell={{
        ...entryShell,
        actions: <EntryHeaderActionsBar {...headerActions} />,
      }}
      loading={loading}
      loadingMessage={loadingMessage}
      showForm={showForm}
      topContent={toastBanner}
      formCard={formCard}
      listCard={listCard}
      confirmationDialog={confirmationDialog}
    />
  );
}
