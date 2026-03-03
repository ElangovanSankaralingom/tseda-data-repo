"use client";

import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import { ActionButton } from "@/components/ui/ActionButton";

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
