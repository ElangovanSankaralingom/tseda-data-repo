"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, Loader2, Lock, Zap } from "lucide-react";
import ConfettiBurst from "@/components/ui/ConfettiBurst";
import EntryPdfActions from "@/components/data-entry/EntryPdfActions";
import RequestActionDropdown from "@/components/entry/RequestActionDropdown";
import { ActionButton } from "@/components/ui/ActionButton";
import { type GenerateButtonState } from "@/lib/types/ui";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  type FinaliseState,
  type HeaderEntryActionsBarProps,
  type PdfEntryActionsBarProps,
} from "./entryComponentTypes";

function formatTimeRemaining(expiresAt: string | null | undefined, tr: (key: string) => string): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return tr("entry.finaliseSoon");
  if (hours < 24) {
    const h = Math.ceil(hours);
    const unit = h === 1 ? tr("time.hour") : tr("time.hours");
    return tr("entry.timeRemainingHours").replace("{count}", String(h)).replace("{unit}", unit);
  }
  const days = Math.ceil(hours / 24);
  const unit = days === 1 ? tr("time.day") : tr("time.days");
  return tr("entry.timeRemainingHours").replace("{count}", String(days)).replace("{unit}", unit);
}

export function HeaderEntryActionsBar({
  isEditing,
  isViewMode,
  loading,
  formHasData = true,
  onAdd,
  addLabel,
  onCancel,
  onSave,
  saving,
  saveIntent,
  workflowAction,
  workflowDisabledHint,
  finalise,
  entryStatus,
  editRequestPending = false,
  deleteRequestPending = false,
  onRequestEdit,
  onRequestDelete,
  permanentlyLocked = false,
  requestActionUsed = false,
}: HeaderEntryActionsBarProps) {
  const { t } = useTranslation();
  const resolvedAddLabel = addLabel || t("entry.addEntry");
  const resolvedHint = workflowDisabledHint || t("entry.fillRequiredToGenerate");
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
            {t('common.back')}
          </ActionButton>
        </div>
      </div>
    );
  }

  if (isEditing && !isViewMode) {
    return (
      <EditModeActionBar
        workflowAction={workflowAction}
        workflowDisabledHint={resolvedHint}
        finalise={finalise}
        onCancel={onCancel}
        onSave={onSave}
        saving={saving}
        saveIntent={saveIntent}
        formHasData={formHasData}
      />
    );
  }

  if (!isEditing && !isViewMode && onAdd) {
    return (
      <ActionButton role="primary" onClick={onAdd} disabled={loading}>
        {resolvedAddLabel}
      </ActionButton>
    );
  }

  return null;
}

function EditModeActionBar({
  workflowAction,
  workflowDisabledHint,
  finalise,
  onCancel,
  onSave,
  saving,
  saveIntent,
  formHasData,
}: {
  workflowAction?: HeaderEntryActionsBarProps["workflowAction"];
  workflowDisabledHint: string;
  finalise?: FinaliseState;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveIntent: "save" | "done" | null;
  formHasData: boolean;
}) {
  const { t } = useTranslation();
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
    ? "bg-[var(--color-status-success-bg)] text-[var(--color-text-primary)]"
    : isGenerating
      ? "cursor-not-allowed bg-[var(--color-generate-bg)] text-[var(--color-text-on-accent)] opacity-75"
      : workflowDisabled
        ? "cursor-not-allowed bg-[var(--color-surface-inset-deep)] text-[var(--color-text-muted)]"
        : "bg-[var(--color-generate-bg)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-generate-hover)]";

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
                ? (workflowAction.busyLabel ?? t('entry.generating'))
                : isSuccess
                  ? t('entry.generated')
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
                    ? "bg-[var(--color-status-success-bg)] text-[var(--color-text-primary)] animate-finalise-pop"
                    : finaliseState === "finalising"
                      ? "bg-[var(--color-generate-bg)] text-[var(--color-text-on-accent)] opacity-75 cursor-not-allowed"
                      : finalise.canFinalise
                        ? "bg-[var(--color-generate-bg)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-generate-hover)]"
                        : "bg-[var(--color-surface-inset-deep)] text-[var(--color-text-muted)] cursor-not-allowed"
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
                  ? t('entry.finalising')
                  : finaliseState === "done"
                    ? t('entry.finalized')
                    : t('entry.finalise')}
              </button>
            </div>
          ) : null}
        </div>
        {showGenerate && workflowAction && workflowDisabled && !isGenerating && !isSuccess ? (
          <p className="text-xs text-[var(--color-text-secondary)]">{workflowDisabledHint}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton role="ghost" onClick={onCancel}>
          {t('entry.cancel')}
        </ActionButton>
        <ActionButton role="context" onClick={onSave} disabled={!formHasData}>
          {saving && saveIntent === "save" ? t('entry.saving') : t('entry.saveDraft')}
        </ActionButton>
      </div>

      {/* Finalise confirmation modal — portaled to body to escape stacking contexts */}
      {showFinaliseConfirm ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[var(--color-modal-overlay)] backdrop-blur-sm"
            onClick={() => setShowFinaliseConfirm(false)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-[var(--color-modal-bg)] shadow-2xl shadow-black/40 border border-[var(--color-glass-border)] backdrop-blur-2xl animate-scale-in">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10">
                  <Lock className="size-5 text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{t('confirm.finaliseTitle')}</h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">{t('entry.finalise')}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                {t('confirm.finaliseMessage')}
              </p>
              {(() => {
                const timeInfo = formatTimeRemaining(finalise?.editWindowExpiresAt, t as (key: string) => string);
                return timeInfo ? (
                  <div className="mt-3 rounded-lg border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] px-3 py-2">
                    <p className="text-xs text-[var(--color-text-secondary)]">{timeInfo}</p>
                  </div>
                ) : null;
              })()}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFinaliseConfirm(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] active:scale-[0.98]"
                >
                  {t('confirm.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFinaliseConfirm(false);
                    void handleFinalise();
                  }}
                  className="rounded-lg bg-[var(--color-generate-bg)] px-4 py-2 text-sm font-medium text-[var(--color-text-on-accent)] transition-all hover:bg-[var(--color-generate-hover)] active:scale-[0.98]"
                >
                  {t('confirm.finaliseConfirm')}
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
  const { t } = useTranslation();
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
          {generating ? t('entry.generating') : t('entry.generate')}
        </ActionButton>
      ) : null}
      <EntryPdfActions pdfMeta={normalizedPdfMeta} disabled={actionsDisabled} />
    </div>
  );
}
