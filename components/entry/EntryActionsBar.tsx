"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, Lock, Zap } from "lucide-react";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import { ActionButton } from "@/components/ui/ActionButton";
import { SaveButton } from "@/components/ui/SaveButton";

type GenerateButtonState = "idle" | "generating" | "success";

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
    onClick: () => void | Promise<boolean>;
    disabled?: boolean;
    busyLabel?: string;
  };
  workflowDisabledHint?: string;
  entryStatus?: string | null;
  onRequestEdit?: () => void;
  onCancelRequestEdit?: () => void;
  onFinalise?: () => void;
  editTimeLabel?: string;
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
  workflowDisabledHint = "Fill all required fields to generate",
  entryStatus,
  onRequestEdit,
  onCancelRequestEdit,
  onFinalise,
  editTimeLabel,
}: HeaderEntryActionsBarProps) {
  // View mode: show Request Edit or Cancel Request
  if (isEditing && isViewMode) {
    const isEditRequested = entryStatus === "EDIT_REQUESTED";
    const isEditGranted = entryStatus === "EDIT_GRANTED";

    return (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        {/* Edit granted with time badge */}
        {isEditGranted && editTimeLabel ? (
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
            ⏱️ {editTimeLabel}
          </span>
        ) : null}

        {/* Edit requested: Cancel Request */}
        {isEditRequested && onCancelRequestEdit ? (
          <ActionButton role="context" onClick={onCancelRequestEdit}>
            Cancel Request
          </ActionButton>
        ) : null}

        {/* Editable & complete: Finalise Now */}
        {onFinalise ? (
          <button
            type="button"
            onClick={onFinalise}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
          >
            <Lock className="size-3.5" />
            Finalise Now
          </button>
        ) : null}

        {/* Finalized (GENERATED): Request Edit */}
        {!isEditRequested && !isEditGranted && onRequestEdit ? (
          <button
            type="button"
            onClick={onRequestEdit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-150 hover:bg-purple-700 active:scale-[0.97]"
          >
            Request Edit
          </button>
        ) : null}
      </div>
    );
  }

  if (isEditing && !isViewMode) {
    return (
      <EditModeActionBar
        workflowAction={workflowAction}
        workflowDisabledHint={workflowDisabledHint}
        saving={saving}
        saveIntent={saveIntent}
        onCancel={onCancel}
        cancelDisabled={cancelDisabled}
        onSave={onSave}
        saveDisabled={saveDisabled}
        onDone={onDone}
        doneDisabled={doneDisabled}
      />
    );
  }

  if (!isEditing && !isViewMode && onAdd) {
    return (
      <ActionButton role="primary" onClick={onAdd} disabled={loading}>
        {addLabel}
      </ActionButton>
    );
  }

  return null;
}

function EditModeActionBar({
  workflowAction,
  workflowDisabledHint,
  saving,
  saveIntent,
  onCancel,
  cancelDisabled,
  onSave,
  saveDisabled,
  onDone,
  doneDisabled,
}: {
  workflowAction?: HeaderEntryActionsBarProps["workflowAction"];
  workflowDisabledHint: string;
  saving: boolean;
  saveIntent: "save" | "done" | null;
  onCancel: () => void;
  cancelDisabled: boolean;
  onSave: () => void;
  saveDisabled: boolean;
  onDone: () => void;
  doneDisabled: boolean;
}) {
  const [genState, setGenState] = useState<GenerateButtonState>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (genState !== "idle" || !workflowAction) return;
    setGenState("generating");
    try {
      const result = workflowAction.onClick();
      const success = result instanceof Promise ? await result : false;
      if (success) {
        setGenState("success");
        timerRef.current = setTimeout(() => setGenState("idle"), 2000);
      } else {
        setGenState("idle");
      }
    } catch {
      setGenState("idle");
    }
  }, [genState, workflowAction]);

  const workflowDisabled = workflowAction?.disabled ?? false;
  const isGenerating = genState === "generating";
  const isSuccess = genState === "success";
  const buttonDisabled = workflowDisabled || isGenerating || isSuccess;

  const buttonClass = isSuccess
    ? "bg-emerald-500 text-white"
    : workflowDisabled || isGenerating
      ? "cursor-not-allowed bg-slate-900 text-white opacity-50"
      : "bg-slate-900 text-white hover:bg-slate-800";

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {workflowAction ? (
          <div className="flex flex-col items-start gap-1">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={buttonDisabled}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition-all duration-300 active:scale-[0.97] ${buttonClass}`}
            >
              {isGenerating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isSuccess ? (
                <CheckCircle className="size-4" />
              ) : (
                <Zap className="size-4" />
              )}
              {isGenerating
                ? (workflowAction.busyLabel ?? "Generating...")
                : isSuccess
                  ? "Generated Successfully"
                  : workflowAction.label}
            </button>
            {workflowDisabled && !isGenerating && !isSuccess ? (
              <p className="text-xs text-slate-500">{workflowDisabledHint}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton role="ghost" onClick={onCancel} disabled={cancelDisabled}>
          Cancel
        </ActionButton>
        <SaveButton onClick={onSave} disabled={saveDisabled}>
          {saving && saveIntent === "save" ? "Saving..." : "Save Draft"}
        </SaveButton>
        <ActionButton role="primary" onClick={onDone} disabled={doneDisabled}>
          {saving && saveIntent === "done" ? "Saving..." : "Save & Close"}
        </ActionButton>
      </div>
    </div>
  );
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
        <ActionButton role="primary" onClick={onGenerate} disabled={!canGenerate || generating}>
          {generating ? "Generating..." : "Generate Entry"}
        </ActionButton>
      ) : null}
      <EntryPdfActions pdfMeta={normalizedPdfMeta} disabled={actionsDisabled} />
    </div>
  );
}
