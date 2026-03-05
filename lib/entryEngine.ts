import { randomUUID } from "node:crypto";
import { ENTRY_SCHEMAS, type SchemaValidationMode } from "@/data/schemas";
import { isMasterAdmin } from "@/lib/admin";
import { CATEGORY_KEYS } from "@/lib/categories";
import { rebuildUserIndex, updateIndexForEntryMutation } from "@/lib/data/indexStore";
import { readCategoryEntries, writeCategoryEntries } from "@/lib/dataStore";
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
import { getChangedImmutableFieldsWhenPending } from "@/lib/pendingImmutability";
import type { Entry, EntryStatus as EntryWorkflowStatus } from "@/lib/types/entry";

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

function validatePayload(
  category: CategoryKey,
  payload: EntryEngineRecord,
  mode: SchemaValidationMode
) {
  const schema = ENTRY_SCHEMAS[category];
  const errors = schema.validate(payload, mode);
  if (!errors.length) return;

  const message = errors.map((error) => error.message).join("; ");
  throw new Error(message);
}

function getValueAtPath(record: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split(".").filter(Boolean);
  if (!parts.length) return undefined;

  let current: unknown = record;
  for (const part of parts) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function hasCommittedValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.storedPath === "string" && record.storedPath.trim()) return true;
    if (typeof record.url === "string" && record.url.trim()) return true;
    return Object.keys(record).length > 0;
  }
  return false;
}

function getCommitMissingFields(category: CategoryKey, entry: EntryLike) {
  const schema = ENTRY_SCHEMAS[category];
  const requiredFields =
    (schema.requiredForCommit ?? schema.fields.filter((field) => field.required).map((field) => field.key)).slice();

  const missing = new Array<string>();
  for (const requiredField of requiredFields) {
    const value = getValueAtPath(entry as Record<string, unknown>, requiredField);
    if (!hasCommittedValue(value)) {
      missing.push(requiredField);
    }
  }

  if (
    typeof schema.minAttachmentsForCommit === "number" &&
    Number.isFinite(schema.minAttachmentsForCommit) &&
    schema.minAttachmentsForCommit > 0
  ) {
    const attachments = entry.attachments;
    const attachmentCount = Array.isArray(attachments) ? attachments.length : 0;
    if (attachmentCount < schema.minAttachmentsForCommit) {
      missing.push("attachments");
    }
  }

  return missing;
}

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

async function refreshIndexForMutation(
  userEmail: string,
  category: CategoryKey,
  beforeEntry: EntryEngineRecord | null,
  afterEntry: EntryEngineRecord | null
) {
  const indexResult = await updateIndexForEntryMutation(userEmail, category, beforeEntry, afterEntry);
  if (indexResult.ok) return;

  logError(indexResult.error, "entryEngine.refreshIndexForMutation");
  const rebuildResult = await rebuildUserIndex(userEmail);
  if (!rebuildResult.ok) {
    logError(rebuildResult.error, "entryEngine.rebuildUserIndex");
  }
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function getWalActorEmail(value: string, fallbackEmail: string) {
  const normalized = normalizeEmail(value);
  return normalized || fallbackEmail;
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
}

async function appendWalEventsOrThrow(userEmail: string, events: Array<ReturnType<typeof buildEvent>>) {
  if (!events.length) return;
  const walResult = await appendEvents(userEmail, events);
  if (!walResult.ok) {
    throw walResult.error;
  }
}

function prepareEntryForWrite(entry: EntryLike, nowISO: string) {
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
  return base;
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
  const actorEmail = getWalActorEmail(options?.actorEmail ?? normalizedOwner, normalizedOwner);
  const actorRole = options?.actorRole ?? "user";
  const currentList = await readListRaw(normalizedOwner, category);
  const beforeById = new Map<string, EntryEngineRecord>();
  for (const currentEntry of currentList) {
    const currentId = normalizeId(currentEntry.id);
    if (!currentId) continue;
    beforeById.set(currentId, currentEntry);
  }
  for (const nextEntry of entries) {
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
    entries
  );
  await appendWalEventsOrThrow(normalizedOwner, walEvents);

  await writeListRaw(normalizedOwner, category, entries);
  const rebuildResult = await rebuildUserIndex(normalizedOwner);
  if (!rebuildResult.ok) {
    logError(rebuildResult.error, "entryEngine.replaceEntriesForCategory.rebuildUserIndex");
  }
  revalidateDashboardSummary(normalizedOwner);
}

export async function createEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  payload: EntryEngineRecord
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const nextPayload = ensureRecord(payload);
  validatePayload(category, nextPayload, "create");

  const nowISO = new Date().toISOString();
  const list = await readListRaw(normalizedOwner, category);
  const id = normalizeId(nextPayload.id) || randomUUID();
  const existing = list.find((entry) => normalizeId(entry.id) === id);
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
  const entry = transitionEntry(base as WorkflowEntryLike, "createEntry", { nowISO }) as EntryLike;

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

  list.unshift(entry);
  await writeListRaw(normalizedOwner, category, list);
  await refreshIndexForMutation(normalizedOwner, category, null, entry as EntryEngineRecord);
  revalidateDashboardSummary(normalizedOwner);
  return entry as T;
}

export async function updateEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  payload: EntryEngineRecord
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const nextPayload = ensureRecord(payload);
  validatePayload(category, nextPayload, "update");

  const id = normalizeId(entryId);
  if (!id) {
    throw new Error("Entry ID is required");
  }

  const list = await readListRaw(normalizedOwner, category);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    throw new Error("Entry not found");
  }

  const nowISO = new Date().toISOString();
  const existing = list[index] as EntryLike;
  const next: EntryLike = {
    ...existing,
  };

  for (const [key, value] of Object.entries(nextPayload)) {
    if (key === "id" || key === "createdAt" || key === "confirmationStatus") continue;
    next[key] = value;
  }

  next.id = id;
  next.createdAt =
    typeof existing.createdAt === "string" && existing.createdAt.trim()
      ? existing.createdAt
      : nowISO;
  next.updatedAt = nowISO;
  next.confirmationStatus = getWorkflowStatus(existing);
  const updated = prepareEntryForWrite(next, nowISO);
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

  list[index] = updated;
  await writeListRaw(normalizedOwner, category, list);
  await refreshIndexForMutation(
    normalizedOwner,
    category,
    existing as EntryEngineRecord,
    updated as EntryEngineRecord
  );
  revalidateDashboardSummary(normalizedOwner);
  return updated as T;
}

export async function commitDraft<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  if (!id) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Entry ID is required.",
    });
  }

  const list = await readListRaw(normalizedOwner, category);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "Entry not found",
    });
  }

  const existing = list[index] as EntryLike;
  const missingFields = getCommitMissingFields(category, existing);
  if (missingFields.length > 0) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: `Commit blocked. Complete required fields: ${missingFields.join(", ")}.`,
      details: { missingFields },
    });
  }

  const nowISO = new Date().toISOString();
  const updated = prepareEntryForWrite(
    {
      ...existing,
      status: "final",
      committedAtISO: nowISO,
    },
    nowISO
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

  list[index] = updated;
  await writeListRaw(normalizedOwner, category, list);
  await refreshIndexForMutation(
    normalizedOwner,
    category,
    existing as EntryEngineRecord,
    updated as EntryEngineRecord
  );
  revalidateDashboardSummary(normalizedOwner);
  return updated as T;
}

export async function deleteEntry(
  userEmail: string,
  category: CategoryKey,
  entryId: string
) {
  const normalizedOwner = normalizeEmail(userEmail);
  const id = normalizeId(entryId);
  if (!id) {
    throw new Error("Entry ID is required");
  }

  const list = await readListRaw(normalizedOwner, category);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    return null;
  }

  const [removed] = list.splice(index, 1);
  await appendWalEventOrThrow(
    normalizedOwner,
    buildEvent({
      actorEmail: normalizedOwner,
      actorRole: "user",
      userEmail: normalizedOwner,
      category,
      entryId: id,
      action: "DELETE",
      before: removed,
      after: null,
    })
  );

  await writeListRaw(normalizedOwner, category, list);
  await refreshIndexForMutation(normalizedOwner, category, removed, null);
  revalidateDashboardSummary(normalizedOwner);
  return removed;
}

export async function sendForConfirmation<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  const normalizedOwner = normalizeEmail(userEmail);
  const list = await readListRaw(normalizedOwner, category);
  const id = normalizeId(entryId);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    throw new Error("Entry not found");
  }

  const existing = list[index] as EntryLike;
  if (String(existing.status ?? "draft") !== "final") {
    throw new Error("Complete the entry with Done before confirmation.");
  }

  const nowISO = new Date().toISOString();
  const updated = transitionEntry(existing as WorkflowEntryLike, "sendForConfirmation", {
    nowISO,
  }) as EntryLike;
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

  list[index] = updated;
  await writeListRaw(normalizedOwner, category, list);
  await refreshIndexForMutation(
    normalizedOwner,
    category,
    existing as EntryEngineRecord,
    updated as EntryEngineRecord
  );
  revalidateDashboardSummary(normalizedOwner);
  return updated as T;
}

export async function approveEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  const normalizedOwner = normalizeEmail(ownerEmail);
  if (!isMasterAdmin(normalizedAdmin)) {
    throw new Error("Forbidden");
  }

  const list = await readListRaw(normalizedOwner, category);
  const id = normalizeId(entryId);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    throw new Error("Entry not found");
  }

  const existing = list[index] as EntryEngineRecord;
  const nowISO = new Date().toISOString();
  const updated = transitionEntry(list[index] as WorkflowEntryLike, "adminApprove", {
    nowISO,
    adminEmail: normalizedAdmin,
  }) as EntryLike;
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

  list[index] = updated;
  await writeListRaw(normalizedOwner, category, list);
  await refreshIndexForMutation(
    normalizedOwner,
    category,
    existing,
    updated as EntryEngineRecord
  );
  revalidateDashboardSummary(normalizedOwner);
  return updated as T;
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
  if (!isMasterAdmin(normalizedAdmin)) {
    throw new Error("Forbidden");
  }

  const list = await readListRaw(normalizedOwner, category);
  const id = normalizeId(entryId);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    throw new Error("Entry not found");
  }

  const existing = list[index] as EntryEngineRecord;
  const nowISO = new Date().toISOString();
  const updated = transitionEntry(list[index] as WorkflowEntryLike, "adminReject", {
    nowISO,
    adminEmail: normalizedAdmin,
    rejectionReason: reason?.trim(),
  }) as EntryLike;
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

  list[index] = updated;
  await writeListRaw(normalizedOwner, category, list);
  await refreshIndexForMutation(
    normalizedOwner,
    category,
    existing,
    updated as EntryEngineRecord
  );
  revalidateDashboardSummary(normalizedOwner);
  return updated as T;
}

export async function computeStreak(
  userEmail: string
): Promise<EntryStreakSummary> {
  const summary: EntryStreakSummary = {
    activated: 0,
    completed: 0,
    byCategory: {
      "fdp-attended": { activated: 0, completed: 0 },
      "fdp-conducted": { activated: 0, completed: 0 },
      "case-studies": { activated: 0, completed: 0 },
      "guest-lectures": { activated: 0, completed: 0 },
      workshops: { activated: 0, completed: 0 },
    },
  };

  for (const category of CATEGORY_KEYS) {
    const list = await readListRaw(userEmail, category);
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

  return summary;
}

export function getEntryWorkflowStatus(entry: EntryEngineRecord) {
  return getWorkflowStatus(entry as EntryLike);
}

export function normalizeEntryForWorkflow(entry: EntryEngineRecord) {
  const nowISO = new Date().toISOString();
  return prepareEntryForWrite(entry as EntryLike, nowISO) as EntryEngineRecord;
}
