/**
 * Shared types for useCategoryEntryPageController and its sub-hooks.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  EntrySaveIntent,
  EntrySaveSource,
} from "@/lib/entries/pageOrchestration";
import type { CategoryKey, RequestEditableEntry } from "@/lib/entries/types";
import type { CategorizableEntry } from "@/lib/entryCategorization";
import type { EntryStatus } from "@/lib/types/entry";
export type { ToastState } from "@/lib/types/ui";
import type { ToastState } from "@/lib/types/ui";

// ── Core types ──────────────────────────────────────────────────────────────

export type BusyUploadSource =
  | boolean
  | null
  | undefined
  | { busy?: boolean | null }
  | Record<string, unknown>
  | Array<unknown>;

export type GenerateEntrySnapshot<TEntry> = (
  draftEntry: TEntry,
  persistDraft: (entry: TEntry) => Promise<TEntry>
) => Promise<{ entry: TEntry }>;

// ── Header / PDF action bindings ────────────────────────────────────────────

export type HeaderActionBindings = {
  isEditing: boolean;
  isViewMode: boolean;
  loading: boolean;
  formHasData?: boolean;
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
  finalise?: {
    canFinalise: boolean;
    onFinalise: () => void | Promise<boolean>;
    onAfterFinalise?: () => void;
    disabledReason?: string;
    editWindowExpiresAt?: string | null;
  };
  entryStatus?: string | null;
  onRequestEdit?: () => void;
  onCancelRequestEdit?: () => void;
  onRequestDelete?: () => void;
  onCancelRequestDelete?: () => void;
  editTimeLabel?: string;
  onBack?: () => void;
  permanentlyLocked?: boolean;
};

export type PdfActionBindings = {
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

// ── Entry constraints ───────────────────────────────────────────────────────

type ConfirmableEntryLike = {
  id: string;
  status?: string | null;
  confirmationStatus?: EntryStatus;
};

export type CategoryPageEntry = CategorizableEntry & RequestEditableEntry & ConfirmableEntryLike;

// ── Controller options ──────────────────────────────────────────────────────

export type UseCategoryEntryPageControllerOptions<TEntry extends CategoryPageEntry> = {
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
  persistRequestDelete?: (entry: TEntry) => Promise<TEntry>;
  persistCancelRequestDelete?: (entry: TEntry) => Promise<TEntry>;
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

// ── Helpers ─────────────────────────────────────────────────────────────────

export function hasBusyValue(value: BusyUploadSource): boolean {
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
