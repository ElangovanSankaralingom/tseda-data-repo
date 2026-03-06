import "server-only";
import { getCategorySchema, isValidCategorySlug } from "@/data/categoryRegistry";
import { CATEGORY_KEYS } from "@/lib/categories";
import { AppError, normalizeError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import { normalizeEntry as normalizeEntryRecord } from "@/lib/normalize";
import { err, ok, type Result } from "@/lib/result";
import type { Entry, EntryStatus } from "@/lib/types/entry";
import type { UserIndex } from "@/lib/data/indexStore";
import type { WalAction, WalActorRole, WalEvent } from "@/lib/data/wal";

export const ENTRY_SCHEMA_VERSION = 1;
export const CATEGORY_STORE_SCHEMA_VERSION = 2;
export const USER_INDEX_SCHEMA_VERSION = 2;
export const WAL_EVENT_SCHEMA_VERSION = 1;

export type CategoryStoreV2 = {
  version: number;
  byId: Record<string, Entry>;
  order: string[];
};

const ENTRY_STATUS_KEYS: readonly EntryStatus[] = [
  "DRAFT",
  "PENDING_CONFIRMATION",
  "APPROVED",
  "REJECTED",
];

const WAL_ACTIONS = new Set<WalAction>([
  "CREATE",
  "UPDATE",
  "DELETE",
  "SEND_FOR_CONFIRMATION",
  "APPROVE",
  "REJECT",
  "UPLOAD_ADD",
  "UPLOAD_REMOVE",
  "UPLOAD_REPLACE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toVersion(value: unknown, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;
  return Math.floor(value);
}

function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toISO(value: unknown, fallbackISO: string): string {
  const candidate = toTrimmedString(value);
  if (!candidate) return fallbackISO;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? fallbackISO : candidate;
}

function toOptionalISO(value: unknown): string | null {
  const candidate = toTrimmedString(value);
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : candidate;
}

function toNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.floor(value);
}

function normalizeIndexSearchMap(
  raw: unknown
): UserIndex["searchIndexByEntryId"] {
  if (!isRecord(raw)) return {};
  const next: UserIndex["searchIndexByEntryId"] = {};

  for (const value of Object.values(raw)) {
    if (!isRecord(value)) continue;
    const entryId = toTrimmedString(value.entryId);
    const categoryKey = toTrimmedString(value.categoryKey) as CategoryKey;
    const title = toTrimmedString(value.title);
    const text = toTrimmedString(value.text);
    const status = toTrimmedString(value.status) as EntryStatus;
    if (!entryId || !CATEGORY_KEYS.includes(categoryKey) || !title || !text) continue;
    if (!ENTRY_STATUS_KEYS.includes(status)) continue;

    const key = `${categoryKey}:${entryId}`;
    next[key] = {
      entryId,
      categoryKey,
      title,
      text,
      status,
      updatedAtISO: toOptionalISO(value.updatedAtISO),
      createdAtISO: toOptionalISO(value.createdAtISO),
    };
  }

  return next;
}

function emptyCategoryMap<T>(valueFactory: () => T) {
  return CATEGORY_KEYS.reduce<Record<CategoryKey, T>>((next, categoryKey) => {
    next[categoryKey] = valueFactory();
    return next;
  }, {} as Record<CategoryKey, T>);
}

function normalizeLegacyFinalization(record: Record<string, unknown>) {
  const finalizedFlags = [
    record.finalised,
    record.finalized,
    record.isFinalized,
    record.isFinalised,
  ];
  const isLegacyFinalized = finalizedFlags.some((value) => value === true);

  const currentStatus = toTrimmedString(record.status).toLowerCase();
  if (!currentStatus && isLegacyFinalized) {
    record.status = "final";
  }

  if (isLegacyFinalized) {
    const status = normalizeEntryStatus(record as EntryStateLike);
    if (status === "DRAFT") {
      record.confirmationStatus = "APPROVED";
      if (!toTrimmedString(record.confirmedAtISO)) {
        record.confirmedAtISO = new Date().toISOString();
      }
    }
  }
}

function migrateEntryV0ToV1(raw: Record<string, unknown>, nowISO: string) {
  const next = { ...raw };

  normalizeLegacyFinalization(next);
  next.confirmationStatus = normalizeEntryStatus(next as EntryStateLike);

  if (!Array.isArray(next.attachments)) {
    next.attachments = [];
  }

  const createdAt = toISO(next.createdAt, nowISO);
  const updatedAt = toISO(next.updatedAt, createdAt);
  next.createdAt = createdAt;
  next.updatedAt = updatedAt;

  next.schemaVersion = ENTRY_SCHEMA_VERSION;
  return next;
}

function runRecordMigrations(
  raw: Record<string, unknown>,
  version: number,
  latestVersion: number,
  migrations: Record<number, (value: Record<string, unknown>, nowISO: string) => Record<string, unknown>>,
  nowISO: string
) {
  let current = { ...raw };
  let nextVersion = version;
  while (nextVersion < latestVersion) {
    const migrate = migrations[nextVersion];
    if (!migrate) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `Missing migration path from v${nextVersion} to v${nextVersion + 1}.`,
      });
    }
    current = migrate(current, nowISO);
    nextVersion += 1;
  }
  return current;
}

export function migrateEntry(raw: unknown): Result<Entry> {
  try {
    if (!isRecord(raw)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid entry payload",
      });
    }

    const nowISO = new Date().toISOString();
    const rawVersion = toVersion(raw.schemaVersion ?? raw.v, 0);
    const migrated = runRecordMigrations(
      raw,
      rawVersion,
      ENTRY_SCHEMA_VERSION,
      {
        0: migrateEntryV0ToV1,
      },
      nowISO
    );

    const categorySlug = toTrimmedString(migrated.category).toLowerCase();
    const normalized = normalizeEntryRecord(
      migrated as Entry,
      isValidCategorySlug(categorySlug) ? getCategorySchema(categorySlug) : undefined
    ) as Record<string, unknown>;

    normalized.confirmationStatus = normalizeEntryStatus(normalized as EntryStateLike);
    if (!Array.isArray(normalized.attachments)) {
      normalized.attachments = [];
    }
    if (!toTrimmedString(normalized.status)) {
      normalized.status = "draft";
    }
    normalized.createdAt = toISO(normalized.createdAt, nowISO);
    normalized.updatedAt = toISO(normalized.updatedAt, toISO(normalized.createdAt, nowISO));
    normalized.schemaVersion = ENTRY_SCHEMA_VERSION;

    return ok(normalized as Entry);
  } catch (error) {
    return err(normalizeError(error));
  }
}

function buildCategoryStoreFromEntries(rawEntries: unknown[]): CategoryStoreV2 {
  const byId: Record<string, Entry> = {};
  const order: string[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < rawEntries.length; index += 1) {
    const rawEntry = rawEntries[index];
    const migratedEntry = migrateEntry(rawEntry);
    if (!migratedEntry.ok) continue;

    const entryId = toTrimmedString(migratedEntry.data.id) || `legacy-${index + 1}`;
    const nextEntry = { ...migratedEntry.data, id: entryId };
    byId[entryId] = nextEntry;
    if (!seen.has(entryId)) {
      order.push(entryId);
      seen.add(entryId);
    }
  }

  return {
    version: CATEGORY_STORE_SCHEMA_VERSION,
    byId,
    order,
  };
}

function buildCategoryStoreFromById(
  rawById: Record<string, unknown>,
  rawOrder: unknown
): CategoryStoreV2 {
  const byId: Record<string, Entry> = {};
  const order: string[] = [];
  const seen = new Set<string>();

  const orderedIds = Array.isArray(rawOrder)
    ? rawOrder.map((value) => toTrimmedString(value)).filter(Boolean)
    : [];

  for (const candidateId of orderedIds) {
    if (!candidateId || seen.has(candidateId)) continue;
    const rawEntry = rawById[candidateId];
    if (rawEntry === undefined) continue;

    const migratedEntry = migrateEntry(rawEntry);
    if (!migratedEntry.ok) continue;

    const entryId = toTrimmedString(migratedEntry.data.id) || candidateId;
    const nextEntry = { ...migratedEntry.data, id: entryId };
    byId[entryId] = nextEntry;
    if (!seen.has(entryId)) {
      order.push(entryId);
      seen.add(entryId);
    }
  }

  for (const [candidateId, rawEntry] of Object.entries(rawById)) {
    const fallbackId = toTrimmedString(candidateId);
    if (!fallbackId) continue;

    const migratedEntry = migrateEntry(rawEntry);
    if (!migratedEntry.ok) continue;

    const entryId = toTrimmedString(migratedEntry.data.id) || fallbackId;
    const nextEntry = { ...migratedEntry.data, id: entryId };
    byId[entryId] = nextEntry;
    if (!seen.has(entryId)) {
      order.push(entryId);
      seen.add(entryId);
    }
  }

  return {
    version: CATEGORY_STORE_SCHEMA_VERSION,
    byId,
    order,
  };
}

export function migrateCategoryStore(raw: unknown): Result<CategoryStoreV2> {
  try {
    if (Array.isArray(raw)) {
      return ok(buildCategoryStoreFromEntries(raw));
    }

    if (!isRecord(raw)) {
      return ok(buildCategoryStoreFromEntries([]));
    }

    const byIdRaw = isRecord(raw.byId) ? raw.byId : null;
    if (toVersion(raw.version, 0) === CATEGORY_STORE_SCHEMA_VERSION && byIdRaw) {
      return ok(buildCategoryStoreFromById(byIdRaw, raw.order));
    }

    if (Array.isArray(raw.entries)) {
      return ok(buildCategoryStoreFromEntries(raw.entries));
    }

    return ok(buildCategoryStoreFromEntries([]));
  } catch (error) {
    return err(normalizeError(error));
  }
}

function migrateUserIndexV0ToV1(raw: Record<string, unknown>, nowISO: string) {
  const userEmail = toTrimmedString(raw.userEmail);
  const next: UserIndex = {
    version: USER_INDEX_SCHEMA_VERSION,
    userEmail,
    updatedAt: toISO(raw.updatedAt, nowISO),
    totalsByCategory: emptyCategoryMap(() => 0),
    countsByStatus: {
      DRAFT: 0,
      PENDING_CONFIRMATION: 0,
      APPROVED: 0,
      REJECTED: 0,
    },
    pendingByCategory: emptyCategoryMap(() => 0),
    approvedByCategory: emptyCategoryMap(() => 0),
    lastEntryAtByCategory: emptyCategoryMap(() => null),
    streakSnapshot: {
      streakActivatedCount: 0,
      streakWinsCount: 0,
      byCategory: emptyCategoryMap(() => ({ activated: 0, wins: 0 })),
      activeEntries: [],
      lastComputedAt: nowISO,
    },
    searchIndexByEntryId: {},
  };

  const totalsByCategory = isRecord(raw.totalsByCategory) ? raw.totalsByCategory : null;
  const pendingByCategory = isRecord(raw.pendingByCategory) ? raw.pendingByCategory : null;
  const approvedByCategory = isRecord(raw.approvedByCategory) ? raw.approvedByCategory : null;
  const lastEntryAtByCategory = isRecord(raw.lastEntryAtByCategory) ? raw.lastEntryAtByCategory : null;
  const countsByStatus = isRecord(raw.countsByStatus) ? raw.countsByStatus : null;
  const streakSnapshot = isRecord(raw.streakSnapshot) ? raw.streakSnapshot : null;
  const streakByCategory = streakSnapshot && isRecord(streakSnapshot.byCategory) ? streakSnapshot.byCategory : null;
  const activeEntriesRaw =
    streakSnapshot && Array.isArray(streakSnapshot.activeEntries) ? streakSnapshot.activeEntries : [];

  for (const category of CATEGORY_KEYS) {
    next.totalsByCategory[category] = toNonNegativeInteger(totalsByCategory?.[category]);
    next.pendingByCategory[category] = toNonNegativeInteger(pendingByCategory?.[category]);
    next.approvedByCategory[category] = toNonNegativeInteger(approvedByCategory?.[category]);
    next.lastEntryAtByCategory[category] = toOptionalISO(lastEntryAtByCategory?.[category]);

    const streakCategoryRaw = isRecord(streakByCategory?.[category]) ? streakByCategory[category] : {};
    next.streakSnapshot.byCategory[category] = {
      activated: toNonNegativeInteger(streakCategoryRaw.activated),
      wins: toNonNegativeInteger(streakCategoryRaw.wins),
    };
  }

  for (const status of ENTRY_STATUS_KEYS) {
    next.countsByStatus[status] = toNonNegativeInteger(countsByStatus?.[status]);
  }

  next.streakSnapshot.streakActivatedCount = toNonNegativeInteger(streakSnapshot?.streakActivatedCount);
  next.streakSnapshot.streakWinsCount = toNonNegativeInteger(streakSnapshot?.streakWinsCount);
  next.streakSnapshot.lastComputedAt = toISO(streakSnapshot?.lastComputedAt, nowISO);
  next.streakSnapshot.activeEntries = activeEntriesRaw
    .map((value) => {
      if (!isRecord(value)) return null;
      const id = toTrimmedString(value.id);
      const categoryKey = toTrimmedString(value.categoryKey) as CategoryKey;
      if (!id || !CATEGORY_KEYS.includes(categoryKey)) return null;
      return {
        id,
        categoryKey,
        dueAtISO: toOptionalISO(value.dueAtISO),
        sortAtISO: toOptionalISO(value.sortAtISO),
      };
    })
    .filter((value): value is UserIndex["streakSnapshot"]["activeEntries"][number] => !!value)
    .sort((left, right) => {
      const leftTime = Date.parse(left.sortAtISO ?? "");
      const rightTime = Date.parse(right.sortAtISO ?? "");
      const safeLeft = Number.isNaN(leftTime) ? Number.POSITIVE_INFINITY : leftTime;
      const safeRight = Number.isNaN(rightTime) ? Number.POSITIVE_INFINITY : rightTime;
      return safeLeft - safeRight;
    });
  next.searchIndexByEntryId = normalizeIndexSearchMap(raw.searchIndexByEntryId);

  return next as unknown as Record<string, unknown>;
}

function migrateUserIndexV1ToV2(raw: Record<string, unknown>, nowISO: string) {
  const next = migrateUserIndexV0ToV1(raw, nowISO) as Record<string, unknown>;
  next.searchIndexByEntryId = normalizeIndexSearchMap(raw.searchIndexByEntryId);
  return next;
}

export function migrateUserIndex(raw: unknown): Result<UserIndex> {
  try {
    if (!isRecord(raw)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid user index payload",
      });
    }

    const nowISO = new Date().toISOString();
    const rawVersion = toVersion(raw.version, 0);
    const migrated = runRecordMigrations(
      raw,
      rawVersion,
      USER_INDEX_SCHEMA_VERSION,
      {
        0: migrateUserIndexV0ToV1,
        1: migrateUserIndexV1ToV2,
      },
      nowISO
    );

    const finalized = migrateUserIndexV1ToV2(
      migrateUserIndexV0ToV1(migrated, nowISO),
      nowISO
    ) as unknown as UserIndex;
    finalized.version = USER_INDEX_SCHEMA_VERSION;
    finalized.updatedAt = toISO(finalized.updatedAt, nowISO);
    finalized.userEmail = toTrimmedString(finalized.userEmail);

    return ok(finalized);
  } catch (error) {
    return err(normalizeError(error));
  }
}

function normalizeWalAction(value: unknown): WalAction {
  const action = toTrimmedString(value).toUpperCase() as WalAction;
  return WAL_ACTIONS.has(action) ? action : "UPDATE";
}

function normalizeWalRole(value: unknown): WalActorRole {
  const role = toTrimmedString(value).toLowerCase();
  return role === "admin" ? "admin" : "user";
}

function migrateWalEventV0ToV1(raw: Record<string, unknown>, nowISO: string) {
  const actorRaw = isRecord(raw.actor) ? raw.actor : {};
  const actorEmail = toTrimmedString(actorRaw.email) || toTrimmedString(raw.userEmail);
  const userEmail = toTrimmedString(raw.userEmail) || actorEmail;
  const entryId = toTrimmedString(raw.entryId ?? raw.id);
  const category = toTrimmedString(raw.category) as CategoryKey;

  if (!entryId || !category || !CATEGORY_KEYS.includes(category)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid WAL event payload",
      details: { entryId, category },
    });
  }

  const beforeRaw = isRecord(raw.before) ? raw.before : null;
  const afterRaw = isRecord(raw.after) ? raw.after : null;
  const beforeMigrated = beforeRaw ? migrateEntry(beforeRaw) : null;
  const afterMigrated = afterRaw ? migrateEntry(afterRaw) : null;

  const metaRaw = isRecord(raw.meta) ? raw.meta : null;
  const meta = metaRaw
    ? {
        reason: toTrimmedString(metaRaw.reason) || undefined,
        ip: toTrimmedString(metaRaw.ip) || undefined,
        userAgent: toTrimmedString(metaRaw.userAgent) || undefined,
        notes: toTrimmedString(metaRaw.notes) || undefined,
      }
    : undefined;

  const next: WalEvent = {
    v: WAL_EVENT_SCHEMA_VERSION,
    ts: toISO(raw.ts, nowISO),
    actor: {
      email: actorEmail,
      role: normalizeWalRole(actorRaw.role),
    },
    userEmail,
    category,
    entryId,
    action: normalizeWalAction(raw.action),
    before: beforeMigrated?.ok ? beforeMigrated.data : null,
    after: afterMigrated?.ok ? afterMigrated.data : null,
    meta,
  };

  return next as unknown as Record<string, unknown>;
}

export function migrateWalEvent(raw: unknown): Result<WalEvent> {
  try {
    if (!isRecord(raw)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid WAL event payload",
      });
    }

    const nowISO = new Date().toISOString();
    const rawVersion = toVersion(raw.v, 0);
    const migrated = runRecordMigrations(
      raw,
      rawVersion,
      WAL_EVENT_SCHEMA_VERSION,
      {
        0: migrateWalEventV0ToV1,
      },
      nowISO
    );

    const finalized = migrateWalEventV0ToV1(migrated, nowISO) as unknown as WalEvent;
    finalized.v = WAL_EVENT_SCHEMA_VERSION;
    return ok(finalized);
  } catch (error) {
    return err(normalizeError(error));
  }
}
