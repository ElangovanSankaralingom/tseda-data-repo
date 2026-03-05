"use client";

import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import { ActionButton } from "@/components/ui/ActionButton";
import { SaveButton } from "@/components/ui/SaveButton";

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
        <ActionButton role="context" onClick={onCancel} disabled={cancelDisabled}>
          Cancel
        </ActionButton>
        <SaveButton onClick={onSave} disabled={saveDisabled}>
          {saving && saveIntent === "save" ? "Saving..." : "Save"}
        </SaveButton>
        <ActionButton role="context" onClick={onDone} disabled={doneDisabled}>
          {saving && saveIntent === "done" ? "Saving..." : "Done"}
        </ActionButton>
      </>
    );
  }

  if (!isEditing && !isViewMode && onAdd) {
    return (
      <ActionButton role="context" onClick={onAdd} disabled={loading}>
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
  const actionsDisabled = isViewMode ? !normalizedPdfMeta : pdfDisabled;

  return (
    <div className="flex flex-wrap gap-2">
      {!isViewMode ? (
        <ActionButton role="context" onClick={onGenerate} disabled={!canGenerate || generating}>
          {generating ? "Generating..." : "Generate Entry"}
        </ActionButton>
      ) : null}
      <EntryPdfActions pdfMeta={normalizedPdfMeta} disabled={actionsDisabled} />
    </div>
  );
}
