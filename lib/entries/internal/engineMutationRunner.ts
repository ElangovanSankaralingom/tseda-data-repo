import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import { canManageEditRequests } from "@/lib/admin/roles";
import { canCoordinatorApproveEdit, canCoordinatorApproveDelete } from "@/lib/admin/coordinators";
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

/**
 * Post-mutation coherence (2026-07 wiring audit): whenever a mutation flips
 * an entry's STATUS, two more derived surfaces change meaning —
 *  - the analytics cache (scoring counts GENERATED only, so grant/reject/
 *    archive/restore/requests all move committed data in or out of scope);
 *  - the Department Pulse (archived entries leave the wall; restored/
 *    re-finalised entries re-assert their idempotent events).
 * Centralised HERE so no individual admin/user action can forget it.
 * Fire-and-forget: coherence must never fail the originating action.
 */
function reconcileDerivedSurfacesOnStatusChange(
  ownerEmail: string,
  category: CategoryKey,
  fromStatus: string | null,
  toStatus: string | null,
  entry: EntryEngineRecord,
): void {
  if (!fromStatus || fromStatus === toStatus) return;
  void (async () => {
    try {
      const { invalidateAnalyticsCache } = await import("@/lib/analytics/cache");
      await invalidateAnalyticsCache();
      const { reconcileEntryFeedPresence } = await import("@/lib/feed/feedEvents");
      await reconcileEntryFeedPresence(ownerEmail, category, entry as Record<string, unknown>);
    } catch (error) {
      logger.warn({
        event: "entry.mutation.reconcile_failed",
        userEmail: ownerEmail,
        category,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  })();
}

export type AdminMutationConfig = {
  action: EntryMutationActionName;
  walAction: WalAction;
  guardKey: string;
  adminEmail: string;
  category: CategoryKey;
  ownerEmail: string;
  entryId: string;
  /**
   * Authorisation scope for this action. Default ("manage") requires a global
   * approver (master/reviewer). "editApproval" ALSO permits a coordinator scoped
   * to this category — but never on their OWN entry (self-approval block, E1).
   */
  requiredScope?: "manage" | "editApproval" | "deleteApproval";
  extraValidation?: (existing: EntryEngineRecord) => void;
  applyTransition: (existing: WorkflowEntryLike, ctx: { normalizedAdmin: string; nowISO: string }) => EntryLike;
  afterSuccess?: (entry: EntryEngineRecord) => void;
  successMeta?: Record<string, string | number | boolean | null | undefined>;
};

/**
 * Executes a guarded admin mutation on a single entry. Validates admin permissions,
 * enforces rate limits, acquires a user data lock, applies the configured state
 * transition, persists the result, and logs WAL + telemetry events.
 *
 * @param config - Configuration object describing the admin mutation to perform,
 *   including the transition function, WAL action, and optional callbacks.
 * @returns The updated entry record after the mutation.
 */
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
    // Global approvers (master/reviewer) may perform any admin action. For
    // edit-approval actions, a coordinator scoped to this category may also act —
    // but NOT on their own entry (self-approval block, E1).
    const isGlobalApprover = canManageEditRequests(normalizedAdmin);
    const notOwnEntry = normalizedAdmin !== normalizedOwner;
    const coordinatorMayAct =
      notOwnEntry &&
      ((config.requiredScope === "editApproval" &&
        canCoordinatorApproveEdit(normalizedAdmin, config.category)) ||
        (config.requiredScope === "deleteApproval" &&
          canCoordinatorApproveDelete(normalizedAdmin, config.category)));
    if (!isGlobalApprover && !coordinatorMayAct) {
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

    reconcileDerivedSurfacesOnStatusChange(
      normalizedOwner,
      config.category,
      trackedFromStatus,
      trackedToStatus,
      resultEntry,
    );
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

/**
 * Executes a guarded user-initiated mutation on a single entry. Enforces rate
 * limits, acquires a user data lock, applies the configured state transition,
 * persists the result, and logs WAL + telemetry events.
 *
 * @param config - Configuration object describing the user mutation to perform,
 *   including the transition function, WAL action, and optional callbacks.
 * @returns The updated entry record after the mutation.
 */
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

    reconcileDerivedSurfacesOnStatusChange(
      normalizedOwner,
      config.category,
      trackedFromStatus,
      trackedToStatus,
      updatedEntry,
    );
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
