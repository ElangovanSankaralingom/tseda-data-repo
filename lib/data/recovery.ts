import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { UserIndex, UserIndexActiveEntry } from "@/lib/data/indexStore";
import { readEvents, type WalEvent } from "@/lib/data/wal";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entryStateMachine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isFutureDatedEntry, normalizeStreakState, status as getStreakStatus } from "@/lib/gamification";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
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

function toOptionalISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : trimmed;
}

function toSortTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function toSortAtISO(entry: EntryLike) {
  return toOptionalISO(entry.updatedAt) ?? toOptionalISO(entry.createdAt);
}

function emptyCategoryMap<T>(valueFactory: () => T) {
  return CATEGORY_KEYS.reduce<Record<CategoryKey, T>>((next, categoryKey) => {
    next[categoryKey] = valueFactory();
    return next;
  }, {} as Record<CategoryKey, T>);
}

function createEmptyIndex(userEmail: string, nowISO = new Date().toISOString()): UserIndex {
  return {
    version: 1,
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
      streakActivatedCount: 0,
      streakWinsCount: 0,
      byCategory: emptyCategoryMap(() => ({ activated: 0, wins: 0 })),
      activeEntries: [],
      lastComputedAt: nowISO,
    },
  };
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
  const activeEntries: UserIndexActiveEntry[] = [];

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

      const sortAt = toSortAtISO(entry);
      const sortTime = toSortTime(sortAt);
      if (sortAt && sortTime > latestTime && sortTime < Number.POSITIVE_INFINITY) {
        latestTime = sortTime;
        latestAt = sortAt;
      }

      const entryId = String(entry.id ?? "").trim();
      const streak = normalizeStreakState(entry.streak);
      if (isStreakActiveEntry(entry)) {
        index.streakSnapshot.streakActivatedCount += 1;
        index.streakSnapshot.byCategory[category].activated += 1;
        if (entryId) {
          activeEntries.push({
            id: entryId,
            categoryKey: category,
            dueAtISO: streak.dueAtISO ?? null,
            sortAtISO: sortAt,
          });
        }
      }
      if (isStreakWinEntry(entry)) {
        index.streakSnapshot.streakWinsCount += 1;
        index.streakSnapshot.byCategory[category].wins += 1;
      }
    }

    index.lastEntryAtByCategory[category] = latestAt;
  }

  index.streakSnapshot.activeEntries = activeEntries.sort(
    (left, right) => toSortTime(left.sortAtISO) - toSortTime(right.sortAtISO)
  );
  index.streakSnapshot.lastComputedAt = nowISO;
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
