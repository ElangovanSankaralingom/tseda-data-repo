import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ENTRY_SCHEMAS, type SchemaValidationMode } from "@/data/schemas";
import { isMasterAdmin } from "@/lib/admin";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeStreakState } from "@/lib/gamification";
import { getUserCategoryStoreFile } from "@/lib/userStore";

export type EntryWorkflowStatus =
  | "DRAFT"
  | "PENDING_CONFIRMATION"
  | "APPROVED"
  | "REJECTED";

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

type UpdateStatusOptions = {
  nowISO: string;
  adminEmail?: string;
  rejectionReason?: string;
};

function normalizeWorkflowStatus(
  value: unknown,
  fallback: EntryWorkflowStatus = "DRAFT"
): EntryWorkflowStatus {
  const raw = String(value ?? "").trim().toUpperCase();

  if (raw === "APPROVED") return "APPROVED";
  if (raw === "PENDING_CONFIRMATION" || raw === "PENDING") return "PENDING_CONFIRMATION";
  if (raw === "REJECTED") return "REJECTED";
  if (raw === "DRAFT") return "DRAFT";

  const legacy = String(value ?? "").trim().toLowerCase();
  if (legacy === "approved") return "APPROVED";
  if (legacy === "pending") return "PENDING_CONFIRMATION";
  if (legacy === "rejected") return "REJECTED";
  if (legacy === "none") return "DRAFT";

  return fallback;
}

function getWorkflowStatus(entry: EntryLike): EntryWorkflowStatus {
  if (entry.confirmationStatus !== undefined) {
    return normalizeWorkflowStatus(entry.confirmationStatus);
  }

  return normalizeWorkflowStatus(entry.requestEditStatus, "DRAFT");
}

function toLegacyRequestEditStatus(status: EntryWorkflowStatus) {
  if (status === "APPROVED") return "approved";
  if (status === "PENDING_CONFIRMATION") return "pending";
  if (status === "REJECTED") return "rejected";
  return "none";
}

function applyWorkflowStatus(
  entry: EntryLike,
  status: EntryWorkflowStatus,
  options: UpdateStatusOptions
) {
  const next: EntryLike = {
    ...entry,
    confirmationStatus: status,
    requestEditStatus: toLegacyRequestEditStatus(status),
    updatedAt: options.nowISO,
  };

  if (status === "DRAFT") {
    next.requestEditRequestedAtISO = null;
    next.confirmedAtISO = null;
    next.confirmedBy = null;
    next.confirmationRejectedReason = "";
    return next;
  }

  if (status === "PENDING_CONFIRMATION") {
    next.sentForConfirmationAtISO =
      typeof next.sentForConfirmationAtISO === "string" && next.sentForConfirmationAtISO.trim()
        ? next.sentForConfirmationAtISO
        : options.nowISO;
    next.requestEditRequestedAtISO =
      typeof next.requestEditRequestedAtISO === "string" && next.requestEditRequestedAtISO.trim()
        ? next.requestEditRequestedAtISO
        : options.nowISO;
    next.confirmedAtISO = null;
    next.confirmedBy = null;
    next.confirmationRejectedReason = "";
    return next;
  }

  if (status === "APPROVED") {
    next.confirmedAtISO = options.nowISO;
    next.confirmedBy = options.adminEmail ?? next.confirmedBy ?? null;
    next.confirmationRejectedReason = "";
    return next;
  }

  next.confirmedAtISO = null;
  next.confirmedBy = null;
  next.confirmationRejectedReason = options.rejectionReason ?? "";
  return next;
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

function categoryStoreFile(category: CategoryKey) {
  return CATEGORY_STORE_FILES[category];
}

async function readListRaw(
  userEmail: string,
  category: CategoryKey
): Promise<EntryEngineRecord[]> {
  const normalizedEmail = normalizeEmail(userEmail);
  const filePath = getUserCategoryStoreFile(normalizedEmail, categoryStoreFile(category));

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((value) => !!value && typeof value === "object" && !Array.isArray(value))
      .map((value) => value as EntryEngineRecord);
  } catch {
    return [];
  }
}

async function writeListRaw(
  userEmail: string,
  category: CategoryKey,
  list: EntryEngineRecord[]
) {
  const normalizedEmail = normalizeEmail(userEmail);
  const filePath = getUserCategoryStoreFile(normalizedEmail, categoryStoreFile(category));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
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
  };
  return applyWorkflowStatus(base, existingStatus, { nowISO });
}

export function isLockedFromApproval(entry: EntryEngineRecord) {
  return getWorkflowStatus(entry as EntryLike) === "APPROVED";
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
    confirmationStatus: normalizeWorkflowStatus(nextPayload.confirmationStatus, "DRAFT"),
  };
  const entry = applyWorkflowStatus(base, getWorkflowStatus(base), { nowISO });

  list.unshift(entry);
  await writeListRaw(userEmail, category, list);
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
    if (key === "id" || key === "createdAt") continue;
    next[key] = value;
  }

  next.id = id;
  next.createdAt =
    typeof existing.createdAt === "string" && existing.createdAt.trim()
      ? existing.createdAt
      : nowISO;
  next.updatedAt = nowISO;

  const status =
    Object.prototype.hasOwnProperty.call(nextPayload, "confirmationStatus") ||
    Object.prototype.hasOwnProperty.call(nextPayload, "requestEditStatus")
      ? normalizeWorkflowStatus(
          nextPayload.confirmationStatus ?? nextPayload.requestEditStatus
        )
      : getWorkflowStatus(next);
  const updated = applyWorkflowStatus(next, status, { nowISO });

  list[index] = updated;
  await writeListRaw(userEmail, category, list);
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
  const updated = applyWorkflowStatus(existing, "PENDING_CONFIRMATION", { nowISO });
  list[index] = updated;
  await writeListRaw(userEmail, category, list);
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
  const updated = applyWorkflowStatus(list[index] as EntryLike, "APPROVED", {
    nowISO,
    adminEmail: normalizedAdmin,
  });
  list[index] = updated;
  await writeListRaw(ownerEmail, category, list);
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
  const updated = applyWorkflowStatus(list[index] as EntryLike, "REJECTED", {
    nowISO,
    adminEmail: normalizedAdmin,
    rejectionReason: reason?.trim(),
  });
  list[index] = updated;
  await writeListRaw(ownerEmail, category, list);
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
