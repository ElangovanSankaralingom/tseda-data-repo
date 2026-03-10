"use client";

/**
 * Sub-hook: save orchestration, persist mutations, auto-save, unsaved-changes guard,
 * and primary actions (save/done/cancel buttons).
 */
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useEntryPrimaryActions } from "@/hooks/useEntryPrimaryActions";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  runPersistCurrentEntryMutation,
  runSaveDraftOrchestration,
  type EntrySaveIntent,
  type EntrySaveSource,
} from "@/lib/entries/pageOrchestration";
import { ok } from "@/lib/result";
import type { CategoryPageEntry, ToastState } from "@/hooks/controllerTypes";

type UseEntrySaveOrchestrationOptions<TEntry extends CategoryPageEntry> = {
  // Shared state (owned by the main controller)
  saving: boolean;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setSaveIntent: Dispatch<SetStateAction<EntrySaveIntent | null>>;
  setToast: Dispatch<SetStateAction<ToastState | null>>;
  saveLockRef: MutableRefObject<boolean>;
  hasBusyUploads: boolean;

  // Entry data
  form: TEntry;
  formRef: MutableRefObject<TEntry>;
  setList: Dispatch<SetStateAction<TEntry[]>>;
  showForm: boolean;
  isViewMode: boolean;
  entryLocked: boolean;
  fieldDirty: boolean;
  autoSaveSynced: boolean;

  // Lifecycle
  canSave: boolean;
  autoSaveEnabled: boolean;
  guardSaving: boolean;

  // Persist functions
  persistProgress: (entry: TEntry) => Promise<TEntry>;
  normalizePersistedEntry?: (entry: TEntry) => TEntry;
  commitDraft: (entryId: string) => Promise<TEntry>;
  applyPersistedEntry: (entry: TEntry) => void | Promise<void>;
  afterPersistSuccess?: (entry: TEntry, intent: EntrySaveIntent) => void | Promise<void>;
  buildEntryToSave: () => TEntry;
  buildOptimisticEntry: (entry: TEntry) => TEntry;
  closeForm: (targetHref?: string) => void | Promise<void>;
  defaultCancelTargetHref: string;
  setSubmitAttemptedFinal?: Dispatch<SetStateAction<boolean>>;

  // Messages
  saveBusyMessage: string;
  saveSuccessMessage: string;
  doneSuccessMessage: string;
  saveErrorMessage: string;
  cancelBusyMessage: string;
  saveAndCloseBusyMessage: string;
  autoSaveDebounceMs: number;
};

export function useEntrySaveOrchestration<TEntry extends CategoryPageEntry>(
  options: UseEntrySaveOrchestrationOptions<TEntry>,
) {
  const nextRouter = useRouter();

  const normalizePersisted = useCallback(
    (entry: TEntry) => (options.normalizePersistedEntry ? options.normalizePersistedEntry(entry) : entry),
    [options],
  );

  const persistEntry = useCallback(
    async (entry: TEntry) => normalizePersisted(await options.persistProgress(entry)),
    [normalizePersisted, options],
  );

  const commitDraftEntry = useCallback(
    async (entryId: string) => normalizePersisted(await options.commitDraft(entryId)),
    [options, normalizePersisted],
  );

  const afterPersistSuccessWithRefresh = useCallback(
    async (entry: TEntry, intent: EntrySaveIntent) => {
      await options.afterPersistSuccess?.(entry, intent);
      nextRouter.refresh();
    },
    [options, nextRouter],
  );

  const showToast = useCallback(
    (type: ToastState["type"], msg: string, durationMs = 1800) => {
      options.setToast({ type, msg });
      setTimeout(() => options.setToast(null), durationMs);
    },
    [options],
  );

  const saveDraftChanges = useCallback(
    async (saveOptions?: {
      closeAfterSave?: boolean;
      intent?: EntrySaveIntent;
      source?: EntrySaveSource;
      throwOnError?: boolean;
    }): Promise<TEntry | null> => {
      const intent = saveOptions?.intent ?? "save";
      return runSaveDraftOrchestration<TEntry>({
        intent,
        source: saveOptions?.source ?? "manual",
        closeAfterSave: saveOptions?.closeAfterSave ?? false,
        throwOnError: saveOptions?.throwOnError ?? false,
        canSave: options.canSave,
        hasBusyUploads: options.hasBusyUploads,
        busyMessage: options.saveBusyMessage,
        saveSuccessMessage: options.saveSuccessMessage,
        doneSuccessMessage: options.doneSuccessMessage,
        saveErrorMessage: options.saveErrorMessage,
        saveLockRef: options.saveLockRef,
        setSaving: options.setSaving,
        setSaveIntent: options.setSaveIntent,
        setToast: options.setToast,
        setList: options.setList,
        buildEntryToSave: options.buildEntryToSave,
        buildOptimisticEntry: options.buildOptimisticEntry,
        persistProgress: persistEntry,
        commitDraft: commitDraftEntry,
        applyPersistedEntry: options.applyPersistedEntry,
        afterPersistSuccess: afterPersistSuccessWithRefresh,
        closeForm: async () => options.closeForm(),
      });
    },
    [
      afterPersistSuccessWithRefresh,
      commitDraftEntry,
      options,
      persistEntry,
    ],
  );

  const runWithSaveGuard = useCallback(
    async <T,>(task: () => Promise<T>, lockedMessage = "Please wait for the current save to finish.") => {
      if (options.saveLockRef.current) {
        throw new Error(lockedMessage);
      }
      options.saveLockRef.current = true;
      try {
        return await task();
      } finally {
        options.saveLockRef.current = false;
      }
    },
    [options],
  );

  const persistCurrentMutation = useCallback(
    async <TResult = TEntry,>(mutationOptions: {
      buildNextEntry: (current: TEntry) => TEntry;
      selectResult?: (entry: TEntry) => TResult;
      lockedMessage?: string;
      intent?: EntrySaveIntent;
    }): Promise<TResult> => {
      return runPersistCurrentEntryMutation<TEntry, TResult>({
        saveLockRef: options.saveLockRef,
        formRef: options.formRef,
        persistProgress: persistEntry,
        applyPersistedEntry: options.applyPersistedEntry,
        afterPersistSuccess: afterPersistSuccessWithRefresh,
        buildNextEntry: mutationOptions.buildNextEntry,
        selectResult: mutationOptions.selectResult,
        lockedMessage: mutationOptions.lockedMessage,
        intent: mutationOptions.intent,
      });
    },
    [afterPersistSuccessWithRefresh, options, persistEntry],
  );

  // --- Auto-save ---
  const {
    status: autoSaveStatus,
    markSaved: markAutoSaveSaved,
  } = useAutoSave<TEntry>({
    enabled: options.autoSaveEnabled,
    value: options.form,
    debounceMs: options.autoSaveDebounceMs,
    onSave: async () => {
      if (options.saving || options.hasBusyUploads) return null;
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
    if (options.autoSaveSynced) {
      markAutoSaveSaved(options.form);
    }
  }, [options.autoSaveSynced, options.form, markAutoSaveSaved]);

  // --- Unsaved changes guard ---
  const { hasUnsavedChanges, confirmNavigate } = useUnsavedChangesGuard({
    enabled: options.showForm && !options.isViewMode && !options.entryLocked,
    isDirty: options.fieldDirty,
    isSaving: options.guardSaving || autoSaveStatus.phase === "saving",
  });

  // --- Primary actions ---
  const { handleCancel, handleSaveDraft, handleSaveAndClose } = useEntryPrimaryActions({
    defaultCancelTargetHref: options.defaultCancelTargetHref,
    hasBusyUploads: options.hasBusyUploads,
    confirmNavigate,
    closeForm: options.closeForm,
    saveDraftChanges,
    setToast: options.setToast,
    setSubmitAttemptedFinal: options.setSubmitAttemptedFinal,
    cancelBusyMessage: options.cancelBusyMessage,
    saveAndCloseBusyMessage: options.saveAndCloseBusyMessage,
  });

  return {
    persistEntry,
    showToast,
    saveDraftChanges,
    runWithSaveGuard,
    persistCurrentMutation,
    autoSaveStatus,
    markAutoSaveSaved,
    hasUnsavedChanges,
    handleCancel,
    handleSaveDraft,
    handleSaveAndClose,
  };
}
