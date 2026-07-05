import "server-only";

import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { resumeTimer, clearTimer } from "@/lib/workflow/timerManager";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { AppError } from "@/lib/errors";
import { fireAndForget } from "@/lib/utils/fireAndForget";
import { logger } from "@/lib/logger";
import { appendActionHistory } from "@/lib/admin/actionHistory";
import { extractEntryTitle } from "@/lib/confirmations/notificationHelpers";
import type { EntryEngineRecord, EntryLike } from "./engineHelpers.ts";
import { runAdminMutation } from "./engineMutationRunner.ts";

function safeAppendHistory(params: Parameters<typeof appendActionHistory>[0]) {
  try {
    appendActionHistory(params);
  } catch (err) {
    logger.warn({ event: "action_history.append_failed", actionType: params.actionType, entryId: params.entryId }, err instanceof Error ? err.message : String(err));
  }
}

function userNameFromEmail(email: string): string {
  return email.split("@")[0];
}

/**
 * Grants edit access to a finalized entry on behalf of an admin. Transitions
 * the entry to EDIT_GRANTED, marks the PDF as stale, and sends a notification
 * to the entry owner.
 *
 * @param adminEmail - Email of the admin granting access.
 * @param category - The category key the entry belongs to.
 * @param ownerEmail - Email of the entry owner.
 * @param entryId - ID of the entry to grant edit access for.
 * @returns The updated entry record.
 */
export async function grantEditAccess<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  return runAdminMutation<T>({
    action: "grantEdit",
    walAction: "GRANT_EDIT",
    guardKey: "entry.edit.grant",
    requiredScope: "editApproval",
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { normalizedAdmin, nowISO }) => {
      const transitioned = transitionEntry(existing, "grantEdit", { nowISO, adminEmail: normalizedAdmin });
      if ((existing as Record<string, unknown>).entryFlow === "record") {
        // Record flow: no PDF to stale, no timer to resume. The grant simply
        // unlocks the entry (EDIT_GRANTED is editable by status); it locks
        // again the moment the faculty resubmits.
        (transitioned as Record<string, unknown>).hashAtEditGrant = hashPrePdfFields(existing as Record<string, unknown>, category);
        return transitioned as EntryLike;
      }
      (transitioned as EntryEngineRecord).pdfStale = true;
      // Resume paused timer and record hash at grant
      const resumed = resumeTimer(existing as Record<string, unknown>);
      (transitioned as Record<string, unknown>).editWindowExpiresAt = resumed.editWindowExpiresAt;
      (transitioned as Record<string, unknown>).timerPausedAt = resumed.timerPausedAt;
      (transitioned as Record<string, unknown>).timerRemainingMs = resumed.timerRemainingMs;
      (transitioned as Record<string, unknown>).hashAtEditGrant = hashPrePdfFields(existing as Record<string, unknown>, category);
      return transitioned as EntryLike;
    },
    afterSuccess: (entry) => {
      logger.info({ event: "entry.admin_action", action: "grant_edit", category, entryId: String(entry.id ?? entryId), adminEmail });
      const normalized = normalizeEmail(ownerEmail);
      safeAppendHistory({
        actionType: "edit_granted",
        entryId: String(entry.id ?? entryId),
        category,
        entryTitle: extractEntryTitle(entry as unknown as Record<string, unknown>, category),
        userEmail: normalized,
        userName: userNameFromEmail(normalized),
        adminEmail,
      });
      fireAndForget(
        import("@/lib/confirmations/notificationHelpers").then(({ notifyEditGranted, extractEntryTitle: ext }) =>
          notifyEditGranted(normalized, ext(entry as unknown as Record<string, unknown>, category), undefined, category),
        ),
        "notifyEditGranted",
      );
    },
  });
}

/**
 * Rejects a pending edit request for an entry. Transitions the entry back from
 * EDIT_REQUESTED, optionally records the rejection reason, and notifies the
 * entry owner.
 *
 * @param adminEmail - Email of the admin rejecting the request.
 * @param category - The category key the entry belongs to.
 * @param ownerEmail - Email of the entry owner.
 * @param entryId - ID of the entry whose edit request is being rejected.
 * @param reason - Optional reason for the rejection, stored on the entry.
 * @returns The updated entry record.
 */
export async function rejectEditRequest<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string,
  reason?: string
): Promise<T> {
  return runAdminMutation<T>({
    action: "rejectEdit",
    walAction: "REJECT_EDIT",
    guardKey: "entry.edit.reject",
    requiredScope: "editApproval",
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { normalizedAdmin, nowISO }) => {
      const transitioned = transitionEntry(existing, "rejectEdit", { nowISO, adminEmail: normalizedAdmin });
      if (reason?.trim()) {
        (transitioned as Record<string, unknown>).editRejectedReason = reason.trim();
      }
      const cleared = clearTimer();
      (transitioned as Record<string, unknown>).timerPausedAt = cleared.timerPausedAt;
      (transitioned as Record<string, unknown>).timerRemainingMs = cleared.timerRemainingMs;
      // Record flow: a rejection settles THIS request but the record stays
      // correctable — a future request (with better justification) is allowed.
      if ((existing as Record<string, unknown>).entryFlow !== "record") {
        (transitioned as Record<string, unknown>).permanentlyLocked = true;
      }
      (transitioned as Record<string, unknown>).requestActionUsed = true;
      return transitioned as EntryLike;
    },
    afterSuccess: (entry) => {
      logger.info({ event: "entry.admin_action", action: "reject_edit", category, entryId: String(entry.id ?? entryId), adminEmail });
      const normalized = normalizeEmail(ownerEmail);
      safeAppendHistory({
        actionType: "edit_rejected",
        entryId: String(entry.id ?? entryId),
        category,
        entryTitle: extractEntryTitle(entry as unknown as Record<string, unknown>, category),
        userEmail: normalized,
        userName: userNameFromEmail(normalized),
        adminEmail,
      });
      fireAndForget(
        import("@/lib/confirmations/notificationHelpers").then(({ notifyEditRejected, extractEntryTitle: ext }) =>
          notifyEditRejected(normalized, ext(entry as unknown as Record<string, unknown>, category), reason?.trim(), category),
        ),
        "notifyEditRejected",
      );
    },
  });
}

/**
 * Approves a pending delete request by **permanently deleting** the entry.
 * Removes the entry from the JSON store, deletes all uploaded files from disk,
 * updates the user index, logs a WAL event, and notifies the owner.
 *
 * @param adminEmail - Email of the admin approving the deletion.
 * @param category - The category key the entry belongs to.
 * @param ownerEmail - Email of the entry owner.
 * @param entryId - ID of the entry whose delete request is being approved.
 * @returns The deleted entry record (for the API response).
 */
export async function approveDelete<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  const { canManageEditRequests } = await import("@/lib/admin/roles");
  const { canApproveDeleteForCategory } = await import("@/lib/admin/coordinators");
  const { withUserDataLock } = await import("@/lib/data/locks");
  const { buildEvent } = await import("@/lib/data/wal");
  const { quarantineEntry, removeEmptyUploadDir, collectEntryFilePaths, FACULTY_DELETE_REASON } =
    await import("@/lib/jobs/quarantine");
  const {
    normalizeId,
    enforceAdminMutationGuards,
    readEntryRaw,
    deleteEntryRaw,
    refreshIndexForMutation,
    revalidateDashboardSummary,
    appendWalEventOrThrow,
    trackEntryMutationSuccess,
    trackEntryMutationFailure,
  } = await import("./engineHelpers.ts");

  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();

  logger.info({
    event: "entry.mutation.start",
    action: "approveDelete",
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });

  try {
    // Global approvers (master/reviewer) may approve any delete; a coordinator
    // with the approveDeletes power may approve in their categories, but NOT on
    // their own entry (self-approval block, E1).
    const isGlobalApprover = canManageEditRequests(normalizedAdmin);
    const coordinatorMayDelete =
      !isGlobalApprover &&
      normalizedAdmin !== normalizedOwner &&
      canApproveDeleteForCategory(normalizedAdmin, category);
    if (!isGlobalApprover && !coordinatorMayDelete) {
      throw new AppError({ code: "FORBIDDEN", message: "Forbidden" });
    }
    enforceAdminMutationGuards(normalizedAdmin, "entry.delete.approve", {
      category,
      ownerEmail: normalizedOwner,
      entryId,
    });
    if (!id) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Entry ID is required." });
    }

    const deletedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (!existing) {
        throw new AppError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      const status = normalizeEntryStatus(existing);
      if (status !== "DELETE_REQUESTED") {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Entry is not in DELETE_REQUESTED state." });
      }

      // Log WAL event before deletion (after: null signals deletion)
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedAdmin,
          actorRole: "admin",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "APPROVE_DELETE",
          before: existing,
          after: null,
        })
      );

      // Log action history BEFORE deletion
      safeAppendHistory({
        actionType: "delete_approved",
        entryId: id,
        category,
        entryTitle: extractEntryTitle(existing as unknown as Record<string, unknown>, category),
        userEmail: normalizedOwner,
        userName: userNameFromEmail(normalizedOwner),
        adminEmail,
      });

      // Move the entry + its files into the recoverable DLC bin (instead of a
      // hard delete), then remove it from the live store. Manual-only: it stays
      // in the bin until a coordinator/master restores or permanently deletes it.
      const filePaths = collectEntryFilePaths(category, existing as unknown as Record<string, unknown>);
      await quarantineEntry({
        ownerEmail: normalizedOwner,
        category,
        entry: existing as unknown as Record<string, unknown>,
        filePaths,
        reason: FACULTY_DELETE_REASON,
        entryTitle: extractEntryTitle(existing as unknown as Record<string, unknown>, category),
      });
      await deleteEntryRaw(normalizedOwner, category, id);
      await removeEmptyUploadDir(normalizedOwner, category, id);

      // Update the user index (before = existing, after = null signals removal)
      await refreshIndexForMutation(normalizedOwner, category, existing, null);
      revalidateDashboardSummary(normalizedOwner);

      logger.info({
        event: "entry.mutation.end",
        action: "approveDelete",
        actorEmail: normalizedAdmin,
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: "BINNED",
        durationMs: Date.now() - startedAt,
      });
      logger.info({ event: "entry.admin_action", action: "approve_delete", category, entryId: id, adminEmail });

      return existing as T;
    });

    // (Files were MOVED into the bin by quarantineEntry — not deleted here.)

    // Invalidate analytics cache (via its owning module — path stays in sync
    // with where analytics actually writes) and drop the entry's feed
    // milestones so the Celebration Wall never celebrates a deleted entry.
    fireAndForget(
      (async () => {
        const { invalidateAnalyticsCache } = await import("@/lib/analytics/cache");
        await invalidateAnalyticsCache();
        const { removeFeedEvent } = await import("@/lib/feed/feedStore");
        await removeFeedEvent(`streak_started:${id}`);
        await removeFeedEvent(`streak_won:${id}`);
      })(),
      "invalidateAnalyticsCache",
    );

    await trackEntryMutationSuccess({
      action: "approveDelete",
      actorEmail: normalizedAdmin,
      role: "admin",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: "BINNED",
      fromStatus: "DELETE_REQUESTED",
      toStatus: "BINNED",
      durationMs: Date.now() - startedAt,
      source: "admin",
    });

    // Notify user
    fireAndForget(
      import("@/lib/confirmations/notificationHelpers").then(({ notifyDeleteApproved, extractEntryTitle: ext }) =>
        notifyDeleteApproved(normalizedOwner, ext(deletedEntry as unknown as Record<string, unknown>, category), category),
      ),
      "notifyDeleteApproved",
    );

    return deletedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "approveDelete",
        actorEmail: normalizedAdmin,
        role: "admin",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: null,
        fromStatus: "DELETE_REQUESTED",
        toStatus: null,
        durationMs: Date.now() - startedAt,
        source: "admin",
      },
      error
    );
    throw error;
  }
}

/**
 * Rejects a pending delete request, returning the entry from DELETE_REQUESTED
 * back to GENERATED (finalized). Clears the delete request fields.
 *
 * @param adminEmail - Email of the admin rejecting the deletion.
 * @param category - The category key the entry belongs to.
 * @param ownerEmail - Email of the entry owner.
 * @param entryId - ID of the entry whose delete request is being rejected.
 * @returns The updated entry record in GENERATED state.
 */
export async function rejectDeleteRequest<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string,
): Promise<T> {
  return runAdminMutation<T>({
    action: "cancelDeleteRequest",
    walAction: "CANCEL_DELETE_REQUEST",
    guardKey: "entry.delete.reject",
    requiredScope: "deleteApproval",
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { nowISO }) => {
      const transitioned = transitionEntry(existing, "cancelDeleteRequest", { nowISO });
      const cleared = clearTimer();
      (transitioned as Record<string, unknown>).timerPausedAt = cleared.timerPausedAt;
      (transitioned as Record<string, unknown>).timerRemainingMs = cleared.timerRemainingMs;
      // Record flow stays correctable after a rejected delete request.
      if ((existing as Record<string, unknown>).entryFlow !== "record") {
        (transitioned as Record<string, unknown>).permanentlyLocked = true;
      }
      (transitioned as Record<string, unknown>).requestActionUsed = true;
      return transitioned as EntryLike;
    },
    afterSuccess: (entry) => {
      const normalized = normalizeEmail(ownerEmail);
      safeAppendHistory({
        actionType: "delete_rejected",
        entryId: String(entry.id ?? entryId),
        category,
        entryTitle: extractEntryTitle(entry as unknown as Record<string, unknown>, category),
        userEmail: normalized,
        userName: userNameFromEmail(normalized),
        adminEmail,
      });
      fireAndForget(
        import("@/lib/confirmations/notificationHelpers").then(({ notifyDeleteRejected, extractEntryTitle: ext }) =>
          notifyDeleteRejected(normalized, ext(entry as unknown as Record<string, unknown>, category), category),
        ),
        "notifyDeleteRejected",
      );
    },
  });
}

/**
 * Archives an entry, transitioning it to the ARCHIVED state with the given reason.
 *
 * @param adminEmail - Email of the admin performing the archive.
 * @param category - The category key the entry belongs to.
 * @param ownerEmail - Email of the entry owner.
 * @param entryId - ID of the entry to archive.
 * @param reason - Archive reason; defaults to "auto_no_pdf" if not provided.
 * @returns The archived entry record.
 */
export async function archiveEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string,
  reason?: "auto_no_pdf" | "delete_approved"
): Promise<T> {
  return runAdminMutation<T>({
    action: "archiveEntry",
    walAction: "ARCHIVE",
    guardKey: "entry.archive",
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { normalizedAdmin, nowISO }) =>
      transitionEntry(existing, "archiveEntry", {
        nowISO,
        adminEmail: normalizedAdmin,
        archiveReason: reason ?? "auto_no_pdf",
      }) as EntryLike,
    successMeta: { archiveReason: reason ?? "auto_no_pdf" },
  });
}

/**
 * Restores a previously archived entry. Only entries in the ARCHIVED state can
 * be restored. The restored entry has its streak permanently removed.
 *
 * @param adminEmail - Email of the admin performing the restore.
 * @param category - The category key the entry belongs to.
 * @param ownerEmail - Email of the entry owner.
 * @param entryId - ID of the archived entry to restore.
 * @returns The restored entry record.
 */
export async function restoreEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  return runAdminMutation<T>({
    action: "restoreEntry",
    walAction: "RESTORE",
    guardKey: "entry.restore",
    adminEmail,
    category,
    ownerEmail,
    entryId,
    extraValidation: (existing) => {
      if (normalizeEntryStatus(existing) !== "ARCHIVED") {
        throw new AppError({ code: "VALIDATION_ERROR", message: "Only archived entries can be restored." });
      }
    },
    applyTransition: (existing, { normalizedAdmin, nowISO }) => {
      const transitioned = transitionEntry(existing, "restoreEntry", { nowISO, adminEmail: normalizedAdmin });
      (transitioned as Record<string, unknown>).streakPermanentlyRemoved = true;
      return transitioned as EntryLike;
    },
  });
}
