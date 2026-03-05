import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import { readCategoryEntries } from "@/lib/dataStore";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entryStateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isFutureDatedEntry, normalizeStreakState, status as getStreakStatus } from "@/lib/gamification";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import type { Entry, EntryStatus } from "@/lib/types/entry";
import { getUserStoreDir } from "@/lib/userStore";

const INDEX_FILE_NAME = "index.json";
const USER_INDEX_VERSION = 1;

const ENTRY_STATUS_KEYS: readonly EntryStatus[] = [
  "DRAFT",
  "PENDING_CONFIRMATION",
  "APPROVED",
  "REJECTED",
];

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
    streakActivatedCount: number;
    streakWinsCount: number;
    byCategory: UserIndexStreakByCategory;
    activeEntries: UserIndexActiveEntry[];
    lastComputedAt: string;
  };
};

export type UserIndexDelta = {
  totalsByCategory?: Partial<Record<CategoryKey, number>>;
  countsByStatus?: Partial<Record<EntryStatus, number>>;
  pendingByCategory?: Partial<Record<CategoryKey, number>>;
  approvedByCategory?: Partial<Record<CategoryKey, number>>;
  lastEntryAtByCategory?: Partial<Record<CategoryKey, string | null>>;
  streakActivatedCount?: number;
  streakWinsCount?: number;
};

type EntryContribution = {
  id: string;
  status: EntryStatus;
  pending: number;
  approved: number;
  streakActive: number;
  streakWin: number;
  dueAtISO: string | null;
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

function toSortAtISO(entry: EntryLike) {
  return toOptionalISO(entry.updatedAt) ?? toOptionalISO(entry.createdAt);
}

function toSortTime(value: string | null | undefined) {
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
  return ENTRY_STATUS_KEYS.reduce<Record<EntryStatus, number>>((next, status) => {
    next[status] = 0;
    return next;
  }, {} as Record<EntryStatus, number>);
}

function emptyStreakByCategory(): UserIndexStreakByCategory {
  return emptyCategoryMap(() => ({ activated: 0, wins: 0 }));
}

function clampCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.floor(value);
}

function createEmptyUserIndex(userEmail: string, nowISO = new Date().toISOString()): UserIndex {
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
      streakActivatedCount: 0,
      streakWinsCount: 0,
      byCategory: emptyStreakByCategory(),
      activeEntries: [],
      lastComputedAt: nowISO,
    },
  };
}

function getIndexFilePath(userEmail: string) {
  return path.join(getUserStoreDir(userEmail), INDEX_FILE_NAME);
}

function isStreakActiveEntry(entry: EntryLike) {
  const startDate = String(entry.startDate ?? "").trim();
  const endDate = String(entry.endDate ?? "").trim();
  if (!isFutureDatedEntry(startDate, endDate)) return false;
  const streak = normalizeStreakState(entry.streak);
  return getStreakStatus(streak) === "active";
}

function isStreakWinEntry(entry: EntryLike) {
  if (entry.status !== "final") return false;
  const startDate = String(entry.startDate ?? "").trim();
  const endDate = String(entry.endDate ?? "").trim();
  if (!isFutureDatedEntry(startDate, endDate)) return false;

  const streak = normalizeStreakState(entry.streak);
  if (!streak.activatedAtISO || !streak.completedAtISO || !streak.dueAtISO) return false;

  return Date.parse(streak.completedAtISO) <= Date.parse(streak.dueAtISO);
}

function toContribution(entry: EntryLike | null): EntryContribution | null {
  if (!entry) return null;

  const id = String(entry.id ?? "").trim();
  const status = normalizeEntryStatus(entry as EntryStateLike);
  const pending = status === "PENDING_CONFIRMATION" ? 1 : 0;
  const approved = status === "APPROVED" ? 1 : 0;
  const streak = normalizeStreakState(entry.streak);
  const streakActive = isStreakActiveEntry(entry) ? 1 : 0;
  const streakWin = isStreakWinEntry(entry) ? 1 : 0;

  return {
    id,
    status,
    pending,
    approved,
    streakActive,
    streakWin,
    dueAtISO: streak.dueAtISO ?? null,
    sortAtISO: toSortAtISO(entry),
  };
}

function sortActiveEntries(entries: UserIndexActiveEntry[]) {
  return entries
    .slice()
    .sort((left, right) => toSortTime(left.sortAtISO) - toSortTime(right.sortAtISO));
}

function hydrateIndex(
  raw: unknown,
  userEmail: string
): { index: UserIndex; rebuildRequired: boolean; migrated: boolean } {
  const nowISO = new Date().toISOString();
  const base = createEmptyUserIndex(userEmail, nowISO);
  if (!isRecord(raw)) {
    return { index: base, rebuildRequired: true, migrated: true };
  }

  const version = Number(raw.version ?? 0);
  const rebuildRequired = version !== USER_INDEX_VERSION;
  const migrated = rebuildRequired;
  if (rebuildRequired) {
    return { index: base, rebuildRequired, migrated };
  }

  let changed = false;
  const index: UserIndex = {
    ...base,
    version: USER_INDEX_VERSION,
    userEmail,
    updatedAt: toOptionalISO(raw.updatedAt) ?? nowISO,
  };

  const totalsByCategory = isRecord(raw.totalsByCategory) ? raw.totalsByCategory : null;
  const pendingByCategory = isRecord(raw.pendingByCategory) ? raw.pendingByCategory : null;
  const approvedByCategory = isRecord(raw.approvedByCategory) ? raw.approvedByCategory : null;
  const lastEntryAtByCategory = isRecord(raw.lastEntryAtByCategory) ? raw.lastEntryAtByCategory : null;
  const countsByStatus = isRecord(raw.countsByStatus) ? raw.countsByStatus : null;
  const streakSnapshot = isRecord(raw.streakSnapshot) ? raw.streakSnapshot : null;
  const streakByCategory = streakSnapshot && isRecord(streakSnapshot.byCategory) ? streakSnapshot.byCategory : null;
  const activeEntriesRaw =
    streakSnapshot && Array.isArray(streakSnapshot.activeEntries) ? streakSnapshot.activeEntries : null;

  if (!totalsByCategory || !pendingByCategory || !approvedByCategory || !lastEntryAtByCategory || !countsByStatus) {
    return { index: base, rebuildRequired: true, migrated: true };
  }
  if (!streakSnapshot || !streakByCategory || !activeEntriesRaw) {
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

  for (const status of ENTRY_STATUS_KEYS) {
    index.countsByStatus[status] = toNonNegativeInteger(countsByStatus[status]);
  }

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

  if (String(raw.userEmail ?? "") !== userEmail) {
    changed = true;
  }

  return { index, rebuildRequired: false, migrated: changed || migrated };
}

async function writeIndexFile(userEmail: string, index: UserIndex) {
  const filePath = getIndexFilePath(userEmail);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(index, null, 2), "utf8");
}

async function readIndexRaw(userEmail: string): Promise<unknown | null> {
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

async function buildUserIndex(userEmail: string): Promise<UserIndex> {
  const nowISO = new Date().toISOString();
  const index = createEmptyUserIndex(userEmail, nowISO);
  const activeEntries: UserIndexActiveEntry[] = [];

  for (const category of CATEGORY_KEYS) {
    const entries = await readCategoryEntries(userEmail, category);
    index.totalsByCategory[category] = entries.length;

    let latestEntryAt: string | null = null;
    let latestEntryTime = Number.NEGATIVE_INFINITY;

    for (const entryValue of entries) {
      const entry = entryValue as EntryLike;
      const status = normalizeEntryStatus(entry as EntryStateLike);
      index.countsByStatus[status] += 1;
      if (status === "PENDING_CONFIRMATION") {
        index.pendingByCategory[category] += 1;
      }
      if (status === "APPROVED") {
        index.approvedByCategory[category] += 1;
      }

      const contribution = toContribution(entry);
      if (!contribution) continue;

      const sortAtTime = toSortTime(contribution.sortAtISO);
      if (sortAtTime !== Number.POSITIVE_INFINITY && sortAtTime > latestEntryTime) {
        latestEntryTime = sortAtTime;
        latestEntryAt = contribution.sortAtISO;
      }

      if (contribution.streakActive) {
        index.streakSnapshot.streakActivatedCount += 1;
        index.streakSnapshot.byCategory[category].activated += 1;
        if (contribution.id) {
          activeEntries.push({
            id: contribution.id,
            categoryKey: category,
            dueAtISO: contribution.dueAtISO,
            sortAtISO: contribution.sortAtISO,
          });
        }
      }

      if (contribution.streakWin) {
        index.streakSnapshot.streakWinsCount += 1;
        index.streakSnapshot.byCategory[category].wins += 1;
      }
    }

    index.lastEntryAtByCategory[category] = latestEntryAt;
  }

  index.streakSnapshot.activeEntries = sortActiveEntries(activeEntries);
  index.streakSnapshot.lastComputedAt = nowISO;
  index.updatedAt = nowISO;
  return index;
}

function cloneIndex(index: UserIndex): UserIndex {
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
  };
}

export async function getUserIndex(userEmail: string): Promise<Result<UserIndex | null>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) return null;

    const raw = await readIndexRaw(normalizedEmail);
    if (raw === null) return null;
    const hydrated = hydrateIndex(raw, normalizedEmail);
    if (hydrated.rebuildRequired) {
      return null;
    }
    return hydrated.index;
  }, { context: "indexStore.getUserIndex" });
}

export async function rebuildUserIndex(userEmail: string): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid email" });
    }

    const rebuilt = await buildUserIndex(normalizedEmail);
    await writeIndexFile(normalizedEmail, rebuilt);
    return rebuilt;
  }, { context: "indexStore.rebuildUserIndex" });
}

export async function ensureUserIndex(userEmail: string): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid email" });
    }

    const raw = await readIndexRaw(normalizedEmail);
    if (raw === null) {
      const rebuilt = await buildUserIndex(normalizedEmail);
      await writeIndexFile(normalizedEmail, rebuilt);
      return rebuilt;
    }

    const hydrated = hydrateIndex(raw, normalizedEmail);
    if (hydrated.rebuildRequired) {
      const rebuilt = await buildUserIndex(normalizedEmail);
      await writeIndexFile(normalizedEmail, rebuilt);
      return rebuilt;
    }

    if (hydrated.migrated) {
      await writeIndexFile(normalizedEmail, hydrated.index);
    }
    return hydrated.index;
  }, { context: "indexStore.ensureUserIndex" });
}

export async function applyIndexDelta(
  userEmail: string,
  delta: UserIndexDelta
): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const ensured = await ensureUserIndex(userEmail);
    if (!ensured.ok) {
      throw ensured.error;
    }

    const next = cloneIndex(ensured.data);
    for (const category of CATEGORY_KEYS) {
      const totalDelta = delta.totalsByCategory?.[category] ?? 0;
      const pendingDelta = delta.pendingByCategory?.[category] ?? 0;
      const approvedDelta = delta.approvedByCategory?.[category] ?? 0;

      next.totalsByCategory[category] = clampCount(next.totalsByCategory[category] + totalDelta);
      next.pendingByCategory[category] = clampCount(next.pendingByCategory[category] + pendingDelta);
      next.approvedByCategory[category] = clampCount(next.approvedByCategory[category] + approvedDelta);

      if (Object.prototype.hasOwnProperty.call(delta.lastEntryAtByCategory ?? {}, category)) {
        next.lastEntryAtByCategory[category] = delta.lastEntryAtByCategory?.[category] ?? null;
      }
    }

    for (const status of ENTRY_STATUS_KEYS) {
      const statusDelta = delta.countsByStatus?.[status] ?? 0;
      next.countsByStatus[status] = clampCount(next.countsByStatus[status] + statusDelta);
    }

    if (typeof delta.streakActivatedCount === "number") {
      next.streakSnapshot.streakActivatedCount = clampCount(
        next.streakSnapshot.streakActivatedCount + delta.streakActivatedCount
      );
    }
    if (typeof delta.streakWinsCount === "number") {
      next.streakSnapshot.streakWinsCount = clampCount(
        next.streakSnapshot.streakWinsCount + delta.streakWinsCount
      );
    }

    next.updatedAt = new Date().toISOString();
    await writeIndexFile(normalizeEmail(userEmail), next);
    return next;
  }, { context: "indexStore.applyIndexDelta" });
}

function isInvalidCountMap(index: UserIndex) {
  for (const category of CATEGORY_KEYS) {
    if (index.totalsByCategory[category] < 0) return true;
    if (index.pendingByCategory[category] < 0) return true;
    if (index.approvedByCategory[category] < 0) return true;
    if (index.streakSnapshot.byCategory[category].activated < 0) return true;
    if (index.streakSnapshot.byCategory[category].wins < 0) return true;
  }
  for (const status of ENTRY_STATUS_KEYS) {
    if (index.countsByStatus[status] < 0) return true;
  }
  if (index.streakSnapshot.streakActivatedCount < 0) return true;
  if (index.streakSnapshot.streakWinsCount < 0) return true;
  return false;
}

export async function updateIndexForEntryMutation(
  userEmail: string,
  category: CategoryKey,
  beforeEntry: Entry | null,
  afterEntry: Entry | null
): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid email" });
    }

    const current = await getUserIndex(normalizedEmail);
    if (!current.ok) {
      throw current.error;
    }

    const nowISO = new Date().toISOString();
    if (current.data === null) {
      const rebuilt = await buildUserIndex(normalizedEmail);
      await writeIndexFile(normalizedEmail, rebuilt);
      return rebuilt;
    }

    const next = cloneIndex(current.data);
    const before = toContribution(beforeEntry as EntryLike | null);
    const after = toContribution(afterEntry as EntryLike | null);

    if (!before && !after) {
      return next;
    }

    const currentLastForCategory = next.lastEntryAtByCategory[category];
    const requiresRebuildForLastEntry =
      !!before?.sortAtISO &&
      currentLastForCategory === before.sortAtISO &&
      (!after?.sortAtISO || toSortTime(after.sortAtISO) < toSortTime(before.sortAtISO));

    if (requiresRebuildForLastEntry) {
      const rebuilt = await buildUserIndex(normalizedEmail);
      await writeIndexFile(normalizedEmail, rebuilt);
      return rebuilt;
    }

    if (before) {
      next.totalsByCategory[category] -= 1;
      next.countsByStatus[before.status] -= 1;
      next.pendingByCategory[category] -= before.pending;
      next.approvedByCategory[category] -= before.approved;
      next.streakSnapshot.streakActivatedCount -= before.streakActive;
      next.streakSnapshot.streakWinsCount -= before.streakWin;
      next.streakSnapshot.byCategory[category].activated -= before.streakActive;
      next.streakSnapshot.byCategory[category].wins -= before.streakWin;
    }

    if (after) {
      next.totalsByCategory[category] += 1;
      next.countsByStatus[after.status] += 1;
      next.pendingByCategory[category] += after.pending;
      next.approvedByCategory[category] += after.approved;
      next.streakSnapshot.streakActivatedCount += after.streakActive;
      next.streakSnapshot.streakWinsCount += after.streakWin;
      next.streakSnapshot.byCategory[category].activated += after.streakActive;
      next.streakSnapshot.byCategory[category].wins += after.streakWin;
    }

    next.streakSnapshot.activeEntries = next.streakSnapshot.activeEntries.filter((entry) => {
      if (entry.categoryKey !== category) return true;
      if (before?.id && entry.id === before.id) return false;
      if (after?.id && entry.id === after.id) return false;
      return true;
    });

    if (after?.streakActive && after.id) {
      next.streakSnapshot.activeEntries.push({
        id: after.id,
        categoryKey: category,
        dueAtISO: after.dueAtISO,
        sortAtISO: after.sortAtISO,
      });
    }

    next.streakSnapshot.activeEntries = sortActiveEntries(next.streakSnapshot.activeEntries);

    const currentLastTime = toSortTime(next.lastEntryAtByCategory[category]);
    const afterTime = toSortTime(after?.sortAtISO);
    if (after?.sortAtISO && afterTime < Number.POSITIVE_INFINITY && afterTime >= currentLastTime) {
      next.lastEntryAtByCategory[category] = after.sortAtISO;
    }

    if (isInvalidCountMap(next)) {
      const rebuilt = await buildUserIndex(normalizedEmail);
      await writeIndexFile(normalizedEmail, rebuilt);
      return rebuilt;
    }

    next.updatedAt = nowISO;
    next.streakSnapshot.lastComputedAt = nowISO;
    await writeIndexFile(normalizedEmail, next);
    return next;
  }, { context: "indexStore.updateIndexForEntryMutation" });
}
