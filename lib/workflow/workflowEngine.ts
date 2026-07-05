import { normalizeEntryStatus } from "@/lib/entries/workflow";
import type { CategoryKey } from "@/lib/entries/types";
import { getCategoryFlow, type CategoryFlow } from "@/data/categoryRegistry";
import type { WorkflowConfig } from "./workflowConfig";
import { computeTimerState, type TimerState } from "./timerManager";
import { computeCompletionState, hasChangesSinceGrant, type CompletionState } from "./completionChecker";

export type ButtonState = {
  visible: boolean;
  enabled: boolean;
  label: string;
  disabledReason?: string;
};

export type RequestOption = {
  type: "edit" | "delete";
  label: string;
  enabled: boolean;
};

export type RequestState = {
  hasActiveRequest: boolean;
  requestType: "edit" | "delete" | null;
  canRequestEdit: boolean;
  canRequestDelete: boolean;
  canCancel: boolean;
  requestActionUsed: boolean;
};

export type WorkflowState = {
  status: string;
  /** Lifecycle archetype of the category ("permission" | "record"). */
  flow: CategoryFlow;
  isEditable: boolean;
  isFinalized: boolean;
  isPermanentlyLocked: boolean;
  isViewMode: boolean;

  timer: TimerState;
  completion: CompletionState;
  requestState: RequestState;

  buttons: {
    save: ButtonState;
    generate: ButtonState;
    finalise: ButtonState;
    requestAction: ButtonState & { options: RequestOption[] };
  };

  // For nightly job
  autoAction: "none" | "finalise" | "delete";
};

/** Inert timer for record-flow entries — there is no edit window at all. */
const NO_TIMER: TimerState = {
  isPaused: false,
  isExpired: false,
  remainingMs: null,
  expiresAt: null,
  pausedAt: null,
};

/**
 * RECORD FLOW — post-facto achievements (publications, grants, patents…).
 * No permission PDF, no timer. Draft (fields + proof uploads together) →
 * SUBMIT locks the entry; corrections only via edit/delete request to the
 * DLC/admin. Unlike the permission flow, requests are RE-REQUESTABLE after
 * resolution (a record must stay correctable forever) — but only one may be
 * pending at a time, and the nightly job never touches these entries.
 */
function computeRecordWorkflowState(
  entry: Record<string, unknown>,
  category: CategoryKey,
  config: WorkflowConfig,
  options?: { saving?: boolean; loading?: boolean; hasBusyUploads?: boolean; fieldsDirty?: boolean },
): WorkflowState {
  const status = normalizeEntryStatus(entry as Record<string, unknown> & { confirmationStatus?: string });
  const permanentlyLocked = entry.permanentlyLocked === true;
  const isCommitted = !!entry.committedAtISO;

  // PDF machinery does not exist in this flow.
  const recordConfig: WorkflowConfig = {
    ...config,
    completion: { ...config.completion, requireFreshPdf: false },
  };
  const completion = computeCompletionState(entry, category, recordConfig, true);

  const isPendingEdit = status === "EDIT_REQUESTED";
  const isPendingDelete = status === "DELETE_REQUESTED";
  const isPendingRequest = isPendingEdit || isPendingDelete;
  const isEditGranted = status === "EDIT_GRANTED";
  const isDraft = status === "DRAFT";
  const isArchived = status === "ARCHIVED";

  // Submitted = finalized, immediately. There is no in-between window.
  const isFinalized = status === "GENERATED" && isCommitted;
  const isEditable = !permanentlyLocked && !isArchived && (isDraft || isEditGranted);
  const isViewMode = !isEditable;

  const saving = options?.saving ?? false;
  const loading = options?.loading ?? false;
  const hasBusyUploads = options?.hasBusyUploads ?? false;
  const fieldsDirty = options?.fieldsDirty ?? false;
  const blockingBusy = saving || loading || hasBusyUploads;

  // Requests: re-requestable after resolution (requestActionUsed is history,
  // not a gate, in this flow); one pending at a time.
  const canRequestEdit = !permanentlyLocked && isFinalized && !isPendingRequest
    && config.requests.maxEditRequests > 0;
  const canRequestDelete = !permanentlyLocked && isFinalized && !isPendingRequest
    && config.requests.maxDeleteRequests > 0;
  const canCancel = isPendingRequest && !blockingBusy;

  const requestState: RequestState = {
    hasActiveRequest: isPendingRequest,
    requestType: isPendingEdit ? "edit" : isPendingDelete ? "delete" : null,
    canRequestEdit,
    canRequestDelete,
    canCancel,
    requestActionUsed: entry.requestActionUsed === true,
  };

  const saveVisible = isEditable;
  const saveEnabled = saveVisible && !blockingBusy && fieldsDirty;

  // Submit (reuses the generate slot): needs EVERYTHING — fields AND proofs.
  const submitVisible = isEditable;
  const submitEnabled = submitVisible && !blockingBusy
    && completion.stage1Complete && completion.stage2Complete;

  const requestActionVisible = isViewMode && isFinalized && !permanentlyLocked;
  const requestActionEnabled = requestActionVisible && !blockingBusy && !isPendingRequest;

  return {
    status,
    flow: "record",
    isEditable,
    isFinalized,
    isPermanentlyLocked: permanentlyLocked,
    isViewMode,
    timer: NO_TIMER,
    completion,
    requestState,
    buttons: {
      save: { visible: saveVisible, enabled: saveEnabled, label: "Save Draft" },
      generate: {
        visible: submitVisible,
        enabled: submitEnabled,
        label: isEditGranted ? "Resubmit Entry" : "Submit Entry",
      },
      finalise: { visible: false, enabled: false, label: "Finalise Now" },
      requestAction: {
        visible: requestActionVisible,
        enabled: requestActionEnabled,
        label: "Request Action",
        options: [
          ...(canRequestEdit ? [{ type: "edit" as const, label: "Request Edit", enabled: true }] : []),
          ...(canRequestDelete ? [{ type: "delete" as const, label: "Request Delete", enabled: true }] : []),
        ],
      },
    },
    // The nightly job NEVER auto-finalises or auto-deletes records.
    autoAction: "none",
  };
}

/**
 * Compute complete workflow state for an entry including timer, completion, buttons, and auto-actions.
 */
export function computeWorkflowState(
  entry: Record<string, unknown>,
  category: CategoryKey,
  config: WorkflowConfig,
  options?: { saving?: boolean; loading?: boolean; hasBusyUploads?: boolean; fieldsDirty?: boolean },
): WorkflowState {
  if (getCategoryFlow(category) === "record") {
    return computeRecordWorkflowState(entry, category, config, options);
  }
  const status = normalizeEntryStatus(entry as Record<string, unknown> & { confirmationStatus?: string });
  const permanentlyLocked = entry.permanentlyLocked === true;
  const requestActionUsed = entry.requestActionUsed === true;
  const isGenerated = !!(entry.committedAtISO || entry.generatedAt);

  // Timer
  const timer = computeTimerState(entry as Record<string, unknown> & { editWindowExpiresAt?: string | null; timerPausedAt?: string | null; timerRemainingMs?: number | null; confirmationStatus?: string | null }, config);

  // Completion
  const completion = computeCompletionState(entry, category, config, isGenerated);

  // Derived states
  const isPendingEdit = status === "EDIT_REQUESTED";
  const isPendingDelete = status === "DELETE_REQUESTED";
  const isPendingRequest = isPendingEdit || isPendingDelete;
  const isEditGranted = status === "EDIT_GRANTED";
  const isDraft = status === "DRAFT";
  const isArchived = status === "ARCHIVED";

  const isFinalized = !isDraft && !isPendingRequest && !isEditGranted && !isArchived
    && status === "GENERATED" && timer.isExpired;

  const isEditable = !permanentlyLocked && (
    isDraft ||
    isEditGranted ||
    (status === "GENERATED" && !timer.isExpired && !isPendingRequest)
  );

  const isViewMode = !isEditable || isPendingRequest || isFinalized || permanentlyLocked;

  // UI options
  const saving = options?.saving ?? false;
  const loading = options?.loading ?? false;
  const hasBusyUploads = options?.hasBusyUploads ?? false;
  const fieldsDirty = options?.fieldsDirty ?? false;
  const blockingBusy = saving || loading || hasBusyUploads;

  // Request state
  const canRequestEdit = !permanentlyLocked && !requestActionUsed && isFinalized && !isPendingRequest
    && config.requests.maxEditRequests > 0;
  const canRequestDelete = !permanentlyLocked && !requestActionUsed && isFinalized && !isPendingRequest
    && config.requests.maxDeleteRequests > 0;
  const canCancel = isPendingRequest && !blockingBusy;

  const requestState: RequestState = {
    hasActiveRequest: isPendingRequest,
    requestType: isPendingEdit ? "edit" : isPendingDelete ? "delete" : null,
    canRequestEdit,
    canRequestDelete,
    canCancel,
    requestActionUsed,
  };

  // Button: Save
  const saveVisible = isEditable && !isViewMode;
  const saveEnabled = saveVisible && !blockingBusy && fieldsDirty;

  // Button: Generate
  const generateVisible = isEditable && !isViewMode && (isDraft || status === "GENERATED" || isEditGranted);
  const generateEnabled = generateVisible && !blockingBusy
    && completion.stage1Complete
    && (!completion.pdfExists || !completion.pdfFresh);

  // Button: Finalise
  const finaliseVisible = isEditable && !isViewMode && completion.pdfExists && completion.pdfFresh;
  const finaliseEnabled = finaliseVisible && !blockingBusy && !isPendingRequest && !permanentlyLocked
    && completion.allComplete;

  // Button: Request Action
  const requestActionVisible = isViewMode && isFinalized && !permanentlyLocked && !requestActionUsed;
  const requestActionEnabled = requestActionVisible && !blockingBusy && !isPendingRequest;

  // Auto-action for nightly job
  let autoAction: "none" | "finalise" | "delete" = "none";
  if (timer.isExpired && !permanentlyLocked && !timer.isPaused) {
    if (status === "EDIT_GRANTED") {
      const changesMade = hasChangesSinceGrant(entry, category);
      if (!changesMade && completion.allComplete && completion.pdfFresh) {
        autoAction = config.autoActions.finaliseCompleteOnExpiry ? "finalise" : "none";
      } else {
        autoAction = config.autoActions.deleteIncompleteOnExpiry ? "delete" : "none";
      }
    } else if (status === "GENERATED" || isDraft) {
      if (completion.allComplete && completion.pdfFresh) {
        autoAction = config.autoActions.finaliseCompleteOnExpiry ? "finalise" : "none";
      } else {
        autoAction = config.autoActions.deleteIncompleteOnExpiry ? "delete" : "none";
      }
    }
  }

  return {
    status,
    flow: "permission",
    isEditable,
    isFinalized,
    isPermanentlyLocked: permanentlyLocked,
    isViewMode,
    timer,
    completion,
    requestState,
    buttons: {
      save: { visible: saveVisible, enabled: saveEnabled, label: "Save Draft" },
      generate: {
        visible: generateVisible,
        enabled: generateEnabled,
        label: completion.pdfExists ? "Regenerate" : "Generate Entry",
      },
      finalise: {
        visible: finaliseVisible,
        enabled: finaliseEnabled,
        label: "Finalise Now",
      },
      requestAction: {
        visible: requestActionVisible,
        enabled: requestActionEnabled,
        label: "Request Action",
        options: [
          ...(canRequestEdit ? [{ type: "edit" as const, label: "Request Edit", enabled: true }] : []),
          ...(canRequestDelete ? [{ type: "delete" as const, label: "Request Delete", enabled: true }] : []),
        ],
      },
    },
    autoAction,
  };
}
