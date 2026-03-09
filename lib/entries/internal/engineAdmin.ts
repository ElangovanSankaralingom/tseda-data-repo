import "server-only";

import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { AppError } from "@/lib/errors";
import type { EntryEngineRecord, EntryLike, WorkflowEntryLike } from "./engineHelpers.ts";
import { runAdminMutation } from "./engineMutationRunner.ts";

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
      void import("@/lib/confirmations/notificationHelpers").then(({ notifyEditGranted, extractEntryTitle }) => {
        void notifyEditGranted(normalized, extractEntryTitle(entry as unknown as Record<string, unknown>));
      }).catch(() => {});
    },
  });
}

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
      void import("@/lib/confirmations/notificationHelpers").then(({ notifyEditRejected, extractEntryTitle }) => {
        void notifyEditRejected(normalized, extractEntryTitle(entry as unknown as Record<string, unknown>), reason?.trim());
      }).catch(() => {});
    },
  });
}

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
  });
}

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
