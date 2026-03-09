import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import { canManageEditRequests } from "@/lib/admin/roles";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { withUserDataLock } from "@/lib/data/locks";
import { buildEvent, type WalAction } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import { normalizeEntryStatus } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntry } from "@/lib/normalize";
import type { Entry } from "@/lib/types/entry";
import { logger } from "@/lib/logger";
import {
  type EntryEngineRecord,
  type EntryLike,
  type EntryMutationActionName,
  type WorkflowEntryLike,
  normalizeId,
  getWorkflowStatus,
  enforceAdminMutationGuards,
  enforceEntryMutationGuards,
  readEntryRaw,
  upsertEntryRaw,
  refreshIndexForMutation,
  revalidateDashboardSummary,
  appendWalEventOrThrow,
  trackEntryMutationSuccess,
  trackEntryMutationFailure,
} from "./engineHelpers.ts";

export type AdminMutationConfig = {
  action: EntryMutationActionName;
  walAction: WalAction;
  guardKey: string;
  adminEmail: string;
  category: CategoryKey;
  ownerEmail: string;
  entryId: string;
  extraValidation?: (existing: EntryEngineRecord) => void;
  applyTransition: (existing: WorkflowEntryLike, ctx: { normalizedAdmin: string; nowISO: string }) => EntryLike;
  afterSuccess?: (entry: EntryEngineRecord) => void;
  successMeta?: Record<string, string | number | boolean | null | undefined>;
};

export async function runAdminMutation<T extends EntryEngineRecord = EntryEngineRecord>(
  config: AdminMutationConfig
): Promise<T> {
  const normalizedAdmin = normalizeEmail(config.adminEmail);
  const normalizedOwner = normalizeEmail(config.ownerEmail);
  const startedAt = Date.now();
  const id = normalizeId(config.entryId);
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;

  logger.info({
    event: "entry.mutation.start",
    action: config.action,
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category: config.category,
    entryId: id,
  });

  try {
    if (!canManageEditRequests(normalizedAdmin)) {
      throw new AppError({ code: "FORBIDDEN", message: "Forbidden" });
    }
    enforceAdminMutationGuards(normalizedAdmin, config.guardKey, {
      category: config.category,
      ownerEmail: normalizedOwner,
      entryId: config.entryId,
    });
    if (!id) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Entry ID is required." });
    }
    if (!CATEGORY_KEYS.includes(config.category)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: `Unsupported category: ${config.category}` });
    }

    const resultEntry = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, config.category, id);
      if (!existing) {
        throw new AppError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      trackedFromStatus = String(normalizeEntryStatus(existing));
      config.extraValidation?.(existing);

      const nowISO = new Date().toISOString();
      const transitioned = config.applyTransition(existing as WorkflowEntryLike, { normalizedAdmin, nowISO });
      const updated = normalizeEntry(transitioned as Entry, ENTRY_SCHEMAS[config.category]) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");

      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedAdmin,
          actorRole: "admin",
          userEmail: normalizedOwner,
          category: config.category,
          entryId: id,
          action: config.walAction,
          before: existing,
          after: updated as EntryEngineRecord,
        })
      );
      await upsertEntryRaw(normalizedOwner, config.category, updated as EntryEngineRecord);
      await refreshIndexForMutation(normalizedOwner, config.category, existing, updated as EntryEngineRecord);
      revalidateDashboardSummary(normalizedOwner);

      logger.info({
        event: "entry.mutation.end",
        action: config.action,
        actorEmail: normalizedAdmin,
        userEmail: normalizedOwner,
        category: config.category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: config.action,
      actorEmail: normalizedAdmin,
      role: "admin",
      ownerEmail: normalizedOwner,
      category: config.category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "admin",
      meta: config.successMeta,
    });

    config.afterSuccess?.(resultEntry);
    return resultEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: config.action,
        actorEmail: normalizedAdmin,
        role: "admin",
        ownerEmail: normalizedOwner,
        category: config.category,
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

export type UserRequestMutationConfig = {
  action: EntryMutationActionName;
  walAction: WalAction;
  guardKey: string;
  userEmail: string;
  category: CategoryKey;
  entryId: string;
  extraValidation?: (existing: EntryLike) => void;
  applyTransition: (existing: WorkflowEntryLike, nowISO: string) => EntryLike;
  afterSuccess?: (entry: EntryEngineRecord) => void;
};

export async function runUserRequestMutation<T extends EntryEngineRecord = EntryEngineRecord>(
  config: UserRequestMutationConfig
): Promise<T> {
  const normalizedOwner = normalizeEmail(config.userEmail);
  const id = normalizeId(config.entryId);
  const startedAt = Date.now();
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;

  logger.info({
    event: "entry.mutation.start",
    action: config.action,
    userEmail: normalizedOwner,
    category: config.category,
    entryId: id,
  });

  try {
    enforceEntryMutationGuards(normalizedOwner, config.guardKey, { entryId: id });
    if (!id) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Entry ID is required." });
    }

    const updatedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existingEntry = await readEntryRaw(normalizedOwner, config.category, id);
      if (!existingEntry) {
        throw new AppError({ code: "NOT_FOUND", message: "Entry not found" });
      }
      const existing = existingEntry as EntryLike;
      trackedFromStatus = String(getWorkflowStatus(existing));
      config.extraValidation?.(existing);

      const nowISO = new Date().toISOString();
      const transitioned = config.applyTransition(existing as WorkflowEntryLike, nowISO);
      const updated = normalizeEntry(transitioned as Entry, ENTRY_SCHEMAS[config.category]) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "");

      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category: config.category,
          entryId: id,
          action: config.walAction,
          before: existing as EntryEngineRecord,
          after: updated as EntryEngineRecord,
        })
      );
      await upsertEntryRaw(normalizedOwner, config.category, updated as EntryEngineRecord);
      await refreshIndexForMutation(normalizedOwner, config.category, existing as EntryEngineRecord, updated as EntryEngineRecord);
      revalidateDashboardSummary(normalizedOwner);

      logger.info({
        event: "entry.mutation.end",
        action: config.action,
        userEmail: normalizedOwner,
        category: config.category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: config.action,
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category: config.category,
      entryId: id,
      status: trackedToStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: "manual",
    });

    config.afterSuccess?.(updatedEntry);
    return updatedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: config.action,
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category: config.category,
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
