import "server-only";

import { ENTRY_SCHEMAS } from "@/data/schemas";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { withUserDataLock } from "@/lib/data/locks";
import { buildEvent, inferWalUpdateAction } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import { computeEditWindowExpiry, isEntryEditable, normalizeEntryStatus } from "@/lib/entries/workflow";
import { computeFieldProgress } from "@/lib/entries/fieldProgress";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntry } from "@/lib/normalize";
import { checkStreakEligibility } from "@/lib/streakProgress";
import { getEditWindowDays, getStreakBufferDays } from "@/lib/settings/consumer";
import { validateAndSanitizeOrThrow } from "@/lib/validation/validateEntryPayload";
import type { Entry } from "@/lib/types/entry";
import { logger } from "@/lib/logger";
import {
  type EntryEngineRecord,
  type EntryLike,
  type WorkflowEntryLike,
  ensureRecord,
  normalizeId,
  getWorkflowStatus,
  enforceEntryMutationGuards,
  readEntryRaw,
  upsertEntryRaw,
  refreshIndexForMutation,
  revalidateDashboardSummary,
  appendWalEventOrThrow,
  prepareEntryForWrite,
  trackEntryMutationSuccess,
  trackEntryMutationFailure,
} from "./engineHelpers.ts";

export async function commitDraft<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  extraFields?: Record<string, unknown>,
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  let trackedFromStatus: string | null = null;
  let trackedToStatus: string | null = null;
  logger.info({
    event: "entry.mutation.start",
    action: "commitDraft",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.commit.${category}`, { entryId: id });
    if (!id) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Entry ID is required.",
      });
    }
    const committed = await withUserDataLock(normalizedOwner, async () => {
      const existingEntry = await readEntryRaw(normalizedOwner, category, id);
      if (!existingEntry) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }

      const existing = validateAndSanitizeOrThrow(
        category,
        ensureRecord(existingEntry),
        "commit"
      ) as EntryLike;
      trackedFromStatus = String(getWorkflowStatus(existing));

      const nowISO = new Date().toISOString();
      const streakEligible = checkStreakEligibility(existing);
      const [editWindowDays, streakBufferDays] = await Promise.all([
        getEditWindowDays(),
        getStreakBufferDays(),
      ]);
      const editWindowExpiresAt = computeEditWindowExpiry(nowISO, {
        endDate: existing.endDate,
        streakEligible,
      }, { editWindowDays, streakBufferDays });
      const updated = prepareEntryForWrite(
        {
          ...existing,
          ...(extraFields ?? {}),
          committedAtISO: nowISO,
          streakEligible,
          confirmationStatus: "GENERATED" as const,
          editWindowExpiresAt,
        },
        nowISO,
        category
      );
      trackedToStatus = String(updated.confirmationStatus ?? "");

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
        action: "commitDraft",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: String(updated.confirmationStatus ?? ""),
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "commitDraft",
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
    return committed;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "commitDraft",
        actorEmail: normalizedOwner,
        role: "user",
        ownerEmail: normalizedOwner,
        category,
        entryId: id || null,
        status: trackedToStatus,
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

export async function finalizeEntry<T extends EntryEngineRecord = EntryEngineRecord>(
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
    action: "finalize",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  try {
    enforceEntryMutationGuards(normalizedOwner, `entry.finalize.${category}`, { entryId: id });
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
    const finalizedEntry = await withUserDataLock(normalizedOwner, async () => {
      const existingEntry = await readEntryRaw(normalizedOwner, category, id);
      if (!existingEntry) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "Entry not found",
        });
      }

      const existing = existingEntry as EntryLike;
      trackedFromStatus = String(getWorkflowStatus(existing));

      // Must be GENERATED and currently editable
      const currentStatus = normalizeEntryStatus(existing as WorkflowEntryLike);
      if (currentStatus !== "GENERATED" && currentStatus !== "EDIT_GRANTED") {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Only generated entries can be finalised.",
        });
      }
      if (!isEntryEditable(existing as WorkflowEntryLike)) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Entry is already finalised.",
        });
      }

      // All data fields must be complete
      const progress = computeFieldProgress(category, existing as Record<string, unknown>);
      if (progress.total > 0 && progress.completed < progress.total) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "All fields must be complete before finalising.",
        });
      }

      // All upload fields must be present
      const uploadFields = (ENTRY_SCHEMAS[category]?.fields ?? []).filter((f) => f.upload);
      for (const field of uploadFields) {
        const value = (existing as Record<string, unknown>)[field.key];
        if (field.kind === "array") {
          if (!Array.isArray(value) || value.length === 0) {
            throw new AppError({
              code: "VALIDATION_ERROR",
              message: `Upload required: ${field.label}.`,
            });
          }
        } else if (field.kind === "object" && value && typeof value === "object" && !("url" in (value as Record<string, unknown>)) && !("storedPath" in (value as Record<string, unknown>))) {
          const nested = value as Record<string, unknown>;
          for (const [subKey, subVal] of Object.entries(nested)) {
            if (Array.isArray(subVal)) {
              if (subVal.length === 0) {
                throw new AppError({
                  code: "VALIDATION_ERROR",
                  message: `Upload required: ${subKey}.`,
                });
              }
            } else if (!subVal) {
              throw new AppError({
                code: "VALIDATION_ERROR",
                message: `Upload required: ${subKey}.`,
              });
            }
          }
        } else if (!value) {
          throw new AppError({
            code: "VALIDATION_ERROR",
            message: `Upload required: ${field.label}.`,
          });
        }
      }

      // PDF must have been generated
      if (existing.pdfGenerated !== true && !existing.pdfGeneratedAt) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "PDF must be generated before finalising.",
        });
      }


      // Finalise by expiring the edit window now
      const nowISO = new Date().toISOString();
      const isRefinalization = trackedFromStatus === "EDIT_GRANTED";
      const updated = normalizeEntry(
        {
          ...existing,
          editWindowExpiresAt: nowISO,
          confirmationStatus: "GENERATED" as const,
          updatedAt: nowISO,
          ...(isRefinalization ? { permanentlyLocked: true } : {}),
        } as Entry,
        ENTRY_SCHEMAS[category]
      ) as EntryLike;
      trackedToStatus = String(updated.confirmationStatus ?? "GENERATED");

      await appendWalEventOrThrow(
        normalizedOwner,
        buildEvent({
          actorEmail: normalizedOwner,
          actorRole: "user",
          userEmail: normalizedOwner,
          category,
          entryId: id,
          action: "FINALIZE",
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
        action: "finalize",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        status: trackedToStatus,
        durationMs: Date.now() - startedAt,
      });
      return updated as T;
    });

    await trackEntryMutationSuccess({
      action: "finalize",
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
      meta: { trigger: "manual" },
    });

    return finalizedEntry;
  } catch (error) {
    await trackEntryMutationFailure(
      {
        action: "finalize",
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
