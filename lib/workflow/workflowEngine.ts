import { normalizeEntryStatus } from "@/lib/entries/workflow";
import type { CategoryKey } from "@/lib/entries/types";
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

export function computeWorkflowState(
  entry: Record<string, unknown>,
  category: CategoryKey,
  config: WorkflowConfig,
  options?: { saving?: boolean; loading?: boolean; hasBusyUploads?: boolean; fieldsDirty?: boolean },
): WorkflowState {
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
