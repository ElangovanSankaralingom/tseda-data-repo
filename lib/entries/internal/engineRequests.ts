import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import type { CategoryKey } from "@/lib/entries/types";
import { AppError } from "@/lib/errors";
import { fireAndForget } from "@/lib/utils/fireAndForget";
import { canRequestAction, isEntryCommitted, normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isEntryWon } from "@/lib/streakProgress";
import type { EntryEngineRecord, EntryLike, WorkflowEntryLike } from "./engineHelpers.ts";
import { runUserRequestMutation } from "./engineMutationRunner.ts";

function validateRequestEligibility(existing: EntryLike) {
  if ((existing as Record<string, unknown>).permanentlyLocked === true) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "This entry is permanently locked and cannot be modified." });
  }
  if (!isEntryCommitted(existing as WorkflowEntryLike)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Entry must be generated before requesting edit access." });
  }
  if (!canRequestAction(existing as WorkflowEntryLike)) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Entry is not in a state where this action can be requested, or monthly request limit reached." });
  }
}

function applyRequestFields(
  existing: EntryLike,
  category: CategoryKey,
  transitionAction: "requestEdit" | "requestDelete",
  nowISO: string,
  message?: string,
): EntryLike {
  const fields = ENTRY_SCHEMAS[category]?.fields ?? [];
  const wasWin = isEntryWon(existing, fields);
  const transitioned = transitionEntry(existing as WorkflowEntryLike, transitionAction, { nowISO });
  if (message?.trim()) {
    (transitioned as Record<string, unknown>).editRequestMessage = message.trim();
  }
  if (wasWin) {
    (transitioned as Record<string, unknown>).streakPermanentlyRemoved = true;
  }
  const currentCount = typeof existing.requestCount === "number" ? existing.requestCount : 0;
  (transitioned as Record<string, unknown>).requestCount = currentCount + 1;
  return transitioned as EntryLike;
}

/**
 * Submits an edit request for a finalized entry. Validates that the entry is
 * committed and eligible for requests, transitions it to EDIT_REQUESTED, and
 * notifies the admin of the request.
 *
 * @param userEmail - Email of the user requesting the edit.
 * @param category - The category key the entry belongs to.
 * @param entryId - ID of the entry to request edit access for.
 * @param message - Optional message from the user explaining the edit request.
 * @returns The updated entry record in EDIT_REQUESTED state.
 */
export async function requestEdit<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  message?: string
): Promise<T> {
  return runUserRequestMutation<T>({
    action: "requestEdit",
    walAction: "REQUEST_EDIT",
    guardKey: `entry.edit.request.${category}`,
    userEmail,
    category,
    entryId,
    extraValidation: validateRequestEligibility,
    applyTransition: (existing, nowISO) => applyRequestFields(existing as EntryLike, category, "requestEdit", nowISO, message),
    afterSuccess: (entry) => {
      const normalized = normalizeEmail(userEmail);
      fireAndForget(
        import("@/lib/confirmations/adminNotificationHelpers").then(({ notifyAdminEditRequest }) =>
          import("@/lib/confirmations/notificationHelpers").then(({ extractEntryTitle }) =>
            notifyAdminEditRequest(
              normalized,
              undefined,
              extractEntryTitle(entry as unknown as Record<string, unknown>),
              category,
              String(entry.id ?? entryId),
            ),
          ),
        ),
        "notifyAdminEditRequest",
      );
    },
  });
}

/**
 * Cancels a pending edit request, reverting the entry from EDIT_REQUESTED back
 * to its previous state.
 *
 * @param userEmail - Email of the user cancelling the request.
 * @param category - The category key the entry belongs to.
 * @param entryId - ID of the entry whose edit request is being cancelled.
 * @returns The updated entry record after cancellation.
 */
export async function cancelEditRequest<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  return runUserRequestMutation<T>({
    action: "cancelEditRequest",
    walAction: "CANCEL_EDIT_REQUEST",
    guardKey: `entry.edit.cancel.${category}`,
    userEmail,
    category,
    entryId,
    extraValidation: (existing) => {
      if (normalizeEntryStatus(existing as WorkflowEntryLike) !== "EDIT_REQUESTED") {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry is not in EDIT_REQUESTED state." });
      }
    },
    applyTransition: (existing, nowISO) =>
      transitionEntry(existing, "cancelEditRequest", { nowISO }) as EntryLike,
  });
}

/**
 * Submits a delete request for a finalized entry. Validates that the entry is
 * committed, not permanently locked, and eligible for requests, then transitions
 * it to DELETE_REQUESTED.
 *
 * @param userEmail - Email of the user requesting deletion.
 * @param category - The category key the entry belongs to.
 * @param entryId - ID of the entry to request deletion for.
 * @param message - Optional message from the user explaining the delete request.
 * @returns The updated entry record in DELETE_REQUESTED state.
 */
export async function requestDelete<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  message?: string
): Promise<T> {
  return runUserRequestMutation<T>({
    action: "requestDelete",
    walAction: "REQUEST_DELETE",
    guardKey: `entry.delete.request.${category}`,
    userEmail,
    category,
    entryId,
    extraValidation: (existing) => {
      if ((existing as Record<string, unknown>).permanentlyLocked === true) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "This entry is permanently locked and cannot be modified." });
      }
      if (!isEntryCommitted(existing as WorkflowEntryLike)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry must be generated before requesting deletion." });
      }
      if (!canRequestAction(existing as WorkflowEntryLike)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry is not in a state where delete can be requested, or monthly request limit reached." });
      }
    },
    applyTransition: (existing, nowISO) => applyRequestFields(existing as EntryLike, category, "requestDelete", nowISO, message),
  });
}

/**
 * Cancels a pending delete request, reverting the entry from DELETE_REQUESTED
 * back to its previous state.
 *
 * @param userEmail - Email of the user cancelling the request.
 * @param category - The category key the entry belongs to.
 * @param entryId - ID of the entry whose delete request is being cancelled.
 * @returns The updated entry record after cancellation.
 */
export async function cancelDeleteRequest<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  return runUserRequestMutation<T>({
    action: "cancelDeleteRequest",
    walAction: "CANCEL_DELETE_REQUEST",
    guardKey: `entry.delete.cancel.${category}`,
    userEmail,
    category,
    entryId,
    extraValidation: (existing) => {
      if (normalizeEntryStatus(existing as WorkflowEntryLike) !== "DELETE_REQUESTED") {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry is not in DELETE_REQUESTED state." });
      }
    },
    applyTransition: (existing, nowISO) =>
      transitionEntry(existing, "cancelDeleteRequest", { nowISO }) as EntryLike,
  });
}
