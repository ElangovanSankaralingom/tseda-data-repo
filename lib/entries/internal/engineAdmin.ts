import "server-only";

import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { AppError } from "@/lib/errors";
import { fireAndForget } from "@/lib/utils/fireAndForget";
import { logger } from "@/lib/logger";
import type { EntryEngineRecord, EntryLike } from "./engineHelpers.ts";
import { runAdminMutation } from "./engineMutationRunner.ts";

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
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { normalizedAdmin, nowISO }) => {
      const transitioned = transitionEntry(existing, "grantEdit", { nowISO, adminEmail: normalizedAdmin });
      (transitioned as EntryEngineRecord).pdfStale = true;
      return transitioned as EntryLike;
    },
    afterSuccess: (entry) => {
      const normalized = normalizeEmail(ownerEmail);
      fireAndForget(
        import("@/lib/confirmations/notificationHelpers").then(({ notifyEditGranted, extractEntryTitle }) =>
          notifyEditGranted(normalized, extractEntryTitle(entry as unknown as Record<string, unknown>)),
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
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { normalizedAdmin, nowISO }) => {
      const transitioned = transitionEntry(existing, "rejectEdit", { nowISO, adminEmail: normalizedAdmin });
      if (reason?.trim()) {
        (transitioned as Record<string, unknown>).editRejectedReason = reason.trim();
      }
      return transitioned as EntryLike;
    },
    afterSuccess: (entry) => {
      const normalized = normalizeEmail(ownerEmail);
      fireAndForget(
        import("@/lib/confirmations/notificationHelpers").then(({ notifyEditRejected, extractEntryTitle }) =>
          notifyEditRejected(normalized, extractEntryTitle(entry as unknown as Record<string, unknown>), reason?.trim()),
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
  const { withUserDataLock } = await import("@/lib/data/locks");
  const { buildEvent } = await import("@/lib/data/wal");
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
    if (!canManageEditRequests(normalizedAdmin)) {
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

      // Delete the entry from the JSON store
      await deleteEntryRaw(normalizedOwner, category, id);

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
        status: "PERMANENTLY_DELETED",
        durationMs: Date.now() - startedAt,
      });

      return existing as T;
    });

    // Delete uploaded files from disk (fire-and-forget, outside the lock)
    fireAndForget(
      (async () => {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        const uploadDir = path.join(process.cwd(), "public", "uploads", normalizedOwner, category, id);
        await fs.rm(uploadDir, { recursive: true, force: true });
      })(),
      "deleteUploadFiles",
    );

    // Invalidate analytics cache
    fireAndForget(
      (async () => {
        const fs = await import("node:fs/promises");
        const path = await import("node:path");
        await fs.rm(path.join(process.cwd(), ".data", "maintenance", "analytics-cache.json"), { force: true });
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
      status: "PERMANENTLY_DELETED",
      fromStatus: "DELETE_REQUESTED",
      toStatus: "PERMANENTLY_DELETED",
      durationMs: Date.now() - startedAt,
      source: "admin",
    });

    // Notify user
    fireAndForget(
      import("@/lib/confirmations/notificationHelpers").then(({ notifyDeleteApproved, extractEntryTitle }) =>
        notifyDeleteApproved(normalizedOwner, extractEntryTitle(deletedEntry as unknown as Record<string, unknown>)),
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
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { nowISO }) =>
      transitionEntry(existing, "cancelDeleteRequest", { nowISO }) as EntryLike,
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
