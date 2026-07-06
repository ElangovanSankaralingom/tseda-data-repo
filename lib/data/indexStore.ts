import "server-only";

/**
 * User index store: public API for reading, writing, and updating user indices.
 *
 * Internal helpers (types, hydration, build, clone, I/O) live in ./indexStoreInternal.ts
 */
import { CATEGORY_KEYS } from "@/lib/categories";
import { withUserDataLock } from "@/lib/data/locks";
import { readCategoryEntries } from "@/lib/dataStore";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import { getSearchSnapshotKey } from "@/lib/search/searchText";
import { readStoreRevision } from "@/lib/data/storeRevision";
import { type Entry } from "@/lib/types/entry";
import { logger } from "@/lib/logger";
import {
  buildUserIndex,
  buildStreakSnapshotFromStore,
  cloneIndex,
  hydrateIndex,
  isInvalidCountMap,
  readIndexRaw,
  toContribution,
  toSearchIndexSnapshot,
  toSortTime,
  writeIndexFile,
  type UserIndex,
} from "./indexStoreInternal";

// Re-export types for consumers
export type {
  UserIndex,
  UserIndexActiveEntry,
  UserIndexDelta,
  UserIndexStreakByCategory,
} from "./indexStoreInternal";

// ---------------------------------------------------------------------------
// getUserIndex
// ---------------------------------------------------------------------------

export async function getUserIndex(userEmail: string): Promise<Result<UserIndex | null>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) return null;

    const raw = await readIndexRaw(normalizedEmail);
    if (raw === null) return null;
    const hydrated = hydrateIndex(raw, normalizedEmail);
    if (hydrated.rebuildRequired) {
      logger.warn({
        event: "index.read.rebuild-required",
        userEmail: normalizedEmail,
      });
      return null;
    }
    logger.debug({
      event: "index.read",
      userEmail: normalizedEmail,
      count: Object.values(hydrated.index.totalsByCategory).reduce((sum, value) => sum + value, 0),
    });
    return hydrated.index;
  }, { context: "indexStore.getUserIndex" });
}

// ---------------------------------------------------------------------------
// rebuildUserIndex
// ---------------------------------------------------------------------------

export async function rebuildUserIndex(userEmail: string): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid email" });
    }
    return withUserDataLock(normalizedEmail, async () => {
      const rebuilt = await buildUserIndex(normalizedEmail);
      await writeIndexFile(normalizedEmail, rebuilt);
      logger.info({
        event: "index.rebuild",
        userEmail: normalizedEmail,
        count: Object.values(rebuilt.totalsByCategory).reduce((sum, value) => sum + value, 0),
      });
      return rebuilt;
    });
  }, { context: "indexStore.rebuildUserIndex" });
}

// ---------------------------------------------------------------------------
// ensureUserIndex
// ---------------------------------------------------------------------------

export async function ensureUserIndex(userEmail: string): Promise<Result<UserIndex>> {
  return safeAction(async () => {
    const normalizedEmail = normalizeEmail(userEmail);
    if (!normalizedEmail) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Invalid email" });
    }
    return withUserDataLock(normalizedEmail, async () => {
      const raw = await readIndexRaw(normalizedEmail);
      if (raw === null) {
        const rebuilt = await buildUserIndex(normalizedEmail);
        await writeIndexFile(normalizedEmail, rebuilt);
        logger.info({
          event: "index.ensure.rebuilt-missing",
          userEmail: normalizedEmail,
          count: Object.values(rebuilt.totalsByCategory).reduce((sum, value) => sum + value, 0),
        });
        return rebuilt;
      }

      const hydrated = hydrateIndex(raw, normalizedEmail);
      if (hydrated.rebuildRequired) {
        const rebuilt = await buildUserIndex(normalizedEmail);
        await writeIndexFile(normalizedEmail, rebuilt);
        logger.info({
          event: "index.ensure.rebuilt-invalid",
          userEmail: normalizedEmail,
          count: Object.values(rebuilt.totalsByCategory).reduce((sum, value) => sum + value, 0),
        });
        return rebuilt;
      }

      // CONTINUOUS SYNC (2026-07, Elan's ruling): the index records the
      // store revision it was built from; every read compares it against
      // the store's CURRENT revision (one tiny file read). Any write that
      // slipped past the event-driven refresh — a forgotten call site, an
      // out-of-band edit, a restored backup — heals right here, on read,
      // instead of waiting for the next mutation.
      const currentRev = await readStoreRevision(normalizedEmail);
      if (hydrated.index.storeRev !== currentRev) {
        const rebuilt = await buildUserIndex(normalizedEmail);
        await writeIndexFile(normalizedEmail, rebuilt);
        logger.warn({
          event: "index.ensure.rebuilt-stale-rev",
          userEmail: normalizedEmail,
          indexRev: String(hydrated.index.storeRev),
          storeRev: String(currentRev),
        });
        return rebuilt;
      }

      if (hydrated.migrated) {
        await writeIndexFile(normalizedEmail, hydrated.index);
        logger.info({
          event: "index.ensure.migrated",
          userEmail: normalizedEmail,
        });
      }
      logger.debug({
        event: "index.ensure.hit",
        userEmail: normalizedEmail,
        count: Object.values(hydrated.index.totalsByCategory).reduce((sum, value) => sum + value, 0),
      });
      return hydrated.index;
    });
  }, { context: "indexStore.ensureUserIndex" });
}

// ---------------------------------------------------------------------------
// updateIndexForEntryMutation
// ---------------------------------------------------------------------------

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
    return withUserDataLock(normalizedEmail, async () => {
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

      // Load all category entries once for streak computation (avoids redundant reads)
      const allCategoryEntries = await Promise.all(
        CATEGORY_KEYS.map(async (cat) => ({
          category: cat,
          entries: await readCategoryEntries(normalizedEmail, cat),
        }))
      );

      const next = cloneIndex(current.data);
      const before = toContribution(beforeEntry as Record<string, unknown> | null);
      const after = toContribution(afterEntry as Record<string, unknown> | null);
      const beforeSnapshot = toSearchIndexSnapshot(beforeEntry as Record<string, unknown> | null, category);
      const afterSnapshot = toSearchIndexSnapshot(afterEntry as Record<string, unknown> | null, category);

      if (!before && !after) {
        logger.debug({
          event: "index.entryMutation.noop",
          userEmail: normalizedEmail,
          category,
        });
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
        logger.warn({
          event: "index.entryMutation.rebuild-last-entry",
          userEmail: normalizedEmail,
          category,
        });
        return rebuilt;
      }

      if (before) {
        next.totalsByCategory[category] -= 1;
        next.countsByStatus[before.status] -= 1;
        next.pendingByCategory[category] -= before.pending;
        next.approvedByCategory[category] -= before.approved;
      }

      if (after) {
        next.totalsByCategory[category] += 1;
        next.countsByStatus[after.status] += 1;
        next.pendingByCategory[category] += after.pending;
        next.approvedByCategory[category] += after.approved;
      }

      if (beforeSnapshot) {
        delete next.searchIndexByEntryId[getSearchSnapshotKey(category, beforeSnapshot.entryId)];
      } else if (before?.id) {
        delete next.searchIndexByEntryId[getSearchSnapshotKey(category, before.id)];
      }

      if (afterSnapshot) {
        next.searchIndexByEntryId[getSearchSnapshotKey(category, afterSnapshot.entryId)] = afterSnapshot;
      }

      const currentLastTime = toSortTime(next.lastEntryAtByCategory[category]);
      const afterTime = toSortTime(after?.sortAtISO);
      if (after?.sortAtISO && afterTime < Number.POSITIVE_INFINITY && afterTime >= currentLastTime) {
        next.lastEntryAtByCategory[category] = after.sortAtISO;
      }

      next.streakSnapshot = buildStreakSnapshotFromStore(allCategoryEntries, nowISO);

      if (isInvalidCountMap(next)) {
        const rebuilt = await buildUserIndex(normalizedEmail);
        await writeIndexFile(normalizedEmail, rebuilt);
        logger.warn({
          event: "index.entryMutation.rebuild-invalid-counts",
          userEmail: normalizedEmail,
          category,
        });
        return rebuilt;
      }

      next.updatedAt = nowISO;
      // Stamp the revision the store is at NOW (the entry write that
      // triggered this refresh already bumped it) — continuous-sync check.
      next.storeRev = await readStoreRevision(normalizedEmail);
      await writeIndexFile(normalizedEmail, next);
      logger.info({
        event: "index.entryMutation.applied",
        userEmail: normalizedEmail,
        category,
        count: next.totalsByCategory[category],
        beforeStatus: before?.status ?? undefined,
        status: after?.status ?? undefined,
      });
      return next;
    });
  }, { context: "indexStore.updateIndexForEntryMutation" });
}
