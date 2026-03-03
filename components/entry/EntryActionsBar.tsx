"use client";

import EntryPdfActions from "@/components/data-entry/EntryPdfActions";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ActionButton({
  children,
  onClick,
  variant = "default",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "ghost";
  disabled?: boolean;
}) {
  const base = "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm";
  const activeCls =
    variant === "ghost"
      ? "border-border transition hover:bg-muted"
      : "border-foreground bg-foreground text-background transition hover:opacity-90";
  const disabledCls =
    variant === "default"
      ? "pointer-events-none cursor-not-allowed border-border bg-muted text-muted-foreground opacity-60"
      : "pointer-events-none cursor-not-allowed border-border bg-transparent text-muted-foreground opacity-60";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(base, disabled ? disabledCls : activeCls)}
    >
      {children}
    </button>
  );
}

type HeaderEntryActionsBarProps = {
  isEditing: boolean;
  isViewMode: boolean;
  loading: boolean;
  onAdd?: () => void;
  addLabel?: string;
  onCancel: () => void;
  cancelDisabled: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  onDone: () => void;
  doneDisabled: boolean;
  saving: boolean;
  saveIntent: "save" | "done" | null;
};

export function HeaderEntryActionsBar({
  isEditing,
  isViewMode,
  loading,
  onAdd,
  addLabel = "+ Add Entry",
  onCancel,
  cancelDisabled,
  onSave,
  saveDisabled,
  onDone,
  doneDisabled,
  saving,
  saveIntent,
}: HeaderEntryActionsBarProps) {
  if (isEditing && !isViewMode) {
    return (
      <>
        <ActionButton variant="ghost" onClick={onCancel} disabled={cancelDisabled}>
          Cancel
        </ActionButton>
        <ActionButton variant="ghost" onClick={onSave} disabled={saveDisabled}>
          {saving && saveIntent === "save" ? "Saving..." : "Save"}
        </ActionButton>
        <ActionButton onClick={onDone} disabled={doneDisabled}>
          {saving && saveIntent === "done" ? "Saving..." : "Done"}
        </ActionButton>
      </>
    );
  }

  if (!isEditing && !isViewMode && onAdd) {
    return (
      <ActionButton onClick={onAdd} disabled={loading}>
        {addLabel}
      </ActionButton>
    );
  }

  return null;
}

type PdfEntryActionsBarProps = {
  isViewMode: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  generating: boolean;
  pdfMeta: { url?: string | null; fileName?: string } | null | undefined;
  pdfDisabled: boolean;
};

export function PdfEntryActionsBar({
  isViewMode,
  canGenerate,
  onGenerate,
  generating,
  pdfMeta,
  pdfDisabled,
}: PdfEntryActionsBarProps) {
  const normalizedPdfMeta =
    pdfMeta?.url
      ? {
          url: pdfMeta.url,
          fileName: pdfMeta.fileName,
        }
      : null;

  return (
    <div className="flex flex-wrap gap-2">
      {!isViewMode ? (
        <ActionButton onClick={onGenerate} disabled={!canGenerate || generating}>
          {generating ? "Generating..." : "Generate Entry"}
        </ActionButton>
      ) : null}
      <EntryPdfActions pdfMeta={normalizedPdfMeta} disabled={pdfDisabled} />
    </div>
  );
}
