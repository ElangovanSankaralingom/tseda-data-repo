import "server-only";

import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { AppError } from "@/lib/errors";
import { fireAndForget } from "@/lib/utils/fireAndForget";
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
 * Approves a pending delete request, transitioning the entry to ARCHIVED with
 * reason "delete_approved". Notifies the entry owner of the approval.
 *
 * @param adminEmail - Email of the admin approving the deletion.
 * @param category - The category key the entry belongs to.
 * @param ownerEmail - Email of the entry owner.
 * @param entryId - ID of the entry whose delete request is being approved.
 * @returns The updated (archived) entry record.
 */
export async function approveDelete<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  return runAdminMutation<T>({
    action: "approveDelete",
    walAction: "APPROVE_DELETE",
    guardKey: "entry.delete.approve",
    adminEmail,
    category,
    ownerEmail,
    entryId,
    applyTransition: (existing, { normalizedAdmin, nowISO }) =>
      transitionEntry(existing, "approveDelete", {
        nowISO,
        adminEmail: normalizedAdmin,
        archiveReason: "delete_approved",
      }) as EntryLike,
    afterSuccess: (entry) => {
      const normalized = normalizeEmail(ownerEmail);
      fireAndForget(
        import("@/lib/confirmations/notificationHelpers").then(({ notifyDeleteApproved, extractEntryTitle }) =>
          notifyDeleteApproved(normalized, extractEntryTitle(entry as unknown as Record<string, unknown>)),
        ),
        "notifyDeleteApproved",
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
