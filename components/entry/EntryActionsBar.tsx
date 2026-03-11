"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Loader2, Lock, Zap } from "lucide-react";
import ConfettiBurst from "@/components/ui/ConfettiBurst";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import RequestActionDropdown from "@/components/entry/RequestActionDropdown";
import { ActionButton } from "@/components/ui/ActionButton";
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
  editRequestPending = false,
  deleteRequestPending = false,
  onRequestEdit,
  onRequestDelete,
  permanentlyLocked = false,
  requestActionUsed = false,
}: HeaderEntryActionsBarProps) {
  // View mode: simplified layout
  if (isEditing && isViewMode) {
    const isEditRequested = entryStatus === "EDIT_REQUESTED" || editRequestPending;
    const isDeleteRequested = entryStatus === "DELETE_REQUESTED" || deleteRequestPending;
    const hasPendingRequest = isEditRequested || isDeleteRequested;

    return (
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        {/* Left: Request Action dropdown (only when no pending request) */}
        <div className="flex items-center gap-3">
          {!permanentlyLocked && !requestActionUsed && !hasPendingRequest && entryStatus !== "EDIT_GRANTED" && onRequestEdit && onRequestDelete ? (
            <RequestActionDropdown
              onRequestEdit={onRequestEdit}
              onRequestDelete={onRequestDelete}
              requesting={editRequestPending || deleteRequestPending}
            />
          ) : null}
        </div>

        {/* Right: Back button */}
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton role="ghost" onClick={onCancel}>
            Back
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
      ? "cursor-not-allowed bg-emerald-600 text-white opacity-50"
      : "bg-emerald-600 text-white hover:bg-emerald-700";

  // Show only ONE primary workflow button at a time:
  // - If workflowAction exists (Generate/Regenerate): show that
  // - Else if finalise exists and canFinalise: show Finalise
  // - Else if finalise exists but can't finalise: show disabled Finalise
  const showGenerate = !!workflowAction;
  const showFinalise = !showGenerate && !!finalise;

  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-3">
          {showGenerate && workflowAction ? (
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
          {showFinalise && finalise ? (
            <div className="relative">
              <ConfettiBurst active={finaliseState === "done"} />
              <button
                type="button"
                onClick={finaliseState === "idle" && finalise.canFinalise ? () => setShowFinaliseConfirm(true) : undefined}
                disabled={!finalise.canFinalise || finaliseState !== "idle"}
                className={`inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-medium shadow-sm transition-all duration-300 active:scale-[0.97] ${
                  finaliseState === "done"
                    ? "bg-emerald-500 text-white animate-finalise-pop"
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
                    ? "Finalised!"
                    : "Finalise Now"}
              </button>
            </div>
          ) : null}
        </div>
        {showGenerate && workflowAction && workflowDisabled && !isGenerating && !isSuccess ? (
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

      {/* Finalise confirmation modal — portaled to body to escape stacking contexts */}
      {showFinaliseConfirm ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowFinaliseConfirm(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 animate-scale-in">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50">
                  <Lock className="size-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Finalise this entry?</h3>
                  <p className="text-xs text-slate-500">This action locks the entry</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                Once finalised, all fields become read-only. You&apos;ll need admin approval to make any future changes.
              </p>
              {(() => {
                const timeInfo = formatTimeRemaining(finalise?.editWindowExpiresAt);
                return timeInfo ? (
                  <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">{timeInfo}</p>
                  </div>
                ) : null;
              })()}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinaliseConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.98]"
                >
                  Keep Editing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFinaliseConfirm(false);
                    void handleFinalise();
                  }}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 active:scale-[0.98]"
                >
                  Finalise Entry
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
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
