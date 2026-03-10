"use client";

/**
 * Main orchestration hook for category entry pages.
 *
 * Composes focused sub-hooks:
 *   controllerTypes.ts              — shared types and helpers
 *   useEntrySaveOrchestration.ts    — save, persist, auto-save, unsaved-changes
 *   useEntryGenerateAndFinalise.ts  — generate PDF and finalise
 *   useEntryRequestActions.ts       — request edit/delete and confirmation
 *
 * IMPORTANT: Button state (isEditable, isFinalized) comes from the SERVER
 * response (via entryToApiResponse). Do NOT recompute on the client.
 * The server is the single source of truth for these values.
 * Client-side pdfState computation is the exception — it provides
 * real-time feedback as the user edits without waiting for a server round-trip.
 */
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  hasBusyValue,
  type CategoryPageEntry,
  type HeaderActionBindings,
  type PdfActionBindings,
  type ToastState,
  type UseCategoryEntryPageControllerOptions,
} from "@/hooks/controllerTypes";
import { useEntrySaveOrchestration } from "@/hooks/useEntrySaveOrchestration";
import { useEntryGenerateAndFinalise } from "@/hooks/useEntryGenerateAndFinalise";
import { useEntryRequestActions } from "@/hooks/useEntryRequestActions";
import { deriveEntryActionState, useEntryWorkflow } from "@/hooks/useEntryWorkflow";
import { groupEntries, groupEntriesForList } from "@/lib/entryCategorization";
import type { EntrySaveIntent } from "@/lib/entries/pageOrchestration";

export { type CategoryPageEntry, type UseCategoryEntryPageControllerOptions } from "@/hooks/controllerTypes";

export function useCategoryEntryPageController<TEntry extends CategoryPageEntry>({
  category,
  list,
  setList,
  form,
  formRef,
  showForm,
  isViewMode,
  entryLocked,
  controlsDisabled,
  loading,
  busyUploadSources,
  coreValid,
  hasPdfSnapshot,
  pdfStale,
  completionValid,
  fieldDirty,
  autoSaveSynced,
  defaultCancelTargetHref,
  closeForm,
  buildEntryToSave,
  buildOptimisticEntry,
  persistProgress,
  persistRequestEdit,
  persistCancelRequestEdit,
  persistRequestDelete,
  persistCancelRequestDelete,
  commitDraft,
  normalizePersistedEntry,
  applyPersistedEntry,
  afterPersistSuccess,
  setSubmitAttemptedFinal,
  saveBusyMessage = "Please wait for uploads to finish before saving.",
  saveSuccessMessage = "Saved",
  doneSuccessMessage = "Draft committed.",
  saveErrorMessage = "Save failed.",
  cancelBusyMessage = "Please wait for upload to finish.",
  saveAndCloseBusyMessage = "Please wait for upload to finish.",
  autoSaveDebounceMs = 15000,
  hasValidationErrors,
  markGenerateAttempted,
  beforeGenerate,
  afterGenerate,
  buildDraftEntry,
  generateEntrySnapshot,
  applyGeneratedEntry,
  generateValidationMessage = "Complete all required fields before generating the entry.",
  generateBusyMessage = "Finish the current uploads before generating the entry.",
  generateSuccessMessage = "Entry generated.",
  generateErrorMessage = "Generate failed.",
}: UseCategoryEntryPageControllerOptions<TEntry>) {
  // ── Shared state ────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState<EntrySaveIntent | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const saveLockRef = useRef(false);

  const hasBusyUploads = useMemo(
    () => busyUploadSources.some((source) => hasBusyValue(source)),
    [busyUploadSources],
  );

  // ── Workflow ────────────────────────────────────────────────────────────
  const workflow = useEntryWorkflow({
    isLocked: entryLocked,
    coreValid,
    hasPdfSnapshot,
    pdfStale,
    completionValid,
    fieldDirty,
  });
  const lifecycle = workflow.lifecycle;

  const actionState = deriveEntryActionState({
    showForm,
    isViewMode,
    entryLocked,
    controlsDisabled,
    loading,
    saving,
    hasBusyUploads,
    canSave: lifecycle.canSave,
    canGenerate: lifecycle.canGenerate,
  });

  // ── Grouped entries ─────────────────────────────────────────────────────
  const groupedEntries = useMemo(() => groupEntries(list), [list]);
  const smartGroupedEntries = useMemo(() => groupEntriesForList(list), [list]);

  // ── Normalize persist wrapper ───────────────────────────────────────────
  const normalizePersisted = useCallback(
    (entry: TEntry) => (normalizePersistedEntry ? normalizePersistedEntry(entry) : entry),
    [normalizePersistedEntry],
  );

  const persistRequestEditEntry = useCallback(
    async (entry: TEntry) => normalizePersisted(await persistRequestEdit(entry)),
    [normalizePersisted, persistRequestEdit],
  );
  const persistCancelRequestEditEntry = useCallback(
    async (entry: TEntry) => normalizePersisted(await persistCancelRequestEdit(entry)),
    [normalizePersisted, persistCancelRequestEdit],
  );
  const persistRequestDeleteEntry = useCallback(
    async (entry: TEntry) => {
      if (!persistRequestDelete) throw new Error("persistRequestDelete not configured");
      return normalizePersisted(await persistRequestDelete(entry));
    },
    [normalizePersisted, persistRequestDelete],
  );
  const persistCancelRequestDeleteEntry = useCallback(
    async (entry: TEntry) => {
      if (!persistCancelRequestDelete) throw new Error("persistCancelRequestDelete not configured");
      return normalizePersisted(await persistCancelRequestDelete(entry));
    },
    [normalizePersisted, persistCancelRequestDelete],
  );

  // ── Save orchestration ──────────────────────────────────────────────────
  const saveOrch = useEntrySaveOrchestration<TEntry>({
    saving,
    setSaving,
    setSaveIntent,
    setToast,
    saveLockRef,
    hasBusyUploads,
    form,
    formRef,
    setList,
    showForm,
    isViewMode,
    entryLocked,
    fieldDirty,
    autoSaveSynced,
    canSave: lifecycle.canSave,
    autoSaveEnabled: actionState.autoSaveEnabled,
    guardSaving: actionState.guardSaving,
    persistProgress,
    normalizePersistedEntry,
    commitDraft,
    applyPersistedEntry,
    afterPersistSuccess,
    buildEntryToSave,
    buildOptimisticEntry,
    closeForm,
    defaultCancelTargetHref,
    setSubmitAttemptedFinal,
    saveBusyMessage,
    saveSuccessMessage,
    doneSuccessMessage,
    saveErrorMessage,
    cancelBusyMessage,
    saveAndCloseBusyMessage,
    autoSaveDebounceMs,
  });

  // ── Generate & finalise ─────────────────────────────────────────────────
  const genFin = useEntryGenerateAndFinalise<TEntry>({
    category,
    saveLockRef,
    setSaving,
    setToast,
    setList,
    showToast: saveOrch.showToast,
    hasBusyUploads,
    hasValidationErrors,
    canGenerate: lifecycle.canGenerate,
    persistEntry: saveOrch.persistEntry,
    markGenerateAttempted,
    beforeGenerate,
    afterGenerate,
    buildDraftEntry,
    generateEntrySnapshot,
    applyGeneratedEntry,
    generateValidationMessage,
    generateBusyMessage,
    generateSuccessMessage,
    generateErrorMessage,
  });

  // ── Request actions ─────────────────────────────────────────────────────
  const requests = useEntryRequestActions<TEntry>({
    category,
    setList,
    showToast: saveOrch.showToast,
    persistRequestEdit: persistRequestEditEntry,
    persistCancelRequestEdit: persistCancelRequestEditEntry,
    persistRequestDelete: persistRequestDeleteEntry,
    persistCancelRequestDelete: persistCancelRequestDeleteEntry,
  });

  // ── Header & PDF action bindings ────────────────────────────────────────
  const getHeaderActionProps = useCallback(
    (options?: {
      onAdd?: () => void;
      addLabel?: string;
      formHasData?: boolean;
      workflowAction?: HeaderActionBindings["workflowAction"];
      workflowDisabledHint?: string;
      finalise?: HeaderActionBindings["finalise"];
      entryStatus?: string | null;
      editRequestPending?: boolean;
      deleteRequestPending?: boolean;
      onRequestEdit?: () => void;
      onCancelRequestEdit?: () => void;
      onRequestDelete?: () => void;
      onCancelRequestDelete?: () => void;
      editTimeLabel?: string;
      onBack?: () => void;
      permanentlyLocked?: boolean;
    }): HeaderActionBindings => ({
      isEditing: showForm,
      isViewMode,
      loading,
      formHasData: options?.formHasData,
      onAdd: options?.onAdd,
      addLabel: options?.addLabel,
      onCancel: () => void saveOrch.handleCancel(),
      cancelDisabled: actionState.cancelDisabled,
      onSave: () => void saveOrch.handleSaveDraft(),
      saveDisabled: actionState.saveDisabled,
      onDone: () => void saveOrch.handleSaveAndClose(),
      doneDisabled: actionState.doneDisabled,
      saving,
      saveIntent,
      workflowAction: options?.workflowAction,
      workflowDisabledHint: options?.workflowDisabledHint,
      finalise: options?.finalise,
      entryStatus: options?.entryStatus,
      editRequestPending: options?.editRequestPending,
      deleteRequestPending: options?.deleteRequestPending,
      onRequestEdit: options?.onRequestEdit,
      onCancelRequestEdit: options?.onCancelRequestEdit,
      onRequestDelete: options?.onRequestDelete,
      onCancelRequestDelete: options?.onCancelRequestDelete,
      editTimeLabel: options?.editTimeLabel,
      onBack: options?.onBack,
      permanentlyLocked: options?.permanentlyLocked,
    }),
    [
      actionState,
      saveOrch,
      isViewMode,
      loading,
      saveIntent,
      saving,
      showForm,
    ],
  );

  const getPdfActionProps = useCallback(
    (pdfMeta: PdfActionBindings["pdfMeta"]): PdfActionBindings => ({
      isViewMode,
      canGenerate: !actionState.generateDisabled,
      onGenerate: () => void genFin.generateEntry(),
      generating: saving,
      pdfMeta,
      pdfStale: workflow.coreDirty && workflow.hasPdfSnapshot,
      canPreview: lifecycle.canPreview,
      canDownload: lifecycle.canDownload,
      pdfDisabled: !lifecycle.canPreview,
    }),
    [actionState, genFin, isViewMode, lifecycle, saving, workflow],
  );

  // ── Return ──────────────────────────────────────────────────────────────
  return {
    actionState,
    autoSaveStatus: saveOrch.autoSaveStatus,
    cancelRequestDelete: requests.cancelRequestDelete,
    cancelRequestEdit: requests.cancelRequestEdit,
    finaliseEntry: genFin.finaliseEntry,
    finalisingIds: genFin.finalisingIds,
    generateEntry: genFin.generateEntry,
    getHeaderActionProps,
    getPdfActionProps,
    groupedEntries,
    smartGroupedEntries,
    handleCancel: saveOrch.handleCancel,
    handleSaveAndClose: saveOrch.handleSaveAndClose,
    handleSaveDraft: saveOrch.handleSaveDraft,
    hasBusyUploads,
    hasUnsavedChanges: saveOrch.hasUnsavedChanges,
    lifecycle,
    markAutoSaveSaved: saveOrch.markAutoSaveSaved,
    persistCurrentMutation: saveOrch.persistCurrentMutation,
    requestDelete: requests.requestDelete,
    requestEdit: requests.requestEdit,
    requestingDeleteIds: requests.requestingDeleteIds,
    requestingEditIds: requests.requestingEditIds,
    runWithSaveGuard: saveOrch.runWithSaveGuard,
    saveDraftChanges: saveOrch.saveDraftChanges,
    saveIntent,
    saving,
    sendForConfirmation: requests.sendForConfirmation,
    sendingConfirmationIds: requests.sendingConfirmationIds,
    setToast,
    showToast: saveOrch.showToast,
    toast,
    workflow,
    saveLockRef,
    formRef,
  };
}
