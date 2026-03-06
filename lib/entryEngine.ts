import "server-only";
import { randomUUID } from "node:crypto";
import { ENTRY_SCHEMAS } from "@/data/schemas";
import { isMasterAdmin } from "@/lib/admin";
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
import { AppError, logError } from "@/lib/errors";
import {
  isEntryLocked,
  normalizeEntryStatus,
  transitionEntry,
  type EntryStateLike,
} from "@/lib/entryStateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeStreakState } from "@/lib/gamification";
import { normalizeEntry } from "@/lib/normalize";
import { getChangedImmutableFieldsWhenPending } from "@/lib/pendingImmutability";
import { assertActionPayload, assertEntryMutationInput, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitOrThrow, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { validateAndSanitizeOrThrow } from "@/lib/validation/validateEntryPayload";
import type { Entry, EntryStatus as EntryWorkflowStatus } from "@/lib/types/entry";
import { logger, withTimer } from "@/lib/logger";

export type EntryEngineRecord = Entry;

export type EntryStreakSummary = {
  activated: number;
  completed: number;
  byCategory: Record<CategoryKey, { activated: number; completed: number }>;
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
  "sentForConfirmationAtISO",
  "confirmedAtISO",
  "confirmedBy",
  "confirmationRejectedReason",
  "committedAtISO",
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
  return normalizeEntry(base as Entry, ENTRY_SCHEMAS[category]) as EntryLike;
}

function throwPendingImmutableError(changedFields: string[]) {
  throw new AppError({
    code: "FORBIDDEN",
    message: `Pending confirmation — core fields cannot be edited. Remove changes to: ${changedFields.join(", ")}.`,
    details: { changedFields },
  });
}

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
  logger.info({
    event: "entry.mutation.start",
    action: "create",
    userEmail: normalizedOwner,
    category,
  });
  enforceEntryMutationGuards(normalizedOwner, `entry.create.${category}`, rawPayload);
  const nextPayload = validateAndSanitizeOrThrow(category, rawPayload, "create");
  return withUserDataLock(normalizedOwner, async () => {
    const nowISO = new Date().toISOString();
    const id = normalizeId(nextPayload.id) || randomUUID();
    const existing = await readEntryRaw(normalizedOwner, category, id);
    if (existing) {
      throw new Error("Entry already exists");
    }

    const base: EntryLike = {
      ...nextPayload,
      id,
      status:
        typeof nextPayload.status === "string" && nextPayload.status.trim()
          ? nextPayload.status
          : "draft",
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
  logger.info({
    event: "entry.mutation.start",
    action: "update",
    userEmail: normalizedOwner,
    category,
    entryId: normalizeId(entryId),
  });
  enforceEntryMutationGuards(normalizedOwner, `entry.update.${category}`, rawPayload);
  const nextPayload = validateAndSanitizeOrThrow(category, rawPayload, "update");

  const id = normalizeId(entryId);
  if (!id) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Entry ID is required.",
    });
  }
  return withUserDataLock(normalizedOwner, async () => {
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

    for (const [key, value] of Object.entries(nextPayload)) {
      if (PROTECTED_UPDATE_KEYS.has(key)) continue;
      next[key] = value;
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
}

export async function commitDraft<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  logger.info({
    event: "entry.mutation.start",
    action: "commitDraft",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  enforceEntryMutationGuards(normalizedOwner, `entry.commit.${category}`, { entryId: id });
  if (!id) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Entry ID is required.",
    });
  }
  return withUserDataLock(normalizedOwner, async () => {
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

    const nowISO = new Date().toISOString();
    const updated = prepareEntryForWrite(
      {
        ...existing,
        status: "final",
        committedAtISO: nowISO,
      },
      nowISO,
      category
    );

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
}

export async function deleteEntry(
  userEmail: string,
  category: CategoryKey,
  entryId: string
) {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  logger.info({
    event: "entry.mutation.start",
    action: "delete",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  enforceEntryMutationGuards(normalizedOwner, `entry.delete.${category}`, { entryId: id });
  if (!id) {
    throw new Error("Entry ID is required");
  }
  return withUserDataLock(normalizedOwner, async () => {
    const existing = await readEntryRaw(normalizedOwner, category, id);
    if (!existing) {
      return null;
    }

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
    return existing;
  });
}

export async function sendForConfirmation<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  const startedAt = Date.now();
  logger.info({
    event: "entry.mutation.start",
    action: "sendForConfirmation",
    userEmail: normalizedOwner,
    category,
    entryId: id,
  });
  enforceEntryMutationGuards(normalizedOwner, `entry.confirmation.send.${category}`, { entryId: id });
  if (!id) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Entry ID is required.",
    });
  }
  return withUserDataLock(normalizedOwner, async () => {
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
      "sendForConfirmation"
    ) as EntryLike;
    if (String(existing.status ?? "draft") !== "final") {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Complete the entry with Done before confirmation.",
      });
    }

    const nowISO = new Date().toISOString();
    const updated = normalizeEntry(
      transitionEntry(existing as WorkflowEntryLike, "sendForConfirmation", {
        nowISO,
      }) as Entry,
      ENTRY_SCHEMAS[category]
    ) as EntryLike;
    await appendWalEventOrThrow(
      normalizedOwner,
      buildEvent({
        actorEmail: normalizedOwner,
        actorRole: "user",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        action: "SEND_FOR_CONFIRMATION",
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
      action: "sendForConfirmation",
      userEmail: normalizedOwner,
      category,
      entryId: id,
      status: String(updated.confirmationStatus ?? ""),
      durationMs: Date.now() - startedAt,
    });
    return updated as T;
  });
}

export async function approveEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const startedAt = Date.now();
  logger.info({
    event: "entry.mutation.start",
    action: "approve",
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category,
    entryId: normalizeId(entryId),
  });
  if (!isMasterAdmin(normalizedAdmin)) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  }

  enforceAdminMutationGuards(normalizedAdmin, "entry.confirmation.approve", {
    category,
    ownerEmail: normalizedOwner,
    entryId,
  });
  const id = normalizeId(entryId);
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
  return withUserDataLock(normalizedOwner, async () => {
    const existing = await readEntryRaw(normalizedOwner, category, id);
    if (!existing) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Entry not found",
      });
    }

    const nowISO = new Date().toISOString();
    const updated = normalizeEntry(
      transitionEntry(existing as WorkflowEntryLike, "adminApprove", {
        nowISO,
        adminEmail: normalizedAdmin,
      }) as Entry,
      ENTRY_SCHEMAS[category]
    ) as EntryLike;
    await appendWalEventOrThrow(
      normalizedOwner,
      buildEvent({
        actorEmail: normalizedAdmin,
        actorRole: "admin",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        action: "APPROVE",
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
      action: "approve",
      actorEmail: normalizedAdmin,
      userEmail: normalizedOwner,
      category,
      entryId: id,
      status: String(updated.confirmationStatus ?? ""),
      durationMs: Date.now() - startedAt,
    });
    return updated as T;
  });
}

export async function rejectEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string,
  reason?: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  const startedAt = Date.now();
  logger.info({
    event: "entry.mutation.start",
    action: "reject",
    actorEmail: normalizedAdmin,
    userEmail: normalizedOwner,
    category,
    entryId: normalizeId(entryId),
  });
  if (!isMasterAdmin(normalizedAdmin)) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Forbidden",
    });
  }

  enforceAdminMutationGuards(normalizedAdmin, "entry.confirmation.reject", {
    category,
    ownerEmail: normalizedOwner,
    entryId,
    reason: reason?.trim() ?? "",
  });
  const id = normalizeId(entryId);
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
  return withUserDataLock(normalizedOwner, async () => {
    const existing = await readEntryRaw(normalizedOwner, category, id);
    if (!existing) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "Entry not found",
      });
    }

    const nowISO = new Date().toISOString();
    const updated = normalizeEntry(
      transitionEntry(existing as WorkflowEntryLike, "adminReject", {
        nowISO,
        adminEmail: normalizedAdmin,
        rejectionReason: reason?.trim(),
      }) as Entry,
      ENTRY_SCHEMAS[category]
    ) as EntryLike;
    await appendWalEventOrThrow(
      normalizedOwner,
      buildEvent({
        actorEmail: normalizedAdmin,
        actorRole: "admin",
        userEmail: normalizedOwner,
        category,
        entryId: id,
        action: "REJECT",
        before: existing,
        after: updated as EntryEngineRecord,
        meta: reason?.trim() ? { reason: reason.trim() } : undefined,
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
      action: "reject",
      actorEmail: normalizedAdmin,
      userEmail: normalizedOwner,
      category,
      entryId: id,
      status: String(updated.confirmationStatus ?? ""),
      durationMs: Date.now() - startedAt,
    });
    return updated as T;
  });
}

export async function computeStreak(
  userEmail: string
): Promise<EntryStreakSummary> {
  const normalizedOwner = normalizeEmail(userEmail);
  const summary: EntryStreakSummary = {
    activated: 0,
    completed: 0,
    byCategory: CATEGORY_KEYS.reduce<EntryStreakSummary["byCategory"]>((next, categoryKey) => {
      next[categoryKey] = { activated: 0, completed: 0 };
      return next;
    }, {} as EntryStreakSummary["byCategory"]),
  };

  await withTimer("entry.streak.compute", async () => {
    for (const category of CATEGORY_KEYS) {
      const list = await readListRaw(normalizedOwner, category);
      for (const entry of list) {
        const streak = normalizeStreakState((entry as EntryLike).streak);
        if (streak.completedAtISO) {
          summary.completed += 1;
          summary.byCategory[category].completed += 1;
          continue;
        }
        if (streak.activatedAtISO) {
          summary.activated += 1;
          summary.byCategory[category].activated += 1;
        }
      }
    }
  }, { userEmail: normalizedOwner });
  logger.info({
    event: "entry.streak.summary",
    userEmail: normalizedOwner,
    activated: summary.activated,
    completed: summary.completed,
  });
  return summary;
}

export function getEntryWorkflowStatus(entry: EntryEngineRecord) {
  return getWorkflowStatus(entry as EntryLike);
}

export function normalizeEntryForWorkflow(entry: EntryEngineRecord) {
  const nowISO = new Date().toISOString();
  const category = String(entry.category ?? "").trim().toLowerCase() as CategoryKey;
  if (CATEGORY_KEYS.includes(category)) {
    return prepareEntryForWrite(entry as EntryLike, nowISO, category) as EntryEngineRecord;
  }
  return normalizeEntry(entry as Entry, undefined) as EntryEngineRecord;
}
