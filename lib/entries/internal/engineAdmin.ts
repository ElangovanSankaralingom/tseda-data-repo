import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import { canManageEditRequests } from "@/lib/admin/roles";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { withUserDataLock } from "@/lib/data/locks";
import { buildEvent } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import { normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntry } from "@/lib/normalize";
import type { Entry } from "@/lib/types/entry";
import { logger } from "@/lib/logger";
import {
  type EntryEngineRecord,
  type EntryLike,
  type WorkflowEntryLike,
  normalizeId,
  enforceAdminMutationGuards,
  readEntryRaw,
  upsertEntryRaw,
  refreshIndexForMutation,
  revalidateDashboardSummary,
  appendWalEventOrThrow,
  trackEntryMutationSuccess,
  trackEntryMutationFailure,
} from "./engineHelpers.ts";

export async function grantEditAccess<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const startedAt = Date.now();
  const id = normalizeId(entryId);
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "grantEdit",
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    if (!canManageEditRequests(normalizedAdmin)) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    enforceAdminMutationGuards(normalizedAdmin, "entry.edit.grant", {
      category,
      ownerEmail: normalizedOwner,
      entryId,
    });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    if (!CATEGORY_KEYS.includes(category)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `Unsupported category: ${category}`,
      });
    }
    const grantedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (!existing) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }
      trackedFromStatus = String(normalizeEntryStatus(existing));

      const nowISO = new Date().toISOString();
      const updated = normalizeEntry(
        transitionEntry(existing as WorkflowEntryLike, "grantEdit", {
          nowISO,
          adminEmail: normalizedAdmin,
        }) as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      // Force PDF regeneration — user must re-generate after edits before re-finalising
      (updated as EntryEngineRecord).pdfStale = true;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedAdmin,
          actorRole: "admin",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "GRANT_EDIT",
          before: existing,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "grantEdit",
        actorEmail: normalizedAdmin,
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "grantEdit",
      actorEmail: normalizedAdmin,
      role: "admin",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "admin",
    });

    // Fire-and-forget notification to entry owner (lazy import to avoid test-time issues)
    void import("@/lib/confirmations/notificationHelpers").then(({ notifyEditGranted, extractEntryTitle }) => {
      void notifyEditGranted(
        normalizedOwner,
        extractEntryTitle(grantedEntry as unknown as Record<string, unknown>),
      );
    }).catch(() => {});

    return grantedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "grantEdit",
        actorEmail: normalizedAdmin,
        role: "admin",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "admin",
      },
      error
    );
    throw error;
  }
}

export async function rejectEditRequest<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string,
  reason?: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const startedAt = Date.now();
  const id = normalizeId(entryId);
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "rejectEdit",
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    if (!canManageEditRequests(normalizedAdmin)) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    enforceAdminMutationGuards(normalizedAdmin, "entry.edit.reject", {
      category,
      ownerEmail: normalizedOwner,
      entryId,
    });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    if (!CATEGORY_KEYS.includes(category)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `Unsupported category: ${category}`,
      });
    }
    const rejectedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (!existing) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }
      trackedFromStatus = String(normalizeEntryStatus(existing));

      const nowISO = new Date().toISOString();
      const transitioned = transitionEntry(existing as WorkflowEntryLike, "rejectEdit", {
        nowISO,
        adminEmail: normalizedAdmin,
      });
      if (reason?.trim()) {
        (transitioned as Record<string, unknown>).editRejectedReason = reason.trim();
      }
      const updated = normalizeEntry(
        transitioned as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedAdmin,
          actorRole: "admin",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "REJECT_EDIT",
          before: existing,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "rejectEdit",
        actorEmail: normalizedAdmin,
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "rejectEdit",
      actorEmail: normalizedAdmin,
      role: "admin",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "admin",
    });

    // Fire-and-forget notification to entry owner
    void import("@/lib/confirmations/notificationHelpers").then(({ notifyEditRejected, extractEntryTitle }) => {
      void notifyEditRejected(
        normalizedOwner,
        extractEntryTitle(rejectedEntry as unknown as Record<string, unknown>),
        reason?.trim(),
      );
    }).catch(() => {});

    return rejectedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "rejectEdit",
        actorEmail: normalizedAdmin,
        role: "admin",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "admin",
      },
      error
    );
    throw error;
  }
}

export async function approveDelete<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const startedAt = Date.now();
  const id = normalizeId(entryId);
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
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
      throw new AppError({
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    enforceAdminMutationGuards(normalizedAdmin, "entry.delete.approve", {
      category,
      ownerEmail: normalizedOwner,
      entryId,
    });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    if (!CATEGORY_KEYS.includes(category)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `Unsupported category: ${category}`,
      });
    }
    const archivedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (!existing) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }
      trackedFromStatus = String(normalizeEntryStatus(existing));

      const nowISO = new Date().toISOString();
      const updated = normalizeEntry(
        transitionEntry(existing as WorkflowEntryLike, "approveDelete", {
          nowISO,
          adminEmail: normalizedAdmin,
          archiveReason: "delete_approved",
        }) as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
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
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "approveDelete",
        actorEmail: normalizedAdmin,
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "approveDelete",
      actorEmail: normalizedAdmin,
      role: "admin",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "admin",
    });

    return archivedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "approveDelete",
        actorEmail: normalizedAdmin,
        role: "admin",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "admin",
      },
      error
    );
    throw error;
  }
}

export async function archiveEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string,
  reason?: "auto_no_pdf" | "delete_approved"
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const startedAt = Date.now();
  const id = normalizeId(entryId);
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "archiveEntry",
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    if (!canManageEditRequests(normalizedAdmin)) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    enforceAdminMutationGuards(normalizedAdmin, "entry.archive", {
      category,
      ownerEmail: normalizedOwner,
      entryId,
    });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    if (!CATEGORY_KEYS.includes(category)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `Unsupported category: ${category}`,
      });
    }
    const archivedEntryResult = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (!existing) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }
      trackedFromStatus = String(normalizeEntryStatus(existing));

      const nowISO = new Date().toISOString();
      const updated = normalizeEntry(
        transitionEntry(existing as WorkflowEntryLike, "archiveEntry", {
          nowISO,
          adminEmail: normalizedAdmin,
          archiveReason: reason ?? "auto_no_pdf",
        }) as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedAdmin,
          actorRole: "admin",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "ARCHIVE",
          before: existing,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "archiveEntry",
        actorEmail: normalizedAdmin,
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "archiveEntry",
      actorEmail: normalizedAdmin,
      role: "admin",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "admin",
      meta: { archiveReason: reason ?? "auto_no_pdf" },
    });

    return archivedEntryResult;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "archiveEntry",
        actorEmail: normalizedAdmin,
        role: "admin",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "admin",
      },
      error
    );
    throw error;
  }
}

export async function restoreEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const startedAt = Date.now();
  const id = normalizeId(entryId);
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "restoreEntry",
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    if (!canManageEditRequests(normalizedAdmin)) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Forbidden",
      });
    }

    enforceAdminMutationGuards(normalizedAdmin, "entry.restore", {
      category,
      ownerEmail: normalizedOwner,
      entryId,
    });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    if (!CATEGORY_KEYS.includes(category)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `Unsupported category: ${category}`,
      });
    }
    const restoredEntry = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (!existing) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }
      trackedFromStatus = String(normalizeEntryStatus(existing));

      if (normalizeEntryStatus(existing) !== "ARCHIVED") {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Only archived entries can be restored.",
        });
      }

      const nowISO = new Date().toISOString();
      const transitioned = transitionEntry(existing as WorkflowEntryLike, "restoreEntry", {
        nowISO,
        adminEmail: normalizedAdmin,
      });
      // Restored entries are permanently out of streaks
      (transitioned as Record<string, unknown>).streakPermanentlyRemoved = true;

      const updated = normalizeEntry(
        transitioned as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedAdmin,
          actorRole: "admin",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "RESTORE",
          before: existing,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "restoreEntry",
        actorEmail: normalizedAdmin,
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "restoreEntry",
      actorEmail: normalizedAdmin,
      role: "admin",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "admin",
    });

    return restoredEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "restoreEntry",
        actorEmail: normalizedAdmin,
        role: "admin",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "admin",
      },
      error
    );
    throw error;
  }
}
