import "server-only";

/**
 * Internal implementation for persisted entry lifecycle operations.
 *
 * Ownership:
 * - persistence/orchestration lives here
 * - canonical workflow rules live in `workflow.ts`
 * - public callers should generally import server-side operations from
 *   `lifecycle.ts`, not this file directly
 */
import { randomUUID } from "node:crypto";
import { ENTRY_SCHEMAS } from "@/data/schemas";
import { canManageEditRequests } from "@/lib/admin/roles";
import { CATEGORY_KEYS } from "@/lib/categories";
import { rebuildUserIndex, updateIndexForEntryMutation } from "@/lib/data/indexStore";
import { withUserDataLock } from "@/lib/data/locks";
import {
  deleteCategoryEntry as deleteCategoryEntryInStore,
  readCategoryEntries,
  readCategoryEntryById,
  upsertCategoryEntry as upsertCategoryEntryInStore,
  writeCategoryEntries,
} from "@/lib/dataStore";
import {
  appendEvent,
  appendEvents,
  buildEvent,
  inferWalUpdateAction,
  type WalActorRole,
} from "@/lib/data/wal";
import { getDashboardTag } from "@/lib/dashboard/tags";
import type { CategoryKey } from "@/lib/entries/types";
import { computeFieldProgress } from "@/lib/entries/fieldProgress";
import { AppError, logError, normalizeError } from "@/lib/errors";
import {
  canRequestAction,
  computeEditWindowExpiry,
  isEntryCommitted,
  isEntryEditable,
  isEntryFinalized,
  isEntryLocked,
  normalizeEntryStatus,
  transitionEntry,
  type EntryStateLike,
} from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntryStreakFields } from "@/lib/entries/postSave";
import { normalizeEntry } from "@/lib/normalize";
import { getChangedImmutableFieldsWhenPending } from "@/lib/pendingImmutability";
import { assertActionPayload, assertEntryMutationInput, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitOrThrow, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import {
  checkStreakEligibility,
  computeCanonicalStreakSnapshot,
  isEntryWon,
  type StreakProgressAggregateEntry,
} from "@/lib/streakProgress";
import { getEditWindowDays, getStreakBufferDays } from "@/lib/settings/consumer";
import { trackEvent } from "@/lib/telemetry/telemetry";
import { validateAndSanitizeOrThrow } from "@/lib/validation/validateEntryPayload";
import type { Entry, EntryStatus as EntryWorkflowStatus } from "@/lib/types/entry";
import { logger, withTimer } from "@/lib/logger";

export type EntryEngineRecord = Entry;

export type EntryStreakSummary = {
  activated: number;
  wins: number;
  byCategory: Record<CategoryKey, { activated: number; wins: number }>;
};

type EntryLike = EntryEngineRecord & {
  id?: unknown;
  status?: unknown;
  requestEditStatus?: unknown;
  confirmationStatus?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  sentForConfirmationAtISO?: unknown;
  requestEditRequestedAtISO?: unknown;
  confirmedAtISO?: unknown;
  confirmedBy?: unknown;
  confirmationRejectedReason?: unknown;
};
type WorkflowEntryLike = EntryLike & EntryStateLike;

function getWorkflowStatus(entry: EntryLike): EntryWorkflowStatus {
  return normalizeEntryStatus(entry);
}

function ensureRecord(value: unknown): EntryEngineRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as EntryEngineRecord;
}

const PROTECTED_UPDATE_KEYS = new Set([
  "id",
  "createdAt",
  "status",
  "confirmationStatus",
  "committedAtISO",
  "generatedAt",
  "editWindowExpiresAt",
  "editRequestedAt",
  "editRequestMessage",
  "editGrantedAt",
  "editGrantedBy",
  "editGrantedDays",
  "editRejectedReason",
  "deleteRequestedAt",
  "requestType",
  "requestCount",
  "requestCountResetAt",
  "archivedAt",
  "archiveReason",
  "streakPermanentlyRemoved",
  // Legacy fields (kept for migration safety)
  "sentForConfirmationAtISO",
  "confirmedAtISO",
  "confirmedBy",
  "confirmationRejectedReason",
]);

function revalidateDashboardSummary(userEmail: string) {
  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) return;
  if (process.env.NODE_ENV === "test") return;
  const dashboardTag = getDashboardTag(normalizedEmail);
  void import("next/cache.js")
    .then((module) => {
      if (typeof module.revalidateTag === "function") {
        module.revalidateTag(dashboardTag, "max");
      }
    })
    .catch((error) => {
      logError(error, "entryEngine.revalidateDashboardSummary");
    });
}

async function readListRaw(
  userEmail: string,
  category: CategoryKey
): Promise<EntryEngineRecord[]> {
  return readCategoryEntries(userEmail, category);
}

async function writeListRaw(
  userEmail: string,
  category: CategoryKey,
  list: EntryEngineRecord[]
) {
  await writeCategoryEntries(userEmail, category, list);
}

async function readEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return readCategoryEntryById(userEmail, category, entryId);
}

async function upsertEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entry: EntryEngineRecord,
  options?: { insertPosition?: "start" | "end" }
): Promise<EntryEngineRecord> {
  return upsertCategoryEntryInStore(userEmail, category, entry, options);
}

async function deleteEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return deleteCategoryEntryInStore(userEmail, category, entryId);
}

async function refreshIndexForMutation(
  userEmail: string,
  category: CategoryKey,
  beforeEntry: EntryEngineRecord | null,
  afterEntry: EntryEngineRecord | null
) {
  const startedAt = Date.now();
  const indexResult = await updateIndexForEntryMutation(userEmail, category, beforeEntry, afterEntry);
  if (indexResult.ok) {
    logger.debug({
      event: "entry.index.refresh.success",
      userEmail,
      category,
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  logError(indexResult.error, "entryEngine.refreshIndexForMutation");
  const rebuildResult = await rebuildUserIndex(userEmail);
  if (!rebuildResult.ok) {
    logError(rebuildResult.error, "entryEngine.rebuildUserIndex");
    logger.error({
      event: "entry.index.refresh.rebuild-failed",
      userEmail,
      category,
      errorCode: rebuildResult.error.code,
      durationMs: Date.now() - startedAt,
    });
    return;
  }
  logger.warn({
    event: "entry.index.refresh.rebuilt",
    userEmail,
    category,
    durationMs: Date.now() - startedAt,
  });
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function getWalActorEmail(value: string, fallbackEmail: string) {
  const normalized = normalizeEmail(value);
  return normalized || fallbackEmail;
}

function enforceEntryMutationGuards(
  userEmail: string,
  action: string,
  payload?: unknown
) {
  const normalizedEmail = normalizeEmail(userEmail);
  enforceRateLimitOrThrow(
    `user:${normalizedEmail}:action:${action}`,
    RATE_LIMIT_PRESETS.entryMutations
  );
  if (payload !== undefined) {
    assertEntryMutationInput(payload, `${action} payload`);
  }
}

function enforceAdminMutationGuards(
  adminEmail: string,
  action: string,
  payload?: unknown
) {
  const normalizedEmail = normalizeEmail(adminEmail);
  enforceRateLimitOrThrow(
    `user:${normalizedEmail}:action:${action}`,
    RATE_LIMIT_PRESETS.adminOps
  );
  if (payload !== undefined) {
    assertActionPayload(payload, `${action} payload`, SECURITY_LIMITS.actionPayloadMaxBytes);
  }
}

const ENTRY_MUTATION_EVENT_BY_ACTION = {
  create: "entry.create",
  update: "entry.update",
  delete: "entry.delete",
  commitDraft: "entry.commit_draft",
  requestEdit: "entry.request_edit",
  grantEdit: "entry.grant_edit",
  cancelEditRequest: "entry.cancel_edit_request",
  rejectEdit: "entry.reject_edit",
  finalize: "entry.finalize",
  requestDelete: "entry.request_delete",
  cancelDeleteRequest: "entry.cancel_delete_request",
  approveDelete: "entry.approve_delete",
  archiveEntry: "entry.archive",
  restoreEntry: "entry.restore",
} as const;

type EntryMutationActionName = keyof typeof ENTRY_MUTATION_EVENT_BY_ACTION;

type EntryMutationTelemetryContext = {
  action: EntryMutationActionName;
  actorEmail: string;
  role: "user" | "admin";
  ownerEmail: string;
  category: CategoryKey;
  entryId: string | null;
  durationMs: number;
  status?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  source?: "manual" | "autosave" | "admin" | "upload";
  meta?: Record<string, string | number | boolean | null | undefined>;
};

async function trackTelemetrySafe(
  payload: {
    event: (typeof ENTRY_MUTATION_EVENT_BY_ACTION)[EntryMutationActionName] | "action.failure" | "validation.failure" | "rate_limit.hit" | "payload.too_large";
    actorEmail: string;
    role: "user" | "admin";
    category?: CategoryKey | null;
    entryId?: string | null;
    status?: string | null;
    success?: boolean;
    durationMs?: number | null;
    meta?: Record<string, string | number | boolean | null | undefined>;
  }
) {
  const tracked = await trackEvent({
    event: payload.event,
    actorEmail: payload.actorEmail,
    role: payload.role,
    category: payload.category ?? null,
    entryId: payload.entryId ?? null,
    status: payload.status ?? null,
    success: payload.success,
    durationMs: payload.durationMs ?? null,
    meta: payload.meta,
  });
  if (!tracked.ok) {
    logger.warn({
      event: "telemetry.track.failed",
      actorEmail: payload.actorEmail,
      category: payload.category ?? undefined,
      entryId: payload.entryId ?? undefined,
      errorCode: tracked.error.code,
    });
  }
}

async function trackEntryMutationSuccess(context: EntryMutationTelemetryContext) {
  await trackTelemetrySafe({
    event: ENTRY_MUTATION_EVENT_BY_ACTION[context.action],
    actorEmail: context.actorEmail,
    role: context.role,
    category: context.category,
    entryId: context.entryId,
    status: context.status ?? context.toStatus ?? null,
    success: true,
    durationMs: context.durationMs,
    meta: {
      action: context.action,
      source: context.source ?? (context.role === "admin" ? "admin" : "manual"),
      fromStatus: context.fromStatus ?? null,
      toStatus: context.toStatus ?? context.status ?? null,
      ownerEmail: context.ownerEmail,
      ...context.meta,
    },
  });
}

async function trackEntryMutationFailure(
  context: EntryMutationTelemetryContext,
  error: unknown
) {
  const normalized = normalizeError(error);
  const baseMeta = {
    action: context.action,
    source: context.source ?? (context.role === "admin" ? "admin" : "manual"),
    errorCode: normalized.code,
    ownerEmail: context.ownerEmail,
    fromStatus: context.fromStatus ?? null,
    toStatus: context.toStatus ?? null,
    ...context.meta,
  };

  await trackTelemetrySafe({
    event: "action.failure",
    actorEmail: context.actorEmail,
    role: context.role,
    category: context.category,
    entryId: context.entryId,
    status: context.status ?? context.fromStatus ?? null,
    success: false,
    durationMs: context.durationMs,
    meta: baseMeta,
  });

  if (normalized.code === "VALIDATION_ERROR") {
    await trackTelemetrySafe({
      event: "validation.failure",
      actorEmail: context.actorEmail,
      role: context.role,
      category: context.category,
      entryId: context.entryId,
      success: false,
      durationMs: context.durationMs,
      meta: baseMeta,
    });
  }
  if (normalized.code === "RATE_LIMITED") {
    await trackTelemetrySafe({
      event: "rate_limit.hit",
      actorEmail: context.actorEmail,
      role: context.role,
      category: context.category,
      entryId: context.entryId,
      success: false,
      durationMs: context.durationMs,
      meta: baseMeta,
    });
  }
  if (normalized.code === "PAYLOAD_TOO_LARGE") {
    await trackTelemetrySafe({
      event: "payload.too_large",
      actorEmail: context.actorEmail,
      role: context.role,
      category: context.category,
      entryId: context.entryId,
      success: false,
      durationMs: context.durationMs,
      meta: baseMeta,
    });
  }
}

function buildWalEventsForReplace(
  actorEmail: string,
  actorRole: WalActorRole,
  ownerEmail: string,
  category: CategoryKey,
  beforeList: EntryEngineRecord[],
  afterList: EntryEngineRecord[]
) {
  const beforeById = new Map<string, EntryEngineRecord>();
  const afterById = new Map<string, EntryEngineRecord>();

  for (const entry of beforeList) {
    const id = normalizeId(entry.id);
    if (!id) continue;
    beforeById.set(id, entry);
  }
  for (const entry of afterList) {
    const id = normalizeId(entry.id);
    if (!id) continue;
    afterById.set(id, entry);
  }

  const walEvents = new Array<ReturnType<typeof buildEvent>>();
  for (const [id, afterEntry] of afterById) {
    const beforeEntry = beforeById.get(id) ?? null;
    if (!beforeEntry) {
      walEvents.push(
        buildEvent({
          actorEmail,
          actorRole,
          userEmail: ownerEmail,
          category,
          entryId: id,
          action: "CREATE",
          before: null,
          after: afterEntry,
        })
      );
      continue;
    }

    if (JSON.stringify(beforeEntry) === JSON.stringify(afterEntry)) {
      continue;
    }

    walEvents.push(
      buildEvent({
        actorEmail,
        actorRole,
        userEmail: ownerEmail,
        category,
        entryId: id,
        action: inferWalUpdateAction(beforeEntry, afterEntry),
        before: beforeEntry,
        after: afterEntry,
      })
    );
  }

  for (const [id, beforeEntry] of beforeById) {
    if (afterById.has(id)) continue;
    walEvents.push(
      buildEvent({
        actorEmail,
        actorRole,
        userEmail: ownerEmail,
        category,
        entryId: id,
        action: "DELETE",
        before: beforeEntry,
        after: null,
      })
    );
  }

  return walEvents;
}

async function appendWalEventOrThrow(userEmail: string, event: ReturnType<typeof buildEvent>) {
  const walResult = await appendEvent(userEmail, event);
  if (!walResult.ok) {
    throw walResult.error;
  }
  logger.debug({
    event: "entry.wal.append",
    userEmail,
    category: event.category,
    entryId: event.entryId,
    action: event.action,
  });
}

async function appendWalEventsOrThrow(userEmail: string, events: Array<ReturnType<typeof buildEvent>>) {
  if (!events.length) return;
  const walResult = await appendEvents(userEmail, events);
  if (!walResult.ok) {
    throw walResult.error;
  }
  logger.debug({
    event: "entry.wal.append.batch",
    userEmail,
    count: events.length,
  });
}

function prepareEntryForWrite(entry: EntryLike, nowISO: string, category: CategoryKey) {
  const existingStatus = getWorkflowStatus(entry);
  const base: EntryLike = {
    ...entry,
    createdAt:
      typeof entry.createdAt === "string" && entry.createdAt.trim()
        ? entry.createdAt
        : nowISO,
    updatedAt: nowISO,
    confirmationStatus: existingStatus,
  };
  const normalized = normalizeEntry(base as Entry, ENTRY_SCHEMAS[category]) as EntryLike;
  normalizeEntryStreakFields(normalized as Record<string, unknown>);
  return normalized;
}

function throwPendingImmutableError(changedFields: string[]) {
  throw new AppError({
    code: "FORBIDDEN",
    message: `Pending confirmation — core fields cannot be edited. Remove changes to: ${changedFields.join(", ")}.`,
    details: { changedFields },
  });
}

/**
 * Thin compatibility wrapper retained for existing `lifecycle.ts` readers.
 * Canonical lock/status rules still live in `stateMachine.ts`.
 */
export function isLockedFromApproval(entry: EntryEngineRecord) {
  return isEntryLocked(entry as EntryLike);
}

export async function listEntriesForCategory<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  normalize?: (value: unknown) => T | null
): Promise<T[]> {
  const list = await readListRaw(userEmail, category);
  if (!normalize) {
    return list as T[];
  }
  return list
    .map((entry) => normalize(entry))
    .filter((entry): entry is T => !!entry);
}

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
    const nextPayload = validateAndSanitizeOrThrow(category, rawPayload, "create");
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
    const nextPayload = validateAndSanitizeOrThrow(category, rawPayload, "update");

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

export async function commitDraft<T extends EntryEngineRecord = EntryEngineRecord>(
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
        // For array uploads (e.g. geotaggedPhotos), check length > 0
        // For object uploads (e.g. permissionLetter), check non-null
        // For nested uploads (e.g. uploads.permissionLetter), check inner fields
        if (field.kind === "array") {
          if (!Array.isArray(value) || value.length === 0) {
            throw new AppError({
              code: "VALIDATION_ERROR",
              message: `Upload required: ${field.label}.`,
            });
          }
        } else if (field.kind === "object" && value && typeof value === "object" && !("url" in (value as Record<string, unknown>)) && !("storedPath" in (value as Record<string, unknown>))) {
          // Nested uploads object (e.g. guest-lectures/workshops "uploads" field)
          // Check all sub-fields that should have file metadata
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

export async function computeStreak(
  userEmail: string
): Promise<EntryStreakSummary> {
  const normalizedOwner = normalizeEmail(userEmail);
  const entries: StreakProgressAggregateEntry[] = [];

  await withTimer("entry.streak.compute", async () => {
    for (const category of CATEGORY_KEYS) {
      const list = await readListRaw(normalizedOwner, category);
      for (const entry of list) {
        entries.push({
          ...(entry as EntryLike),
          categoryKey: category,
        });
      }
    }
  }, { userEmail: normalizedOwner });

  const aggregate = computeCanonicalStreakSnapshot(entries);
  const summary: EntryStreakSummary = {
    activated: aggregate.streakActivatedCount,
    wins: aggregate.streakWinsCount,
    byCategory: CATEGORY_KEYS.reduce<EntryStreakSummary["byCategory"]>((next, categoryKey) => {
      next[categoryKey] = {
        activated: aggregate.byCategory[categoryKey].activated,
        wins: aggregate.byCategory[categoryKey].wins,
      };
      return next;
    }, {} as EntryStreakSummary["byCategory"]),
  };

  logger.info({
    event: "entry.streak.summary",
    userEmail: normalizedOwner,
    activated: summary.activated,
    wins: summary.wins,
  });
  return summary;
}

/**
 * Thin compatibility wrapper retained for existing `lifecycle.ts` readers.
 * Canonical workflow normalization still lives in `stateMachine.ts`.
 */
export function getEntryWorkflowStatus(entry: EntryEngineRecord) {
  return getWorkflowStatus(entry as EntryLike);
}

/**
 * Engine-side normalization helper for persisted records. This prepares an
 * entry for workflow-aware reads without moving workflow ownership out of
 * `stateMachine.ts`.
 */
export function normalizeEntryForWorkflow(entry: EntryEngineRecord) {
  const nowISO = new Date().toISOString();
  const category = String(entry.category ?? "").trim().toLowerCase() as CategoryKey;
  if (CATEGORY_KEYS.includes(category)) {
    return prepareEntryForWrite(entry as EntryLike, nowISO, category) as EntryEngineRecord;
  }
  return normalizeEntry(entry as Entry, undefined) as EntryEngineRecord;
}
