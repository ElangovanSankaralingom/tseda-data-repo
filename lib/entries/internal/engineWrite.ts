import "server-only";

import { randomUUID } from "node:crypto";
import { ENTRY_SCHEMAS } from "@/data/schemas";
import type { CategoryKey } from "@/lib/entries/types";
import { withUserDataLock } from "@/lib/data/locks";
import { buildEvent, inferWalUpdateAction, type WalActorRole } from "@/lib/data/wal";
import { rebuildUserIndex } from "@/lib/data/indexStore";
import { AppError, logError } from "@/lib/errors";
import { normalizeEntryStatus, transitionEntry } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntry } from "@/lib/normalize";
import { getChangedImmutableFieldsWhenPending } from "@/lib/pendingImmutability";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitOrThrow, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { validateAndSanitizeOrThrow } from "@/lib/validation/validateEntryPayload";
import { sanitizeEntryFields } from "@/lib/security/sanitize";
import { checkStreakEligibility } from "@/lib/streakProgress";
import type { Entry } from "@/lib/types/entry";
import { logger } from "@/lib/logger";
import {
  type EntryEngineRecord,
  type EntryLike,
  type WorkflowEntryLike,
  PROTECTED_UPDATE_KEYS,
  ensureRecord,
  normalizeId,
  getWalActorEmail,
  getWorkflowStatus,
  enforceEntryMutationGuards,
  readListRaw,
  writeListRaw,
  readEntryRaw,
  upsertEntryRaw,
  deleteEntryRaw,
  refreshIndexForMutation,
  revalidateDashboardSummary,
  appendWalEventOrThrow,
  appendWalEventsOrThrow,
  buildWalEventsForReplace,
  prepareEntryForWrite,
  throwPendingImmutableError,
  trackEntryMutationSuccess,
  trackEntryMutationFailure,
} from "./engineHelpers.ts";

/**
 * Replaces the entire entry list for a user and category in a single atomic
 * operation. Normalizes all entries, enforces pending-immutability constraints,
 * generates WAL events for each diff (create/update/delete), and rebuilds the
 * user index.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key whose entries are being replaced.
 * @param entries - The new complete list of entries for this category.
 * @param options - Optional actor overrides for WAL attribution.
 */
export async function replaceEntriesForCategory(
  userEmail: string,
  category: CategoryKey,
  entries: EntryEngineRecord[],
  options?: {
    actorEmail?: string;
    actorRole?: WalActorRole;
  }
) {
  const normalizedOwner = normalizeEmail(userEmail);
  const startedAt = Date.now();
  logger.info({
    event: "entry.mutation.start",
    action: "replace",
    userEmail: normalizedOwner,
    category,
    count: entries.length,
  });
  enforceRateLimitOrThrow(
    `user:${normalizedOwner}:action:entry.replace.${category}`,
    RATE_LIMIT_PRESETS.entryMutations
  );
  assertActionPayload(
    entries,
    `entry.replace.${category} payload`,
    SECURITY_LIMITS.entryPayloadMaxBytes * 5
  );
  const actorEmail = getWalActorEmail(options?.actorEmail ?? normalizedOwner, normalizedOwner);
  const actorRole = options?.actorRole ?? "user";
  await withUserDataLock(normalizedOwner, async () => {
    const currentList = await readListRaw(normalizedOwner, category);
    const normalizedEntries = entries.map((entry) =>
      normalizeEntry(entry as Entry, ENTRY_SCHEMAS[category]) as EntryEngineRecord
    );
    const beforeById = new Map<string, EntryEngineRecord>();
    for (const currentEntry of currentList) {
      const currentId = normalizeId(currentEntry.id);
      if (!currentId) continue;
      beforeById.set(currentId, currentEntry);
    }
    for (const nextEntry of normalizedEntries) {
      const nextId = normalizeId(nextEntry.id);
      if (!nextId) continue;
      const beforeEntry = beforeById.get(nextId);
      if (!beforeEntry) continue;

      const changedFields = getChangedImmutableFieldsWhenPending(
        category,
        beforeEntry as EntryLike,
        nextEntry as EntryLike
      );
      if (changedFields.length > 0) {
        throwPendingImmutableError(changedFields);
      }
    }
    const walEvents = buildWalEventsForReplace(
      actorEmail,
      actorRole,
      normalizedOwner,
      category,
      currentList,
      normalizedEntries
    );
    await appendWalEventsOrThrow(normalizedOwner, walEvents);

    await writeListRaw(normalizedOwner, category, normalizedEntries);
    const rebuildResult = await rebuildUserIndex(normalizedOwner);
    if (!rebuildResult.ok) {
      logError(rebuildResult.error, "entryEngine.replaceEntriesForCategory.rebuildUserIndex");
    }
    revalidateDashboardSummary(normalizedOwner);
    logger.info({
      event: "entry.mutation.end",
      action: "replace",
      userEmail: normalizedOwner,
      category,
      count: normalizedEntries.length,
      durationMs: Date.now() - startedAt,
    });
  });
}

/**
 * Creates a new entry for the given user and category. Validates and sanitizes
 * the payload, generates a UUID if none is provided, applies the initial workflow
 * transition, and persists the entry at the start of the list.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key for the new entry.
 * @param payload - The entry data to create.
 * @returns The newly created entry record.
 */
export async function createEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  payload: EntryEngineRecord
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const startedAt = Date.now();
  const rawPayload = ensureRecord(payload);
  let trackedEntryId: string | null = normalizeId(rawPayload.id) || null;
  let trackedStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "create",
    userEmail: normalizedOwner,
    category,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.create.${category}`, rawPayload);
    const sanitizedPayload = sanitizeEntryFields(rawPayload);
    const nextPayload = validateAndSanitizeOrThrow(category, sanitizedPayload, "create");
    const created = await withUserDataLock(normalizedOwner, async () => {
      const nowISO = new Date().toISOString();
      const id = normalizeId(nextPayload.id) || randomUUID();
      trackedEntryId = id;
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (existing) {
        throw new Error("Entry already exists");
      }

      const base: EntryLike = {
        ...nextPayload,
        id,
        ...(typeof nextPayload.status === "string" && nextPayload.status.trim()
          ? { status: nextPayload.status }
          : {}),
        createdAt:
          typeof nextPayload.createdAt === "string" && nextPayload.createdAt
            ? nextPayload.createdAt
            : nowISO,
        updatedAt: nowISO,
      };
      const entry = normalizeEntry(
        transitionEntry(base as WorkflowEntryLike, "createEntry", { nowISO }) as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedStatus = String(entry.confirmationStatus ?? "");

      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "CREATE",
          before: null,
          after: entry as EntryEngineRecord,
        })
      );

      await upsertEntryRaw(normalizedOwner, category, entry as EntryEngineRecord, {
        insertPosition: "start",
      });
      await refreshIndexForMutation(normalizedOwner, category, null, entry as EntryEngineRecord);
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "create",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(entry.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return entry as T;
    });

    await trackEntryMutationSuccess({
      action: "create",
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category,
      entryId: trackedEntryId,
      status: trackedStatus,
      durationMs: Date.now() - startedAt,
      source: "manual",
    });
    return created;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "create",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: trackedEntryId,
        status: trackedStatus,
        durationMs: Date.now() - startedAt,
        source: "manual",
      },
      error
    );
    throw error;
  }
}

/**
 * Updates an existing entry with new field values. Protected workflow fields are
 * excluded from the merge. Validates pending-immutability constraints, recalculates
 * streak eligibility when the end date changes, and logs a WAL event.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key the entry belongs to.
 * @param entryId - ID of the entry to update.
 * @param payload - The partial entry data to merge.
 * @returns The updated entry record.
 */
export async function updateEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  payload: EntryEngineRecord
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const startedAt = Date.now();
  const rawPayload = ensureRecord(payload);
  const trackedSource =
    String(rawPayload.source ?? "").trim().toLowerCase() === "autosave"
      ? "autosave"
      : "manual";
  let trackedStatus: string | null = null;
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "update",
    userEmail: normalizedOwner,
    category,
    entryId: normalizeId(entryId),
  });
  const id = normalizeId(entryId);
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.update.${category}`, rawPayload);
    const sanitizedPayload = sanitizeEntryFields(rawPayload);
    const nextPayload = validateAndSanitizeOrThrow(category, sanitizedPayload, "update");

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

      const nowISO = new Date().toISOString();
      const existing = existingEntry as EntryLike;
      const next: EntryLike = {
        ...existing,
      };
      trackedFromStatus = String(getWorkflowStatus(existing));

      for (const [key, value] of Object.entries(nextPayload)) {
        if (PROTECTED_UPDATE_KEYS.has(key)) continue;
        next[key] = value;
      }

      // Streak: end date changed to past → immediately remove from Activated
      const existingEndDate = String(existing.endDate ?? "").trim();
      const nextEndDate = String(next.endDate ?? "").trim();
      if (
        nextEndDate !== existingEndDate &&
        next.streakEligible === true &&
        !checkStreakEligibility(next as Record<string, unknown>)
      ) {
        next.streakEligible = false;
      }

      next.id = id;
      next.createdAt =
        typeof existing.createdAt === "string" && existing.createdAt.trim()
          ? existing.createdAt
          : nowISO;
      next.updatedAt = nowISO;
      next.confirmationStatus = getWorkflowStatus(existing);
      const updated = prepareEntryForWrite(next, nowISO, category);
      const changedImmutableFields = getChangedImmutableFieldsWhenPending(category, existing, updated);
      if (changedImmutableFields.length > 0) {
        throwPendingImmutableError(changedImmutableFields);
      }
      trackedToStatus = String(updated.confirmationStatus ?? "");
      trackedStatus = trackedToStatus;

      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: inferWalUpdateAction(existing as EntryEngineRecord, updated as EntryEngineRecord),
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
        action: "update",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "update",
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedStatus,
      fromStatus: trackedFromStatus,
      toStatus: trackedToStatus,
      durationMs: Date.now() - startedAt,
      source: trackedSource,
    });
    return updatedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "update",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedStatus,
        fromStatus: trackedFromStatus,
        toStatus: trackedToStatus,
        durationMs: Date.now() - startedAt,
        source: trackedSource,
      },
      error
    );
    throw error;
  }
}

/**
 * Deletes an entry from the user's category store. Logs a WAL DELETE event,
 * removes the entry from storage, and refreshes the user index. Returns the
 * deleted entry record, or `null` if the entry did not exist.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key the entry belongs to.
 * @param entryId - ID of the entry to delete.
 * @returns The deleted entry record, or `null` if not found.
 */
export async function deleteEntry(
  userEmail: string,
  category: CategoryKey,
  entryId: string
) {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  let trackedFromStatus: string | null = null;
  let deleted = false;
  logger.info({
    event: "entry.mutation.start",
    action: "delete",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.delete.${category}`, { entryId: id });
    if (!id) {
      throw new Error("Entry ID is required");
    }
    const existingEntry = await withUserDataLock(normalizedOwner, async () => {
      const existing = await readEntryRaw(normalizedOwner, category, id);
      if (!existing) {
        return null;
      }
      trackedFromStatus = String(normalizeEntryStatus(existing));

      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "DELETE",
          before: existing,
          after: null,
        })
      );

      await deleteEntryRaw(normalizedOwner, category, id);
      await refreshIndexForMutation(normalizedOwner, category, existing, null);
      revalidateDashboardSummary(normalizedOwner);
      logger.info({
        event: "entry.mutation.end",
        action: "delete",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        durationMs: Date.now() - startedAt,
      });
      deleted = true;
      return existing;
    });

    await trackEntryMutationSuccess({
      action: "delete",
      actorEmail: normalizedOwner,
      role: "user",
      ownerEmail: normalizedOwner,
      category,
      entryId: id,
      status: trackedFromStatus,
      fromStatus: trackedFromStatus,
      toStatus: null,
      durationMs: Date.now() - startedAt,
      source: "manual",
      meta: { deleted },
    });
    return existingEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "delete",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedFromStatus,
        fromStatus: trackedFromStatus,
        toStatus: null,
        durationMs: Date.now() - startedAt,
        source: "manual",
      },
      error
    );
    throw error;
  }
}
