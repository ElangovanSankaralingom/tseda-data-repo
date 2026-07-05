import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import type { CategoryKey } from "@/lib/entries/types";
import { AppError } from "@/lib/errors";
import { fireAndForget } from "@/lib/utils/fireAndForget";
import { canRequestAction, isEntryCommitted, normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { logger } from "@/lib/logger";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isEntryWon } from "@/lib/streakProgress";
import { pauseTimer, clearTimer } from "@/lib/workflow/timerManager";
import { appendActionHistory } from "@/lib/admin/actionHistory";
import { extractEntryTitle } from "@/lib/confirmations/notificationHelpers";
import { isEditReasonRequired } from "@/lib/settings/consumer";
import type { EntryEngineRecord, EntryLike, WorkflowEntryLike } from "./engineHelpers.ts";
import { runUserRequestMutation } from "./engineMutationRunner.ts";

function safeAppendHistory(params: Parameters<typeof appendActionHistory>[0]) {
  try {
    appendActionHistory(params);
  } catch (err) {
    logger.warn({ event: "action_history.append_failed", actionType: params.actionType, entryId: params.entryId }, err instanceof Error ? err.message : String(err));
  }
}

function isRecordFlow(existing: EntryLike): boolean {
  return (existing as Record<string, unknown>).entryFlow === "record";
}

function validateRequestEligibility(existing: EntryLike) {
  if ((existing as Record<string, unknown>).permanentlyLocked === true) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "This entry is permanently locked and cannot be modified." });
  }
  // Record flow: requests are RE-REQUESTABLE after resolution — a record must
  // stay correctable forever (a typo found in a two-year-old publication must
  // have recourse). The one-request-ever rule protects the timer game, which
  // records do not play. The monthly cap in canRequestAction still applies.
  if (!isRecordFlow(existing) && (existing as Record<string, unknown>).requestActionUsed === true) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "A request action has already been used on this entry." });
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
  const recordFlow = isRecordFlow(existing);
  const wasWin = isEntryWon(existing, fields);
  const transitioned = transitionEntry(existing as WorkflowEntryLike, transitionAction, { nowISO });
  if (message?.trim()) {
    (transitioned as Record<string, unknown>).editRequestMessage = message.trim();
  }
  // Permission flow: requesting on a Win forfeits the streak (anti-gaming for
  // the timer system). Record flow: corrections never forfeit the streak —
  // the win conditions are re-evaluated on resubmit anyway.
  if (wasWin && !recordFlow) {
    (transitioned as Record<string, unknown>).streakPermanentlyRemoved = true;
  }
  if (!recordFlow) {
    // Pause the timer while the request is pending (records have no timer).
    const timerPause = pauseTimer(existing as Record<string, unknown>);
    (transitioned as Record<string, unknown>).timerPausedAt = timerPause.timerPausedAt;
    (transitioned as Record<string, unknown>).timerRemainingMs = timerPause.timerRemainingMs;
  }
  // Request-history stamp (a GATE only in the permission flow).
  (transitioned as Record<string, unknown>).requestActionUsed = true;
  const now = new Date();
  const resetAt = typeof existing.requestCountResetAt === "string" && existing.requestCountResetAt.trim()
    ? new Date(existing.requestCountResetAt)
    : null;
  const sameMonth = resetAt !== null &&
    now.getUTCFullYear() === resetAt.getUTCFullYear() &&
    now.getUTCMonth() === resetAt.getUTCMonth();
  const currentCount = typeof existing.requestCount === "number" ? existing.requestCount : 0;
  const newCount = sameMonth ? currentCount + 1 : 1;
  const newResetAt = sameMonth ? existing.requestCountResetAt : now.toISOString();
  (transitioned as Record<string, unknown>).requestCount = newCount;
  (transitioned as Record<string, unknown>).requestCountResetAt = newResetAt;
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
  if (!message?.trim() && (await isEditReasonRequired())) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "A reason is required to request an edit." });
  }
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
      logger.info({ event: "entry.request", action: "edit_requested", category, entryId: String(entry.id ?? entryId), userEmail });
      const normalized = normalizeEmail(userEmail);
      fireAndForget(
        import("@/lib/confirmations/adminNotificationHelpers").then(({ notifyAdminEditRequest }) =>
          import("@/lib/confirmations/notificationHelpers").then(({ extractEntryTitle }) =>
            notifyAdminEditRequest(
              normalized,
              undefined,
              extractEntryTitle(entry as unknown as Record<string, unknown>, category),
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
    applyTransition: (existing, nowISO) => {
      const transitioned = transitionEntry(existing, "cancelEditRequest", { nowISO });
      const cleared = clearTimer();
      (transitioned as Record<string, unknown>).timerPausedAt = cleared.timerPausedAt;
      (transitioned as Record<string, unknown>).timerRemainingMs = cleared.timerRemainingMs;
      // Permission flow: cancelling your one request locks the entry forever.
      // Record flow: the entry simply returns to its locked GENERATED state —
      // it stays correctable via a future request.
      if (!isRecordFlow(existing as EntryLike)) {
        (transitioned as Record<string, unknown>).permanentlyLocked = true;
      }
      return transitioned as EntryLike;
    },
    afterSuccess: (entry) => {
      const normalized = normalizeEmail(userEmail);
      safeAppendHistory({
        actionType: "user_cancelled",
        entryId: String(entry.id ?? entryId),
        category,
        entryTitle: extractEntryTitle(entry as unknown as Record<string, unknown>, category),
        userEmail: normalized,
        userName: normalized.split("@")[0],
      });
    },
  });
}

/**
 * Cancels an edit grant, reverting the entry from EDIT_GRANTED back to
 * GENERATED (finalized). The transition clears grant fields and sets a fresh
 * edit window expiry (which will already be expired, making the entry finalized).
 *
 * @param userEmail - Email of the user cancelling the edit grant.
 * @param category - The category key the entry belongs to.
 * @param entryId - ID of the entry whose edit grant is being cancelled.
 * @returns The updated entry record after cancellation.
 */
export async function cancelEditGrant<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  return runUserRequestMutation<T>({
    action: "cancelEditGrant",
    walAction: "CANCEL_EDIT_GRANT",
    guardKey: `entry.edit.cancel_grant.${category}`,
    userEmail,
    category,
    entryId,
    extraValidation: (existing) => {
      if (normalizeEntryStatus(existing as WorkflowEntryLike) !== "EDIT_GRANTED") {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry is not in EDIT_GRANTED state." });
      }
    },
    applyTransition: (existing, nowISO) =>
      transitionEntry(existing, "cancelEditGrant", { nowISO }) as EntryLike,
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
      if ((existing as Record<string, unknown>).requestActionUsed === true) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "A request action has already been used on this entry." });
      }
      if (!isEntryCommitted(existing as WorkflowEntryLike)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry must be generated before requesting deletion." });
      }
      if (!canRequestAction(existing as WorkflowEntryLike)) {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry is not in a state where delete can be requested, or monthly request limit reached." });
      }
    },
    applyTransition: (existing, nowISO) => applyRequestFields(existing as EntryLike, category, "requestDelete", nowISO, message),
    afterSuccess: (entry) => {
      logger.info({ event: "entry.request", action: "delete_requested", category, entryId: String(entry.id ?? entryId), userEmail });
      const normalized = normalizeEmail(userEmail);
      fireAndForget(
        import("@/lib/confirmations/adminNotificationHelpers").then(({ notifyAdminDeleteRequest }) =>
          import("@/lib/confirmations/notificationHelpers").then(({ extractEntryTitle }) =>
            notifyAdminDeleteRequest(
              normalized,
              undefined,
              extractEntryTitle(entry as unknown as Record<string, unknown>, category),
              category,
              String(entry.id ?? entryId),
            ),
          ),
        ),
        "notifyAdminDeleteRequest",
      );
    },
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
    applyTransition: (existing, nowISO) => {
      const transitioned = transitionEntry(existing, "cancelDeleteRequest", { nowISO });
      const cleared = clearTimer();
      (transitioned as Record<string, unknown>).timerPausedAt = cleared.timerPausedAt;
      (transitioned as Record<string, unknown>).timerRemainingMs = cleared.timerRemainingMs;
      // Record flow stays correctable — no permanent lock on cancel.
      if (!isRecordFlow(existing as EntryLike)) {
        (transitioned as Record<string, unknown>).permanentlyLocked = true;
      }
      return transitioned as EntryLike;
    },
    afterSuccess: (entry) => {
      const normalized = normalizeEmail(userEmail);
      safeAppendHistory({
        actionType: "user_cancelled",
        entryId: String(entry.id ?? entryId),
        category,
        entryTitle: extractEntryTitle(entry as unknown as Record<string, unknown>, category),
        userEmail: normalized,
        userName: normalized.split("@")[0],
      });
    },
  });
}
