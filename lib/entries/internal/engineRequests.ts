import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import type { CategoryKey } from "@/lib/entries/types";
import { withUserDataLock } from "@/lib/data/locks";
import { buildEvent } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import { canRequestAction, isEntryCommitted, normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntry } from "@/lib/normalize";
import { isEntryWon } from "@/lib/streakProgress";
import type { Entry } from "@/lib/types/entry";
import { logger } from "@/lib/logger";
import {
  type EntryEngineRecord,
  type EntryLike,
  type WorkflowEntryLike,
  normalizeId,
  getWorkflowStatus,
  enforceEntryMutationGuards,
  readEntryRaw,
  upsertEntryRaw,
  refreshIndexForMutation,
  revalidateDashboardSummary,
  appendWalEventOrThrow,
  trackEntryMutationSuccess,
  trackEntryMutationFailure,
} from "./engineHelpers.ts";

export async function requestEdit<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  message?: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "requestEdit",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.edit.request.${category}`, { entryId: id });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    const updatedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existingEntry = await readEntryRaw(normalizedOwner, category, id);
      if (!existingEntry) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }

      const existing = existingEntry as EntryLike;
      trackedFromStatus = String(getWorkflowStatus(existing));

      if ((existing as Record<string, unknown>).permanentlyLocked === true) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "This entry is permanently locked and cannot be modified.",
        });
      }

      if (!isEntryCommitted(existing as WorkflowEntryLike)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry must be generated before requesting edit access.",
        });
      }

      if (!canRequestAction(existing as WorkflowEntryLike)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry is not in a state where edit can be requested, or monthly request limit reached.",
        });
      }

      const nowISO = new Date().toISOString();

      // Streak permanent removal: if entry is a Win, requesting edit permanently removes it
      const fields = ENTRY_SCHEMAS[category]?.fields ?? [];
      const wasWin = isEntryWon(existing, fields);

      const transitioned = transitionEntry(existing as WorkflowEntryLike, "requestEdit", {
        nowISO,
      });
      if (message?.trim()) {
        (transitioned as Record<string, unknown>).editRequestMessage = message.trim();
      }
      if (wasWin) {
        (transitioned as Record<string, unknown>).streakPermanentlyRemoved = true;
      }
      // Increment shared request count
      const currentCount = typeof existing.requestCount === "number" ? existing.requestCount : 0;
      (transitioned as Record<string, unknown>).requestCount = currentCount + 1;

      const updated = normalizeEntry(
        transitioned as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "REQUEST_EDIT",
          before: existing as EntryEngineRecord,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing as EntryEngineRecord,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "requestEdit",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "requestEdit",
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "manual",
    });

    // Fire-and-forget admin notification (lazy import to avoid test-time issues)
    void import("@/lib/confirmations/adminNotificationHelpers").then(({ notifyAdminEditRequest }) => {
      void import("@/lib/confirmations/notificationHelpers").then(({ extractEntryTitle }) => {
        void notifyAdminEditRequest(
          normalizedOwner,
          undefined,
          extractEntryTitle(updatedEntry as unknown as Record<string, unknown>),
          category,
          id,
        );
      });
    }).catch(() => {});

    return updatedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "requestEdit",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "manual",
      },
      error
    );
    throw error;
  }
}

export async function cancelEditRequest<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "cancelEditRequest",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.edit.cancel.${category}`, { entryId: id });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    const updatedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existingEntry = await readEntryRaw(normalizedOwner, category, id);
      if (!existingEntry) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }

      const existing = existingEntry as EntryLike;
      trackedFromStatus = String(getWorkflowStatus(existing));

      const currentStatus = normalizeEntryStatus(existing as WorkflowEntryLike);
      if (currentStatus !== "EDIT_REQUESTED") {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry is not in EDIT_REQUESTED state.",
        });
      }

      const nowISO = new Date().toISOString();
      const transitioned = transitionEntry(existing as WorkflowEntryLike, "cancelEditRequest", {
        nowISO,
      });
      const updated = normalizeEntry(
        transitioned as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "CANCEL_EDIT_REQUEST",
          before: existing as EntryEngineRecord,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing as EntryEngineRecord,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "cancelEditRequest",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "cancelEditRequest",
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "manual",
    });

    return updatedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "cancelEditRequest",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "manual",
      },
      error
    );
    throw error;
  }
}

export async function requestDelete<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  message?: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "requestDelete",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.delete.request.${category}`, { entryId: id });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    const updatedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existingEntry = await readEntryRaw(normalizedOwner, category, id);
      if (!existingEntry) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }

      const existing = existingEntry as EntryLike;
      trackedFromStatus = String(getWorkflowStatus(existing));

      if ((existing as Record<string, unknown>).permanentlyLocked === true) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "This entry is permanently locked and cannot be modified.",
        });
      }

      if (!isEntryCommitted(existing as WorkflowEntryLike)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry must be generated before requesting deletion.",
        });
      }

      if (!canRequestAction(existing as WorkflowEntryLike)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry is not in a state where delete can be requested, or monthly request limit reached.",
        });
      }

      const nowISO = new Date().toISOString();

      // Streak permanent removal: if entry is a Win, requesting delete permanently removes it
      const fields = ENTRY_SCHEMAS[category]?.fields ?? [];
      const wasWin = isEntryWon(existing, fields);

      const transitioned = transitionEntry(existing as WorkflowEntryLike, "requestDelete", {
        nowISO,
      });
      if (message?.trim()) {
        (transitioned as Record<string, unknown>).editRequestMessage = message.trim();
      }
      if (wasWin) {
        (transitioned as Record<string, unknown>).streakPermanentlyRemoved = true;
      }
      // Increment shared request count
      const currentCount = typeof existing.requestCount === "number" ? existing.requestCount : 0;
      (transitioned as Record<string, unknown>).requestCount = currentCount + 1;

      const updated = normalizeEntry(
        transitioned as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "REQUEST_DELETE",
          before: existing as EntryEngineRecord,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing as EntryEngineRecord,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "requestDelete",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "requestDelete",
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "manual",
    });

    return updatedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "requestDelete",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "manual",
      },
      error
    );
    throw error;
  }
}

export async function cancelDeleteRequest<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "cancelDeleteRequest",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.delete.cancel.${category}`, { entryId: id });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    const updatedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existingEntry = await readEntryRaw(normalizedOwner, category, id);
      if (!existingEntry) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }

      const existing = existingEntry as EntryLike;
      trackedFromStatus = String(getWorkflowStatus(existing));

      const currentStatus = normalizeEntryStatus(existing as WorkflowEntryLike);
      if (currentStatus !== "DELETE_REQUESTED") {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry is not in DELETE_REQUESTED state.",
        });
      }

      const nowISO = new Date().toISOString();
      const transitioned = transitionEntry(existing as WorkflowEntryLike, "cancelDeleteRequest", {
        nowISO,
      });
      const updated = normalizeEntry(
        transitioned as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");
      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "CANCEL_DELETE_REQUEST",
          before: existing as EntryEngineRecord,
          after: updated as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, updated as EntryEngineRecord);
      await refreshIndexForMutation(
        normalizedOwner,
        category,
        existing as EntryEngineRecord,
        updated as EntryEngineRecord
      );
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "cancelDeleteRequest",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "cancelDeleteRequest",
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "manual",
    });

    return updatedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "cancelDeleteRequest",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus ?? trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: "manual",
      },
      error
    );
    throw error;
  }
}
