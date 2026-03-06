import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { UserIndex } from "@/lib/data/indexStore";
import { readEvents, type WalEvent } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { USER_INDEX_SCHEMA_VERSION } from "@/lib/migrations";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { buildSearchSnapshot, getSearchSnapshotKey } from "@/lib/search/searchText";
import {
  computeCanonicalStreakSnapshot,
  STREAK_RULE_VERSION,
  toStreakSortAtISO,
  type StreakProgressAggregateEntry,
} from "@/lib/streakProgress";
import type { Entry } from "@/lib/types/entry";
import { getUserStoreDir } from "@/lib/userStore";

type EntryLike = Entry & {
  id?: unknown;
  status?: unknown;
  streak?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

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

function createEmptyIndex(userEmail: string, nowISO = new Date().toISOString()): UserIndex {
  return {
    version: USER_INDEX_SCHEMA_VERSION,
    userEmail,
    updatedAt: nowISO,
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
      ruleVersion: STREAK_RULE_VERSION,
      streakActivatedCount: 0,
      streakWinsCount: 0,
      byCategory: emptyCategoryMap(() => ({ activated: 0, wins: 0 })),
      activeEntries: [],
      lastComputedAt: nowISO,
    },
    searchIndexByEntryId: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function applyEvent(
  state: Map<CategoryKey, Map<string, Entry>>,
  event: WalEvent
) {
  const category = event.category;
  if (!CATEGORY_KEYS.includes(category)) return;

  const categoryEntries = state.get(category) ?? new Map<string, Entry>();
  state.set(category, categoryEntries);

  const id = String(event.entryId ?? "").trim();
  if (!id) return;

  if (isRecord(event.after)) {
    categoryEntries.set(id, event.after as Entry);
    return;
  }

  categoryEntries.delete(id);
}

function buildIndexFromState(userEmail: string, state: Map<CategoryKey, Map<string, Entry>>) {
  const nowISO = new Date().toISOString();
  const index = createEmptyIndex(userEmail, nowISO);
  const streakInputs: StreakProgressAggregateEntry[] = [];

  for (const category of CATEGORY_KEYS) {
    const entriesMap = state.get(category) ?? new Map<string, Entry>();
    const entries = [...entriesMap.values()];
    index.totalsByCategory[category] = entries.length;

    let latestAt: string | null = null;
    let latestTime = Number.NEGATIVE_INFINITY;

    for (const value of entries) {
      const entry = value as EntryLike;
      const status = normalizeEntryStatus(entry as EntryStateLike);
      index.countsByStatus[status] += 1;
      if (status === "PENDING_CONFIRMATION") index.pendingByCategory[category] += 1;
      if (status === "APPROVED") index.approvedByCategory[category] += 1;
      const snapshot = buildSearchSnapshot(entry as Entry, category);
      if (snapshot) {
        index.searchIndexByEntryId[getSearchSnapshotKey(category, snapshot.entryId)] = snapshot;
      }
      streakInputs.push({
        ...(entry as EntryLike),
        categoryKey: category,
      });

      const sortAtISO = toStreakSortAtISO(entry);
      const sortTime = toSortTime(sortAtISO);
      if (sortAtISO && sortTime > latestTime && sortTime < Number.POSITIVE_INFINITY) {
        latestTime = sortTime;
        latestAt = sortAtISO;
      }
    }

    index.lastEntryAtByCategory[category] = latestAt;
  }

  const streakSummary = computeCanonicalStreakSnapshot(streakInputs);
  index.streakSnapshot = {
    ruleVersion: STREAK_RULE_VERSION,
    streakActivatedCount: streakSummary.streakActivatedCount,
    streakWinsCount: streakSummary.streakWinsCount,
    byCategory: CATEGORY_KEYS.reduce<UserIndex["streakSnapshot"]["byCategory"]>((next, category) => {
      next[category] = {
        activated: streakSummary.byCategory[category].activated,
        wins: streakSummary.byCategory[category].wins,
      };
      return next;
    }, {} as UserIndex["streakSnapshot"]["byCategory"]),
    activeEntries: streakSummary.activeEntries.slice(),
    lastComputedAt: nowISO,
  };
  index.updatedAt = nowISO;
  return index;
}

async function writeIndex(userEmail: string, index: UserIndex) {
  const filePath = path.join(getUserStoreDir(userEmail), "index.json");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(index, null, 2), "utf8");
}

export async function rebuildUserIndexFromWal(userEmail: string): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid email" });
    }

    const eventsResult = await readEvents(normalizedEmail);
    if (!eventsResult.ok) {
      throw eventsResult.error;
    }

    const events = eventsResult.data
      .slice()
      .sort((left, right) => Date.parse(left.ts) - Date.parse(right.ts));
    const state = new Map<CategoryKey, Map<string, Entry>>();
    events.forEach((event) => applyEvent(state, event));

    const index = buildIndexFromState(normalizedEmail, state);
    await writeIndex(normalizedEmail, index);
    return index;
  }, { context: "recovery.rebuildUserIndexFromWal" });
}
