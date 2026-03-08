"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useEntryConfirmation } from "@/hooks/useEntryConfirmation";
import { useEntryPrimaryActions } from "@/hooks/useEntryPrimaryActions";
import { useRequestEdit } from "@/hooks/useRequestEdit";
import { deriveEntryActionState, useEntryWorkflow } from "@/hooks/useEntryWorkflow";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  runGenerateEntryOrchestration,
  runPersistCurrentEntryMutation,
  runSaveDraftOrchestration,
  type EntrySaveIntent,
  type EntrySaveSource,
} from "@/lib/entries/pageOrchestration";
import type { CategoryKey, RequestEditableEntry } from "@/lib/entries/types";
import { groupEntries, groupEntriesForList, type CategorizableEntry } from "@/lib/entryCategorization";
import { ok } from "@/lib/result";
import type { EntryStatus } from "@/lib/types/entry";

type ToastState = {
  type: "ok" | "err";
  msg: string;
};

type BusyUploadSource =
  | boolean
  | null
  | undefined
  | { busy?: boolean | null }
  | Record<string, unknown>
  | Array<unknown>;

type GenerateEntrySnapshot<TEntry> = (
  draftEntry: TEntry,
  persistDraft: (entry: TEntry) => Promise<TEntry>
) => Promise<{ entry: TEntry }>;

type HeaderActionBindings = {
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
  saveIntent: EntrySaveIntent | null;
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

type PdfActionBindings = {
  isViewMode: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  generating: boolean;
  pdfMeta: { url?: string | null; fileName?: string; generatedAtISO?: string } | null | undefined;
  pdfStale: boolean;
  canPreview: boolean;
  canDownload: boolean;
  pdfDisabled: boolean;
};

type ConfirmableEntryLike = {
  id: string;
  status?: string | null;
  confirmationStatus?: EntryStatus;
};

type CategoryPageEntry = CategorizableEntry & RequestEditableEntry & ConfirmableEntryLike;

type UseCategoryEntryPageControllerOptions<TEntry extends CategoryPageEntry> = {
  category: CategoryKey;
  list: TEntry[];
  setList: Dispatch<SetStateAction<TEntry[]>>;
  form: TEntry;
  formRef: MutableRefObject<TEntry>;
  showForm: boolean;
  isViewMode: boolean;
  entryLocked: boolean;
  controlsDisabled: boolean;
  loading: boolean;
  busyUploadSources: BusyUploadSource[];
  coreValid: boolean;
  hasPdfSnapshot: boolean;
  pdfStale: boolean;
  completionValid: boolean;
  fieldDirty: boolean;
  autoSaveSynced: boolean;
  defaultCancelTargetHref: string;
  closeForm: (targetHref?: string) => void | Promise<void>;
  buildEntryToSave: () => TEntry;
  buildOptimisticEntry: (entry: TEntry) => TEntry;
  persistProgress: (entry: TEntry) => Promise<TEntry>;
  persistRequestEdit: (entry: TEntry) => Promise<TEntry>;
  persistCancelRequestEdit: (entry: TEntry) => Promise<TEntry>;
  commitDraft: (entryId: string) => Promise<TEntry>;
  normalizePersistedEntry?: (entry: TEntry) => TEntry;
  applyPersistedEntry: (entry: TEntry) => void | Promise<void>;
  afterPersistSuccess?: (entry: TEntry, intent: EntrySaveIntent) => void | Promise<void>;
  setSubmitAttemptedFinal?: Dispatch<SetStateAction<boolean>>;
  saveBusyMessage?: string;
  saveSuccessMessage?: string;
  doneSuccessMessage?: string;
  saveErrorMessage?: string;
  cancelBusyMessage?: string;
  saveAndCloseBusyMessage?: string;
  autoSaveDebounceMs?: number;
  hasValidationErrors: boolean;
  markGenerateAttempted: () => void;
  beforeGenerate?: () => void;
  afterGenerate?: () => void;
  buildDraftEntry: () => TEntry;
  generateEntrySnapshot: GenerateEntrySnapshot<TEntry>;
  applyGeneratedEntry: (entry: TEntry) => void | Promise<void>;
  generateValidationMessage?: string;
  generateBusyMessage?: string;
  generateSuccessMessage?: string;
  generateErrorMessage?: string;
};

function hasBusyValue(value: BusyUploadSource): boolean {
  if (typeof value === "boolean") return value;
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item) => hasBusyValue(item as BusyUploadSource));
  }

  if ("busy" in value && typeof (value as { busy?: unknown }).busy === "boolean") {
    return Boolean((value as { busy?: boolean }).busy);
  }

  return Object.values(value).some((item) => hasBusyValue(item as BusyUploadSource));
}

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
  const nextRouter = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveIntent, setSaveIntent] = useState<EntrySaveIntent | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const saveLockRef = useRef(false);

  // Wrap afterPersistSuccess to also refresh server components
  const afterPersistSuccessWithRefresh = useCallback(
    async (entry: TEntry, intent: EntrySaveIntent) => {
      await afterPersistSuccess?.(entry, intent);
      nextRouter.refresh();
    },
    [afterPersistSuccess, nextRouter]
  );

  const hasBusyUploads = useMemo(
    () => busyUploadSources.some((source) => hasBusyValue(source)),
    [busyUploadSources]
  );

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
  const groupedEntries = useMemo(() => groupEntries(list), [list]);
  const smartGroupedEntries = useMemo(() => groupEntriesForList(list), [list]);

  const normalizePersisted = useCallback(
    (entry: TEntry) => (normalizePersistedEntry ? normalizePersistedEntry(entry) : entry),
    [normalizePersistedEntry]
  );

  const persistEntry = useCallback(
    async (entry: TEntry) => normalizePersisted(await persistProgress(entry)),
    [normalizePersisted, persistProgress]
  );

  const persistRequestEditEntry = useCallback(
    async (entry: TEntry) => normalizePersisted(await persistRequestEdit(entry)),
    [normalizePersisted, persistRequestEdit]
  );

  const persistCancelRequestEditEntry = useCallback(
    async (entry: TEntry) => normalizePersisted(await persistCancelRequestEdit(entry)),
    [normalizePersisted, persistCancelRequestEdit]
  );

  const commitDraftEntry = useCallback(
    async (entryId: string) => normalizePersisted(await commitDraft(entryId)),
    [commitDraft, normalizePersisted]
  );

  const saveDraftChanges = useCallback(
    async (options?: {
      closeAfterSave?: boolean;
      intent?: EntrySaveIntent;
      source?: EntrySaveSource;
      throwOnError?: boolean;
    }): Promise<TEntry | null> => {
      const intent = options?.intent ?? "save";
      return runSaveDraftOrchestration<TEntry>({
        intent,
        source: options?.source ?? "manual",
        closeAfterSave: options?.closeAfterSave ?? false,
        throwOnError: options?.throwOnError ?? false,
        canSave: lifecycle.canSave,
        hasBusyUploads,
        busyMessage: saveBusyMessage,
        saveSuccessMessage,
        doneSuccessMessage,
        saveErrorMessage,
        saveLockRef,
        setSaving,
        setSaveIntent,
        setToast,
        setList,
        buildEntryToSave,
        buildOptimisticEntry,
        persistProgress: persistEntry,
        commitDraft: commitDraftEntry,
        applyPersistedEntry,
        afterPersistSuccess: afterPersistSuccessWithRefresh,
        closeForm: async () => closeForm(),
      });
    },
    [
      afterPersistSuccessWithRefresh,
      applyPersistedEntry,
      buildEntryToSave,
      buildOptimisticEntry,
      closeForm,
      doneSuccessMessage,
      hasBusyUploads,
      lifecycle.canSave,
      persistEntry,
      saveBusyMessage,
      saveErrorMessage,
      saveSuccessMessage,
      setList,
      commitDraftEntry,
    ]
  );

  const generateEntry = useCallback(async (): Promise<boolean> => {
    const success = await runGenerateEntryOrchestration<TEntry>({
      saveLockRef,
      hasValidationErrors,
      canGenerate: lifecycle.canGenerate,
      hasBusyUploads,
      validationMessage: generateValidationMessage,
      busyMessage: generateBusyMessage,
      successMessage: generateSuccessMessage,
      errorMessage: generateErrorMessage,
      setSaving,
      setToast,
      markSubmitAttempted: markGenerateAttempted,
      beforeGenerate,
      afterGenerate,
      buildDraftEntry,
      generateEntrySnapshot,
      persistProgress: persistEntry,
      applyGeneratedEntry,
    });
    nextRouter.refresh();
    return success;
  }, [
    afterGenerate,
    applyGeneratedEntry,
    beforeGenerate,
    buildDraftEntry,
    generateBusyMessage,
    generateEntrySnapshot,
    generateErrorMessage,
    generateSuccessMessage,
    generateValidationMessage,
    hasBusyUploads,
    hasValidationErrors,
    lifecycle.canGenerate,
    markGenerateAttempted,
    nextRouter,
    persistEntry,
  ]);

  const showToast = useCallback(
    (type: ToastState["type"], msg: string, durationMs = 1800) => {
      setToast({ type, msg });
      setTimeout(() => setToast(null), durationMs);
    },
    []
  );

  const runWithSaveGuard = useCallback(
    async <T,>(task: () => Promise<T>, lockedMessage = "Please wait for the current save to finish.") => {
      if (saveLockRef.current) {
        throw new Error(lockedMessage);
      }

      saveLockRef.current = true;
      try {
        return await task();
      } finally {
        saveLockRef.current = false;
      }
    },
    []
  );

  const persistCurrentMutation = useCallback(
    async <TResult = TEntry,>(options: {
      buildNextEntry: (current: TEntry) => TEntry;
      selectResult?: (entry: TEntry) => TResult;
      lockedMessage?: string;
      intent?: EntrySaveIntent;
    }): Promise<TResult> => {
      return runPersistCurrentEntryMutation<TEntry, TResult>({
        saveLockRef,
        formRef,
        persistProgress: persistEntry,
        applyPersistedEntry,
        afterPersistSuccess: afterPersistSuccessWithRefresh,
        buildNextEntry: options.buildNextEntry,
        selectResult: options.selectResult,
        lockedMessage: options.lockedMessage,
        intent: options.intent,
      });
    },
    [afterPersistSuccessWithRefresh, applyPersistedEntry, formRef, persistEntry]
  );

  const {
    status: autoSaveStatus,
    markSaved: markAutoSaveSaved,
  } = useAutoSave<TEntry>({
    enabled: actionState.autoSaveEnabled,
    value: form,
    debounceMs: autoSaveDebounceMs,
    onSave: async () => {
      if (saving || hasBusyUploads) return null;
      const persisted = await saveDraftChanges({
        intent: "save",
        source: "autosave",
        throwOnError: true,
      });
      if (!persisted) return null;
      return ok(persisted);
    },
  });

  useEffect(() => {
    if (autoSaveSynced) {
      markAutoSaveSaved(form);
    }
  }, [autoSaveSynced, form, markAutoSaveSaved]);

  const { hasUnsavedChanges, confirmNavigate } = useUnsavedChangesGuard({
    enabled: showForm && !isViewMode && !entryLocked,
    isDirty: fieldDirty,
    isSaving: actionState.guardSaving || autoSaveStatus.phase === "saving",
  });

  const { handleCancel, handleSaveDraft, handleSaveAndClose } = useEntryPrimaryActions({
    defaultCancelTargetHref,
    hasBusyUploads,
    confirmNavigate,
    closeForm,
    saveDraftChanges,
    setToast,
    setSubmitAttemptedFinal,
    cancelBusyMessage,
    saveAndCloseBusyMessage,
  });

  const { requestingIds: requestingEditIds, requestEdit, cancelRequestEdit } = useRequestEdit<TEntry>({
    setItems: setList,
    persistRequest: persistRequestEditEntry,
    persistCancel: persistCancelRequestEditEntry,
    onSuccess: (message) => showToast("ok", message, 1400),
    onError: (message) => showToast("err", message, 1800),
  });

  const { sendingIds: sendingConfirmationIds, sendForConfirmation } = useEntryConfirmation<TEntry>({
    category,
    setItems: setList,
    onSuccess: (message) => showToast("ok", message, 1400),
    onError: (message) => showToast("err", message, 1800),
  });

  const [finalisingIds, setFinalisingIds] = useState<Record<string, boolean>>({});

  const finaliseEntry = useCallback(
    async (entry: TEntry) => {
      const entryId = entry.id;
      if (finalisingIds[entryId]) return;
      setFinalisingIds((prev) => ({ ...prev, [entryId]: true }));
      try {
        const res = await fetch("/api/me/entry/finalise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoryKey: category, entryId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || "Finalise failed.");
        }
        const updated = (await res.json()) as TEntry;
        setList((prev) => prev.map((e) => (e.id === entryId ? updated : e)));
        showToast("ok", "Entry finalised.", 1400);
        nextRouter.refresh();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Finalise failed.";
        showToast("err", message, 1800);
      } finally {
        setFinalisingIds((prev) => ({ ...prev, [entryId]: false }));
      }
    },
    [category, finalisingIds, nextRouter, setList, showToast]
  );

  const getHeaderActionProps = useCallback(
    (options?: {
      onAdd?: () => void;
      addLabel?: string;
      workflowAction?: HeaderActionBindings["workflowAction"];
      workflowDisabledHint?: string;
      entryStatus?: string | null;
      onRequestEdit?: () => void;
      onCancelRequestEdit?: () => void;
      onFinalise?: () => void;
      editTimeLabel?: string;
    }): HeaderActionBindings => ({
      isEditing: showForm,
      isViewMode,
      loading,
      onAdd: options?.onAdd,
      addLabel: options?.addLabel,
      onCancel: () => void handleCancel(),
      cancelDisabled: actionState.cancelDisabled,
      onSave: () => void handleSaveDraft(),
      saveDisabled: actionState.saveDisabled,
      onDone: () => void handleSaveAndClose(),
      doneDisabled: actionState.doneDisabled,
      saving,
      saveIntent,
      workflowAction: options?.workflowAction,
      workflowDisabledHint: options?.workflowDisabledHint,
      entryStatus: options?.entryStatus,
      onRequestEdit: options?.onRequestEdit,
      onCancelRequestEdit: options?.onCancelRequestEdit,
      onFinalise: options?.onFinalise,
      editTimeLabel: options?.editTimeLabel,
    }),
    [
      actionState.cancelDisabled,
      actionState.doneDisabled,
      actionState.saveDisabled,
      handleCancel,
      handleSaveAndClose,
      handleSaveDraft,
      isViewMode,
      loading,
      saveIntent,
      saving,
      showForm,
    ]
  );

  const getPdfActionProps = useCallback(
    (pdfMeta: PdfActionBindings["pdfMeta"]): PdfActionBindings => ({
      isViewMode,
      canGenerate: !actionState.generateDisabled,
      onGenerate: () => void generateEntry(),
      generating: saving,
      pdfMeta,
      pdfStale: workflow.coreDirty && workflow.hasPdfSnapshot,
      canPreview: lifecycle.canPreview,
      canDownload: lifecycle.canDownload,
      pdfDisabled: !lifecycle.canPreview,
    }),
    [actionState.generateDisabled, generateEntry, isViewMode, lifecycle.canDownload, lifecycle.canPreview, saving, workflow.coreDirty, workflow.hasPdfSnapshot]
  );

  return {
    actionState,
    autoSaveStatus,
    cancelRequestEdit,
    finaliseEntry,
    finalisingIds,
    generateEntry,
    getHeaderActionProps,
    getPdfActionProps,
    groupedEntries,
    smartGroupedEntries,
    handleCancel,
    handleSaveAndClose,
    handleSaveDraft,
    hasBusyUploads,
    hasUnsavedChanges,
    lifecycle,
    markAutoSaveSaved,
    persistCurrentMutation,
    requestEdit,
    requestingEditIds,
    runWithSaveGuard,
    saveDraftChanges,
    saveIntent,
    saving,
    sendForConfirmation,
    sendingConfirmationIds,
    setToast,
    showToast,
    toast,
    workflow,
    saveLockRef,
    formRef,
  };
}
