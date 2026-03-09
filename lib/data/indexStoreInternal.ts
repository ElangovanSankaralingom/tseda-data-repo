import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { readCategoryEntries } from "@/lib/dataStore";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/workflow";
import {
  migrateUserIndex,
  USER_INDEX_SCHEMA_VERSION,
} from "@/lib/migrations";
import {
  buildSearchSnapshot,
  getSearchSnapshotKey,
  type SearchSnapshot,
} from "@/lib/search/searchText";
import {
  computeCanonicalStreakSnapshot,
  sortActiveStreakEntries,
  STREAK_RULE_VERSION,
  toStreakSortAtISO,
  type StreakProgressAggregateEntry,
} from "@/lib/streakProgress";
import { ENTRY_STATUSES, type Entry, type EntryStatus } from "@/lib/types/entry";
import { getUserStoreDir } from "@/lib/userStore";
import { logger } from "@/lib/logger";

const INDEX_FILE_NAME = "index.json";
const USER_INDEX_VERSION = USER_INDEX_SCHEMA_VERSION;
const USER_INDEX_STREAK_RULE_VERSION = STREAK_RULE_VERSION;

type EntryLike = Entry & {
  id?: unknown;
  status?: unknown;
  streak?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type UserIndexActiveEntry = {
  id: string;
  categoryKey: CategoryKey;
  dueAtISO: string | null;
  sortAtISO: string | null;
};

export type UserIndexStreakByCategory = Record<CategoryKey, { activated: number; wins: number }>;

export type UserIndex = {
  version: number;
  userEmail: string;
  updatedAt: string;
  totalsByCategory: Record<CategoryKey, number>;
  countsByStatus: Record<EntryStatus, number>;
  pendingByCategory: Record<CategoryKey, number>;
  approvedByCategory: Record<CategoryKey, number>;
  lastEntryAtByCategory: Record<CategoryKey, string | null>;
  streakSnapshot: {
    ruleVersion: number;
    streakActivatedCount: number;
    streakWinsCount: number;
    byCategory: UserIndexStreakByCategory;
    activeEntries: UserIndexActiveEntry[];
    lastComputedAt: string;
  };
  searchIndexByEntryId: Record<string, SearchSnapshot>;
};

export type UserIndexDelta = {
  totalsByCategory?: Partial<Record<CategoryKey, number>>;
  countsByStatus?: Partial<Record<EntryStatus, number>>;
  pendingByCategory?: Partial<Record<CategoryKey, number>>;
  approvedByCategory?: Partial<Record<CategoryKey, number>>;
  lastEntryAtByCategory?: Partial<Record<CategoryKey, string | null>>;
};

type EntryContribution = {
  id: string;
  status: EntryStatus;
  pending: number;
  approved: number;
  sortAtISO: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toNonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.floor(value);
}

function toOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

export function toSortTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function emptyCategoryMap<T>(valueFactory: () => T) {
  return CATEGORY_KEYS.reduce<Record<CategoryKey, T>>((next, categoryKey) => {
    next[categoryKey] = valueFactory();
    return next;
  }, {} as Record<CategoryKey, T>);
}

function emptyStatusMap() {
  return ENTRY_STATUSES.reduce<Record<EntryStatus, number>>((next, status) => {
    next[status] = 0;
    return next;
  }, {} as Record<EntryStatus, number>);
}

function emptyStreakByCategory(): UserIndexStreakByCategory {
  return emptyCategoryMap(() => ({ activated: 0, wins: 0 }));
}

export function clampCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.floor(value);
}

export function createEmptyUserIndex(userEmail: string, nowISO = new Date().toISOString()): UserIndex {
  return {
    version: USER_INDEX_VERSION,
    userEmail,
    updatedAt: nowISO,
    totalsByCategory: emptyCategoryMap(() => 0),
    countsByStatus: emptyStatusMap(),
    pendingByCategory: emptyCategoryMap(() => 0),
    approvedByCategory: emptyCategoryMap(() => 0),
    lastEntryAtByCategory: emptyCategoryMap(() => null),
    streakSnapshot: {
      ruleVersion: USER_INDEX_STREAK_RULE_VERSION,
      streakActivatedCount: 0,
      streakWinsCount: 0,
      byCategory: emptyStreakByCategory(),
      activeEntries: [],
      lastComputedAt: nowISO,
    },
    searchIndexByEntryId: {},
  };
}

export function getIndexFilePath(userEmail: string) {
  return path.join(getUserStoreDir(userEmail), INDEX_FILE_NAME);
}

export function toContribution(entry: EntryLike | null): EntryContribution | null {
  if (!entry) return null;

  const id = String(entry.id ?? "").trim();
  const status = normalizeEntryStatus(entry as EntryStateLike);
  const pending = status === "EDIT_REQUESTED" ? 1 : 0;
  const approved = status === "GENERATED" || status === "EDIT_GRANTED" ? 1 : 0;

  return {
    id,
    status,
    pending,
    approved,
    sortAtISO: toStreakSortAtISO(entry),
  };
}

export function toSearchIndexSnapshot(entry: EntryLike | null, category: CategoryKey): SearchSnapshot | null {
  if (!entry) return null;
  return buildSearchSnapshot(entry as Entry, category);
}

function hydrateSearchIndexMap(raw: unknown) {
  if (!isRecord(raw)) return {} as Record<string, SearchSnapshot>;

  const next: Record<string, SearchSnapshot> = {};
  for (const value of Object.values(raw)) {
    if (!isRecord(value)) continue;
    const snapshot = value as Record<string, unknown>;
    const entryId = String(snapshot.entryId ?? "").trim();
    const categoryKey = String(snapshot.categoryKey ?? "").trim() as CategoryKey;
    const title = String(snapshot.title ?? "").trim();
    const text = String(snapshot.text ?? "").trim();
    const status = String(snapshot.status ?? "").trim() as EntryStatus;
    if (!entryId || !CATEGORY_KEYS.includes(categoryKey) || !title || !text || !status) continue;

    const key = getSearchSnapshotKey(categoryKey, entryId);
    next[key] = {
      entryId,
      categoryKey,
      title,
      text,
      status,
      updatedAtISO: toOptionalISO(snapshot.updatedAtISO),
      createdAtISO: toOptionalISO(snapshot.createdAtISO),
    };
  }

  return next;
}

function sortActiveEntries(entries: UserIndexActiveEntry[]) {
  return sortActiveStreakEntries(entries);
}

function buildStreakSnapshotFromInputs(
  entries: ReadonlyArray<StreakProgressAggregateEntry>,
  nowISO: string
): UserIndex["streakSnapshot"] {
  const summary = computeCanonicalStreakSnapshot(entries);
  return {
    ruleVersion: USER_INDEX_STREAK_RULE_VERSION,
    streakActivatedCount: summary.streakActivatedCount,
    streakWinsCount: summary.streakWinsCount,
    byCategory: CATEGORY_KEYS.reduce<UserIndexStreakByCategory>((next, category) => {
      next[category] = {
        activated: summary.byCategory[category].activated,
        wins: summary.byCategory[category].wins,
      };
      return next;
    }, {} as UserIndexStreakByCategory),
    activeEntries: sortActiveEntries(summary.activeEntries),
    lastComputedAt: nowISO,
  };
}

export function collectStreakInputs(
  entriesByCategory: ReadonlyArray<{ category: CategoryKey; entries: ReadonlyArray<unknown> }>
): StreakProgressAggregateEntry[] {
  const streakInputs: StreakProgressAggregateEntry[] = [];
  for (const { category, entries } of entriesByCategory) {
    for (const entry of entries) {
      streakInputs.push({
        ...(entry as EntryLike),
        categoryKey: category,
      });
    }
  }
  return streakInputs;
}

export function buildStreakSnapshotFromStore(
  entriesByCategory: ReadonlyArray<{ category: CategoryKey; entries: ReadonlyArray<unknown> }>,
  nowISO: string
) {
  return buildStreakSnapshotFromInputs(collectStreakInputs(entriesByCategory), nowISO);
}

export function hydrateIndex(
  raw: unknown,
  userEmail: string
): { index: UserIndex; rebuildRequired: boolean; migrated: boolean } {
  const nowISO = new Date().toISOString();
  const base = createEmptyUserIndex(userEmail, nowISO);
  const migratedResult = migrateUserIndex(raw);
  if (!migratedResult.ok || !isRecord(migratedResult.data)) {
    return { index: base, rebuildRequired: true, migrated: true };
  }

  const migratedRaw = migratedResult.data as unknown as Record<string, unknown>;
  const migrationChanged = JSON.stringify(raw) !== JSON.stringify(migratedRaw);
  const version = Number(migratedRaw.version ?? 0);
  const rebuildRequired = version !== USER_INDEX_VERSION;
  const migrated = migrationChanged || rebuildRequired;
  if (rebuildRequired) {
    return { index: base, rebuildRequired, migrated };
  }

  let changed = false;
  const index: UserIndex = {
    ...base,
    version: USER_INDEX_VERSION,
    userEmail,
    updatedAt: toOptionalISO(migratedRaw.updatedAt) ?? nowISO,
  };

  const totalsByCategory = isRecord(migratedRaw.totalsByCategory) ? migratedRaw.totalsByCategory : null;
  const pendingByCategory = isRecord(migratedRaw.pendingByCategory) ? migratedRaw.pendingByCategory : null;
  const approvedByCategory = isRecord(migratedRaw.approvedByCategory) ? migratedRaw.approvedByCategory : null;
  const lastEntryAtByCategory = isRecord(migratedRaw.lastEntryAtByCategory)
    ? migratedRaw.lastEntryAtByCategory
    : null;
  const countsByStatus = isRecord(migratedRaw.countsByStatus) ? migratedRaw.countsByStatus : null;
  const streakSnapshot = isRecord(migratedRaw.streakSnapshot) ? migratedRaw.streakSnapshot : null;
  const streakByCategory = streakSnapshot && isRecord(streakSnapshot.byCategory) ? streakSnapshot.byCategory : null;
  const activeEntriesRaw =
    streakSnapshot && Array.isArray(streakSnapshot.activeEntries) ? streakSnapshot.activeEntries : null;
  const rawSearchIndexByEntryId = isRecord(migratedRaw.searchIndexByEntryId)
    ? migratedRaw.searchIndexByEntryId
    : null;
  const searchIndexByEntryId = hydrateSearchIndexMap(rawSearchIndexByEntryId);

  if (!totalsByCategory || !pendingByCategory || !approvedByCategory || !lastEntryAtByCategory || !countsByStatus) {
    return { index: base, rebuildRequired: true, migrated: true };
  }
  if (!streakSnapshot || !streakByCategory || !activeEntriesRaw) {
    return { index: base, rebuildRequired: true, migrated: true };
  }
  const streakRuleVersion = toNonNegativeInteger(streakSnapshot.ruleVersion);
  if (streakRuleVersion !== USER_INDEX_STREAK_RULE_VERSION) {
    return { index: base, rebuildRequired: true, migrated: true };
  }

  for (const category of CATEGORY_KEYS) {
    index.totalsByCategory[category] = toNonNegativeInteger(totalsByCategory[category]);
    index.pendingByCategory[category] = toNonNegativeInteger(pendingByCategory[category]);
    index.approvedByCategory[category] = toNonNegativeInteger(approvedByCategory[category]);
    index.lastEntryAtByCategory[category] = toOptionalISO(lastEntryAtByCategory[category]);

    const streakCategoryRaw = isRecord(streakByCategory[category]) ? streakByCategory[category] : {};
    index.streakSnapshot.byCategory[category] = {
      activated: toNonNegativeInteger(streakCategoryRaw.activated),
      wins: toNonNegativeInteger(streakCategoryRaw.wins),
    };
  }

  for (const status of ENTRY_STATUSES) {
    index.countsByStatus[status] = toNonNegativeInteger(countsByStatus[status]);
  }

  index.streakSnapshot.ruleVersion = USER_INDEX_STREAK_RULE_VERSION;
  index.streakSnapshot.streakActivatedCount = toNonNegativeInteger(streakSnapshot.streakActivatedCount);
  index.streakSnapshot.streakWinsCount = toNonNegativeInteger(streakSnapshot.streakWinsCount);
  index.streakSnapshot.lastComputedAt = toOptionalISO(streakSnapshot.lastComputedAt) ?? nowISO;
  index.streakSnapshot.activeEntries = sortActiveEntries(
    activeEntriesRaw
      .map((value) => {
        if (!isRecord(value)) return null;
        const categoryKey = String(value.categoryKey ?? "") as CategoryKey;
        if (!CATEGORY_KEYS.includes(categoryKey)) return null;
        const id = String(value.id ?? "").trim();
        if (!id) return null;
        return {
          id,
          categoryKey,
          dueAtISO: toOptionalISO(value.dueAtISO),
          sortAtISO: toOptionalISO(value.sortAtISO),
        } satisfies UserIndexActiveEntry;
      })
      .filter((value): value is UserIndexActiveEntry => !!value)
  );
  index.searchIndexByEntryId = searchIndexByEntryId;
  if (!rawSearchIndexByEntryId) {
    changed = true;
  } else if (Object.keys(rawSearchIndexByEntryId).length !== Object.keys(searchIndexByEntryId).length) {
    changed = true;
  }

  if (String(migratedRaw.userEmail ?? "") !== userEmail) {
    changed = true;
  }

  return { index, rebuildRequired: false, migrated: changed || migrated };
}

export async function writeIndexFile(userEmail: string, index: UserIndex) {
  const migrated = migrateUserIndex(index);
  if (!migrated.ok) {
    throw migrated.error;
  }
  const filePath = getIndexFilePath(userEmail);
  const payload = JSON.stringify(migrated.data, null, 2);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteTextFile(filePath, payload);
  logger.info({
    event: "index.write",
    userEmail,
    count: Object.values(index.totalsByCategory).reduce((sum, value) => sum + value, 0),
    sizeBytes: Buffer.byteLength(payload),
  });
}

export async function readIndexRaw(userEmail: string): Promise<unknown | null> {
  const filePath = getIndexFilePath(userEmail);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === "ENOENT") {
      return null;
    }
    throw new AppError({
      code: "IO_ERROR",
      message: "Failed to read user index",
      cause: error,
    });
  }
}

export async function buildUserIndex(userEmail: string): Promise<UserIndex> {
  const nowISO = new Date().toISOString();
  const index = createEmptyUserIndex(userEmail, nowISO);
  const streakInputs: StreakProgressAggregateEntry[] = [];

  const results = await Promise.all(
    CATEGORY_KEYS.map(async (category) => ({
      category,
      entries: await readCategoryEntries(userEmail, category),
    }))
  );

  for (const { category, entries } of results) {
    index.totalsByCategory[category] = entries.length;

    let latestEntryAt: string | null = null;
    let latestEntryTime = Number.NEGATIVE_INFINITY;

    for (const entryValue of entries) {
      const entry = entryValue as EntryLike;
      const status = normalizeEntryStatus(entry as EntryStateLike);
      index.countsByStatus[status] += 1;
      if (status === "EDIT_REQUESTED") {
        index.pendingByCategory[category] += 1;
      }
      if (status === "GENERATED" || status === "EDIT_GRANTED") {
        index.approvedByCategory[category] += 1;
      }

      const contribution = toContribution(entry);
      if (!contribution) continue;
      const snapshot = toSearchIndexSnapshot(entry, category);
      if (snapshot) {
        index.searchIndexByEntryId[getSearchSnapshotKey(category, snapshot.entryId)] = snapshot;
      }
      streakInputs.push({
        ...(entry as EntryLike),
        categoryKey: category,
      });

      const sortAtTime = toSortTime(contribution.sortAtISO);
      if (sortAtTime !== Number.POSITIVE_INFINITY && sortAtTime > latestEntryTime) {
        latestEntryTime = sortAtTime;
        latestEntryAt = contribution.sortAtISO;
      }
    }

    index.lastEntryAtByCategory[category] = latestEntryAt;
  }

  index.streakSnapshot = buildStreakSnapshotFromInputs(streakInputs, nowISO);
  index.updatedAt = nowISO;
  return index;
}

export function cloneIndex(index: UserIndex): UserIndex {
  return {
    ...index,
    totalsByCategory: { ...index.totalsByCategory },
    countsByStatus: { ...index.countsByStatus },
    pendingByCategory: { ...index.pendingByCategory },
    approvedByCategory: { ...index.approvedByCategory },
    lastEntryAtByCategory: { ...index.lastEntryAtByCategory },
    streakSnapshot: {
      ...index.streakSnapshot,
      byCategory: CATEGORY_KEYS.reduce<UserIndexStreakByCategory>((next, categoryKey) => {
        next[categoryKey] = {
          activated: index.streakSnapshot.byCategory[categoryKey]?.activated ?? 0,
          wins: index.streakSnapshot.byCategory[categoryKey]?.wins ?? 0,
        };
        return next;
      }, {} as UserIndexStreakByCategory),
      activeEntries: index.streakSnapshot.activeEntries.slice(),
    },
    searchIndexByEntryId: Object.entries(index.searchIndexByEntryId).reduce<
      Record<string, SearchSnapshot>
    >((next, [key, value]) => {
      next[key] = { ...value };
      return next;
    }, {}),
  };
}

export function isInvalidCountMap(index: UserIndex) {
  for (const category of CATEGORY_KEYS) {
    if (index.totalsByCategory[category] < 0) return true;
    if (index.pendingByCategory[category] < 0) return true;
    if (index.approvedByCategory[category] < 0) return true;
    if (index.streakSnapshot.byCategory[category].activated < 0) return true;
    if (index.streakSnapshot.byCategory[category].wins < 0) return true;
  }
  for (const status of ENTRY_STATUSES) {
    if (index.countsByStatus[status] < 0) return true;
  }
  if (index.streakSnapshot.streakActivatedCount < 0) return true;
  if (index.streakSnapshot.streakWinsCount < 0) return true;
  return false;
}
