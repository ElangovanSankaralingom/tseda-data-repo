import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { createOptimisticSnapshot, optimisticUpsert } from "@/lib/ui/optimistic";

export type EntrySaveIntent = "save" | "done";
export type EntrySaveSource = "manual" | "autosave";

type ToastState = {
  type: "ok" | "err";
  msg: string;
};

type SaveDraftOrchestrationOptions<TEntry extends { id?: string | null }> = {
  intent: EntrySaveIntent;
  source: EntrySaveSource;
  closeAfterSave: boolean;
  throwOnError: boolean;
  canSave: boolean;
  hasBusyUploads: boolean;
  busyMessage: string;
  saveSuccessMessage: string;
  doneSuccessMessage: string;
  saveErrorMessage?: string;
  busyToastMs?: number;
  successToastMs?: number;
  errorToastMs?: number;
  saveLockRef: MutableRefObject<boolean>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setSaveIntent: Dispatch<SetStateAction<EntrySaveIntent | null>>;
  setToast: Dispatch<SetStateAction<ToastState | null>>;
  setList: Dispatch<SetStateAction<TEntry[]>>;
  buildEntryToSave: () => TEntry;
  buildOptimisticEntry: (entry: TEntry) => TEntry;
  persistProgress: (entry: TEntry) => Promise<TEntry>;
  commitDraft: (entryId: string) => Promise<TEntry>;
  applyPersistedEntry: (entry: TEntry) => void | Promise<void>;
  afterPersistSuccess?: (entry: TEntry, intent: EntrySaveIntent) => void | Promise<void>;
  closeForm?: () => void | Promise<void>;
};

function scheduleToastClear(
  setToast: Dispatch<SetStateAction<ToastState | null>>,
  durationMs: number
) {
  setTimeout(() => setToast(null), durationMs);
}

export async function runSaveDraftOrchestration<TEntry extends { id?: string | null }>({
  intent,
  source,
  closeAfterSave,
  throwOnError,
  canSave,
  hasBusyUploads,
  busyMessage,
  saveSuccessMessage,
  doneSuccessMessage,
  saveErrorMessage = "Save failed.",
  busyToastMs = 1800,
  successToastMs = 1400,
  errorToastMs = 1800,
  saveLockRef,
  setSaving,
  setSaveIntent,
  setToast,
  setList,
  buildEntryToSave,
  buildOptimisticEntry,
  persistProgress,
  commitDraft,
  applyPersistedEntry,
  afterPersistSuccess,
  closeForm,
}: SaveDraftOrchestrationOptions<TEntry>): Promise<TEntry | null> {
  const showToast = source !== "autosave";

  if (saveLockRef.current) return null;
  if (intent === "save" && !canSave) return null;

  saveLockRef.current = true;
  let rollbackSnapshot: TEntry[] | null = null;
  let lastPersistedEntry: TEntry | null = null;

  try {
    if (hasBusyUploads) {
      if (showToast) {
        setToast({ type: "err", msg: busyMessage });
        scheduleToastClear(setToast, busyToastMs);
      }
      return null;
    }

    setSaving(true);
    setSaveIntent(intent);

    const entryToSave = buildEntryToSave();
    const optimisticEntry = buildOptimisticEntry(entryToSave);

    setList((current) => {
      rollbackSnapshot = createOptimisticSnapshot(current);
      return optimisticUpsert(current, optimisticEntry);
    });

    const persisted = await persistProgress(entryToSave);
    lastPersistedEntry = persisted;
    setList((current) => optimisticUpsert(current, persisted));

    const shouldCommit = intent === "done" && !closeAfterSave;
    const finalEntry: TEntry = shouldCommit
      ? await commitDraft(String((persisted as { id?: string | null }).id))
      : persisted;

    if (shouldCommit) {
      lastPersistedEntry = finalEntry;
      setList((current) => optimisticUpsert(current, finalEntry));
    }

    await applyPersistedEntry(finalEntry);
    await afterPersistSuccess?.(finalEntry, intent);

    if (showToast) {
      setToast({ type: "ok", msg: intent === "done" ? doneSuccessMessage : saveSuccessMessage });
      scheduleToastClear(setToast, successToastMs);
    }

    if (closeAfterSave) {
      await closeForm?.();
    }

    return finalEntry;
  } catch (error) {
    if (lastPersistedEntry) {
      setList((current) => optimisticUpsert(current, lastPersistedEntry as TEntry));
    } else if (rollbackSnapshot) {
      setList(rollbackSnapshot);
    }

    if (showToast) {
      const message = error instanceof Error ? error.message : saveErrorMessage;
      setToast({ type: "err", msg: message });
      scheduleToastClear(setToast, errorToastMs);
    }

    if (throwOnError) {
      throw error;
    }

    return null;
  } finally {
    setSaving(false);
    setSaveIntent(null);
    saveLockRef.current = false;
  }
}

type GenerateEntryOrchestrationOptions<TEntry> = {
  saveLockRef: MutableRefObject<boolean>;
  hasValidationErrors: boolean;
  canGenerate: boolean;
  hasBusyUploads: boolean;
  validationMessage: string;
  busyMessage: string;
  successMessage: string;
  errorMessage: string;
  errorToastMs?: number;
  successToastMs?: number;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setToast: Dispatch<SetStateAction<ToastState | null>>;
  markSubmitAttempted: () => void;
  beforeGenerate?: () => void;
  afterGenerate?: () => void;
  buildDraftEntry: () => TEntry;
  generateEntrySnapshot: (
    draftEntry: TEntry,
    persistDraft: (entry: TEntry) => Promise<TEntry>
  ) => Promise<{ entry: TEntry }>;
  persistProgress: (entry: TEntry) => Promise<TEntry>;
  applyGeneratedEntry: (entry: TEntry) => void | Promise<void>;
};

export async function runGenerateEntryOrchestration<TEntry>({
  saveLockRef,
  hasValidationErrors,
  canGenerate,
  hasBusyUploads,
  validationMessage,
  busyMessage,
  successMessage,
  errorMessage,
  errorToastMs = 1800,
  successToastMs = 1400,
  setSaving,
  setToast,
  markSubmitAttempted,
  beforeGenerate,
  afterGenerate,
  buildDraftEntry,
  generateEntrySnapshot,
  persistProgress,
  applyGeneratedEntry,
}: GenerateEntryOrchestrationOptions<TEntry>): Promise<boolean> {
  if (saveLockRef.current) return false;
  saveLockRef.current = true;

  let success = false;
  try {
    markSubmitAttempted();

    if (hasValidationErrors || !canGenerate) {
      setToast({ type: "err", msg: validationMessage });
      scheduleToastClear(setToast, errorToastMs);
      return false;
    }

    if (hasBusyUploads) {
      setToast({ type: "err", msg: busyMessage });
      scheduleToastClear(setToast, errorToastMs);
      return false;
    }

    beforeGenerate?.();
    setSaving(true);

    const draftEntry = buildDraftEntry();
    const { entry: nextEntry } = await generateEntrySnapshot(draftEntry, persistProgress);
    await applyGeneratedEntry(nextEntry);

    setToast({ type: "ok", msg: successMessage });
    scheduleToastClear(setToast, successToastMs);
    success = true;
  } catch (error) {
    const message = error instanceof Error ? error.message : errorMessage;
    setToast({ type: "err", msg: message });
    scheduleToastClear(setToast, errorToastMs);
  } finally {
    setSaving(false);
    afterGenerate?.();
    saveLockRef.current = false;
  }
  return success;
}

type PersistCurrentEntryMutationOptions<
  TEntry extends { id?: string | null },
  TResult = TEntry,
> = {
  saveLockRef: MutableRefObject<boolean>;
  formRef: MutableRefObject<TEntry>;
  persistProgress: (entry: TEntry) => Promise<TEntry>;
  applyPersistedEntry: (entry: TEntry) => void | Promise<void>;
  afterPersistSuccess?: (entry: TEntry, intent: EntrySaveIntent) => void | Promise<void>;
  buildNextEntry: (current: TEntry) => TEntry;
  selectResult?: (entry: TEntry) => TResult;
  lockedMessage?: string;
  intent?: EntrySaveIntent;
};

export async function runPersistCurrentEntryMutation<
  TEntry extends { id?: string | null },
  TResult = TEntry,
>({
  saveLockRef,
  formRef,
  persistProgress,
  applyPersistedEntry,
  afterPersistSuccess,
  buildNextEntry,
  selectResult,
  lockedMessage = "Please wait for the current save to finish.",
  intent = "save",
}: PersistCurrentEntryMutationOptions<TEntry, TResult>): Promise<TResult> {
  if (saveLockRef.current) {
    throw new Error(lockedMessage);
  }

  saveLockRef.current = true;

  try {
    const nextEntry = buildNextEntry(formRef.current);
    const persisted = await persistProgress(nextEntry);
    await applyPersistedEntry(persisted);
    await afterPersistSuccess?.(persisted, intent);

    return selectResult ? selectResult(persisted) : (persisted as unknown as TResult);
  } finally {
    saveLockRef.current = false;
  }
}
