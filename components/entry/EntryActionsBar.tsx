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
  workflowAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    busyLabel?: string;
  };
  workflowDisabledHint?: string;
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
  workflowAction,
  workflowDisabledHint = "Complete required fields before submitting.",
}: HeaderEntryActionsBarProps) {
  if (isEditing && !isViewMode) {
    const workflowDisabled = workflowAction?.disabled ?? false;
    return (
      <div className="flex w-full flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton role="context" onClick={onCancel} disabled={cancelDisabled}>
            Cancel
          </ActionButton>
          <SaveButton onClick={onSave} disabled={saveDisabled}>
            {saving && saveIntent === "save" ? "Saving..." : "Save Draft"}
          </SaveButton>
          <ActionButton role="context" onClick={onDone} disabled={doneDisabled}>
            {saving && saveIntent === "done" ? "Saving..." : "Save & Close"}
          </ActionButton>
        </div>

        <div className="flex min-w-[220px] flex-col items-start gap-1 sm:items-end">
          {workflowAction ? (
            <>
              <ActionButton
                role="context"
                onClick={workflowAction.onClick}
                disabled={workflowDisabled}
              >
                {saving ? workflowAction.busyLabel ?? workflowAction.label : workflowAction.label}
              </ActionButton>
              {workflowDisabled ? (
                <p className="text-xs text-muted-foreground">{workflowDisabledHint}</p>
              ) : null}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Send for Confirmation is available as a separate workflow action.
            </p>
          )}
        </div>
      </div>
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
