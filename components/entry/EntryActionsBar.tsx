"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, Loader2, Lock, Zap } from "lucide-react";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import RequestActionDropdown from "@/components/entry/RequestActionDropdown";
import { ActionButton } from "@/components/ui/ActionButton";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { SaveButton } from "@/components/ui/SaveButton";
import { type GenerateButtonState } from "@/lib/types/ui";
import {
  type FinaliseState,
  type HeaderEntryActionsBarProps,
  type PdfEntryActionsBarProps,
} from "./entryComponentTypes";

function formatTimeRemaining(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return "Your entry will finalise very soon.";
  if (hours < 24) {
    const h = Math.ceil(hours);
    return `You still have ${h} ${h === 1 ? "hour" : "hours"} left until this entry finalises automatically.`;
  }
  const days = Math.ceil(hours / 24);
  return `You still have ${days} ${days === 1 ? "day" : "days"} left until this entry finalises automatically.`;
}

export function HeaderEntryActionsBar({
  isEditing,
  isViewMode,
  loading,
  formHasData = true,
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
  finalise,
  entryStatus,
  onRequestEdit,
  onCancelRequestEdit,
  onRequestDelete,
  onCancelRequestDelete,
  editTimeLabel,
  onBack,
  permanentlyLocked = false,
}: HeaderEntryActionsBarProps) {
  // View mode: mirror edit-mode layout with disabled save buttons
  if (isEditing && isViewMode) {
    const isEditRequested = entryStatus === "EDIT_REQUESTED";
    const isDeleteRequested = entryStatus === "DELETE_REQUESTED";
    const isEditGranted = entryStatus === "EDIT_GRANTED";
    const hasPendingRequest = isEditRequested || isDeleteRequested;

    return (
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        {/* Left: workflow action area */}
        <div className="flex items-center gap-3">
          {/* Edit granted with time badge */}
          {isEditGranted && editTimeLabel ? (
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700">
              ⏱️ {editTimeLabel}
            </span>
          ) : null}

          {/* Pending request: Cancel Request */}
          {hasPendingRequest && (onCancelRequestEdit || onCancelRequestDelete) ? (
            <ActionButton
              role="context"
              onClick={isEditRequested ? onCancelRequestEdit : onCancelRequestDelete}
            >
              Cancel Request
            </ActionButton>
          ) : null}

          {/* Finalized: Request Action dropdown (hidden when permanently locked) */}
          {!permanentlyLocked && !hasPendingRequest && !isEditGranted && onRequestEdit && onRequestDelete ? (
            <RequestActionDropdown
              onRequestEdit={onRequestEdit}
              onRequestDelete={onRequestDelete}
            />
          ) : null}
        </div>

        {/* Right: Cancel (enabled) + Save buttons (disabled) */}
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton role="ghost" onClick={onCancel}>
            Cancel
          </ActionButton>
          <SaveButton disabled>Save Draft</SaveButton>
          <ActionButton role="primary" disabled>
            Save &amp; Close
          </ActionButton>
        </div>
      </div>
    );
  }

  if (isEditing && !isViewMode) {
    return (
      <EditModeActionBar
        workflowAction={workflowAction}
        workflowDisabledHint={workflowDisabledHint}
        finalise={finalise}
        formHasData={formHasData}
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
  finalise,
  formHasData,
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
  finalise?: FinaliseState;
  formHasData: boolean;
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
  const [finaliseState, setFinaliseState] = useState<"idle" | "finalising" | "done">("idle");
  const [showFinaliseConfirm, setShowFinaliseConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finaliseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [celebrationPhase, setCelebrationPhase] = useState<"hidden" | "entering" | "visible" | "exiting">("hidden");
  const celebrationShownRef = useRef(false);
  const prevCanFinaliseRef = useRef(finalise?.canFinalise ?? false);

  useEffect(() => {
    const canNow = finalise?.canFinalise ?? false;
    const wasBefore = prevCanFinaliseRef.current;
    prevCanFinaliseRef.current = canNow;

    if (canNow && !wasBefore && !celebrationShownRef.current) {
      celebrationShownRef.current = true;
      setCelebrationPhase("entering");
      // Trigger enter animation on next frame
      requestAnimationFrame(() => setCelebrationPhase("visible"));
      const hideTimer = setTimeout(() => {
        setCelebrationPhase("exiting");
        setTimeout(() => setCelebrationPhase("hidden"), 300);
      }, 3000);
      return () => clearTimeout(hideTimer);
    }
  }, [finalise?.canFinalise]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (finaliseTimerRef.current) clearTimeout(finaliseTimerRef.current);
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

  const handleFinalise = useCallback(async () => {
    if (finaliseState !== "idle" || !finalise?.canFinalise) return;
    setFinaliseState("finalising");
    try {
      const result = finalise.onFinalise();
      const success = result instanceof Promise ? await result : true;
      if (success !== false) {
        setFinaliseState("done");
        finaliseTimerRef.current = setTimeout(() => {
          finalise.onAfterFinalise?.();
        }, 1500);
      } else {
        setFinaliseState("idle");
      }
    } catch {
      setFinaliseState("idle");
    }
  }, [finalise, finaliseState]);

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
    <div className="flex w-full flex-col gap-2">
      {celebrationPhase !== "hidden" ? (
        <div
          className={`rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 transition-all duration-300 ${
            celebrationPhase === "entering"
              ? "translate-y-2 opacity-0"
              : celebrationPhase === "exiting"
                ? "opacity-0"
                : "translate-y-0 opacity-100"
          }`}
        >
          <span className="text-sm font-medium text-emerald-700">
            🎉 All fields complete — ready to finalise!
          </span>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-3">
          {workflowAction ? (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={buttonDisabled}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium shadow-sm transition-all duration-300 active:scale-[0.97] ${buttonClass}`}
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
          ) : null}
          {finalise ? (
            <button
              type="button"
              onClick={finaliseState === "idle" && finalise.canFinalise ? () => setShowFinaliseConfirm(true) : undefined}
              disabled={!finalise.canFinalise || finaliseState !== "idle"}
              className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium shadow-sm transition-all duration-300 active:scale-[0.97] ${
                finaliseState === "done"
                  ? "bg-slate-200 text-slate-500 opacity-75 cursor-not-allowed"
                  : finaliseState === "finalising"
                    ? "bg-emerald-600 text-white opacity-50 cursor-not-allowed"
                    : finalise.canFinalise
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : "bg-emerald-600 text-white opacity-50 cursor-not-allowed"
              }`}
              title={finaliseState === "done" ? "Entry finalised" : finalise.canFinalise ? "Lock this entry" : finalise.disabledReason}
            >
              {finaliseState === "finalising" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : finaliseState === "done" ? (
                <CheckCircle className="size-4" />
              ) : (
                <Lock className="size-4" />
              )}
              {finaliseState === "finalising"
                ? "Finalising..."
                : finaliseState === "done"
                  ? "Finalised"
                  : "Finalise Now"}
            </button>
          ) : null}
        </div>
        {finalise && !finalise.canFinalise && finalise.disabledReason ? (
          <p className="text-xs text-amber-600 mt-1">{finalise.disabledReason}</p>
        ) : null}
        {workflowAction && workflowDisabled && !isGenerating && !isSuccess ? (
          <p className="text-xs text-slate-500">{workflowDisabledHint}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton role="ghost" onClick={onCancel} disabled={cancelDisabled}>
          Cancel
        </ActionButton>
        <SaveButton onClick={onSave} disabled={saveDisabled || !formHasData}>
          {saving && saveIntent === "save" ? "Saving..." : "Save Draft"}
        </SaveButton>
        <ActionButton role="primary" onClick={onDone} disabled={doneDisabled || !formHasData}>
          {saving && saveIntent === "done" ? "Saving..." : "Save & Close"}
        </ActionButton>
      </div>
      </div>

      {/* Finalise confirmation dialog */}
      <ConfirmDialog
        open={showFinaliseConfirm}
        title="Finalise this entry?"
        description={
          <>
            <p>Once finalised, all fields become read-only. You&apos;ll need admin approval to make any further changes.</p>
            {(() => {
              const timeInfo = formatTimeRemaining(finalise?.editWindowExpiresAt);
              return timeInfo ? (
                <p className="mt-2 text-xs text-amber-700">{timeInfo}</p>
              ) : null;
            })()}
          </>
        }
        confirmLabel="Yes, Finalise Now"
        confirmClassName="border-emerald-600 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
        onConfirm={() => {
          setShowFinaliseConfirm(false);
          void handleFinalise();
        }}
        onCancel={() => setShowFinaliseConfirm(false)}
      />
    </div>
  );
}

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
