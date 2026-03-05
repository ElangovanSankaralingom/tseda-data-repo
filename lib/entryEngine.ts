import { randomUUID } from "node:crypto";
import { ENTRY_SCHEMAS, type SchemaValidationMode } from "@/data/schemas";
import { isMasterAdmin } from "@/lib/admin";
import { CATEGORY_KEYS } from "@/lib/categories";
import { readCategoryEntries, writeCategoryEntries } from "@/lib/dataStore";
import { getDashboardTag } from "@/lib/dashboard/tags";
import type { CategoryKey } from "@/lib/entries/types";
import { logError } from "@/lib/errors";
import {
  isEntryLocked,
  normalizeEntryStatus,
  transitionEntry,
  type EntryStateLike,
  type EntryStatus as EntryWorkflowStatus,
} from "@/lib/entryStateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeStreakState } from "@/lib/gamification";

export type EntryEngineRecord = Record<string, unknown>;

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

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
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
  entries: EntryEngineRecord[]
) {
  await writeListRaw(userEmail, category, entries);
  revalidateDashboardSummary(userEmail);
}

export async function createEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  payload: EntryEngineRecord
): Promise<T> {
  const nextPayload = ensureRecord(payload);
  validatePayload(category, nextPayload, "create");

  const nowISO = new Date().toISOString();
  const list = await readListRaw(userEmail, category);
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

  list.unshift(entry);
  await writeListRaw(userEmail, category, list);
  revalidateDashboardSummary(userEmail);
  return entry as T;
}

export async function updateEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string,
  payload: EntryEngineRecord
): Promise<T> {
  const nextPayload = ensureRecord(payload);
  validatePayload(category, nextPayload, "update");

  const id = normalizeId(entryId);
  if (!id) {
    throw new Error("Entry ID is required");
  }

  const list = await readListRaw(userEmail, category);
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

  list[index] = updated;
  await writeListRaw(userEmail, category, list);
  revalidateDashboardSummary(userEmail);
  return updated as T;
}

export async function deleteEntry(
  userEmail: string,
  category: CategoryKey,
  entryId: string
) {
  const id = normalizeId(entryId);
  if (!id) {
    throw new Error("Entry ID is required");
  }

  const list = await readListRaw(userEmail, category);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    return null;
  }

  const [removed] = list.splice(index, 1);
  await writeListRaw(userEmail, category, list);
  revalidateDashboardSummary(userEmail);
  return removed;
}

export async function sendForConfirmation<T extends EntryEngineRecord = EntryEngineRecord>(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<T> {
  const list = await readListRaw(userEmail, category);
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
  list[index] = updated;
  await writeListRaw(userEmail, category, list);
  revalidateDashboardSummary(userEmail);
  return updated as T;
}

export async function approveEntry<T extends EntryEngineRecord = EntryEngineRecord>(
  adminEmail: string,
  category: CategoryKey,
  ownerEmail: string,
  entryId: string
): Promise<T> {
  const normalizedAdmin = normalizeEmail(adminEmail);
  if (!isMasterAdmin(normalizedAdmin)) {
    throw new Error("Forbidden");
  }

  const list = await readListRaw(ownerEmail, category);
  const id = normalizeId(entryId);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    throw new Error("Entry not found");
  }

  const nowISO = new Date().toISOString();
  const updated = transitionEntry(list[index] as WorkflowEntryLike, "adminApprove", {
    nowISO,
    adminEmail: normalizedAdmin,
  }) as EntryLike;
  list[index] = updated;
  await writeListRaw(ownerEmail, category, list);
  revalidateDashboardSummary(ownerEmail);
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
  if (!isMasterAdmin(normalizedAdmin)) {
    throw new Error("Forbidden");
  }

  const list = await readListRaw(ownerEmail, category);
  const id = normalizeId(entryId);
  const index = list.findIndex((entry) => normalizeId(entry.id) === id);
  if (index < 0) {
    throw new Error("Entry not found");
  }

  const nowISO = new Date().toISOString();
  const updated = transitionEntry(list[index] as WorkflowEntryLike, "adminReject", {
    nowISO,
    adminEmail: normalizedAdmin,
    rejectionReason: reason?.trim(),
  }) as EntryLike;
  list[index] = updated;
  await writeListRaw(ownerEmail, category, list);
  revalidateDashboardSummary(ownerEmail);
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
