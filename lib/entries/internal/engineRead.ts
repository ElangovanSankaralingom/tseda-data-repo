import "server-only";

import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { isEntryLocked, normalizeEntryStatus } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntry } from "@/lib/normalize";
import { computeCanonicalStreakSnapshot, type StreakProgressAggregateEntry } from "@/lib/streakProgress";
import type { Entry } from "@/lib/types/entry";
import { logger, withTimer } from "@/lib/logger";
import { ENTRY_SCHEMAS } from "@/data/schemas";
import {
  type EntryEngineRecord,
  type EntryStreakSummary,
  type EntryLike,
  readListRaw,
  prepareEntryForWrite,
} from "./engineHelpers.ts";

/**
 * Thin compatibility wrapper retained for existing `lifecycle.ts` readers.
 * Canonical lock/status rules still live in `stateMachine.ts`.
 */
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

export async function computeStreak(
  userEmail: string
): Promise<EntryStreakSummary> {
  const normalizedOwner = normalizeEmail(userEmail);
  const entries: StreakProgressAggregateEntry[] = [];

  await withTimer("entry.streak.compute", async () => {
    for (const category of CATEGORY_KEYS) {
      const list = await readListRaw(normalizedOwner, category);
      for (const entry of list) {
        entries.push({
          ...(entry as EntryLike),
          categoryKey: category,
        });
      }
    }
  }, { userEmail: normalizedOwner });

  const aggregate = computeCanonicalStreakSnapshot(entries);
  const summary: EntryStreakSummary = {
    activated: aggregate.streakActivatedCount,
    wins: aggregate.streakWinsCount,
    byCategory: CATEGORY_KEYS.reduce<EntryStreakSummary["byCategory"]>((next, categoryKey) => {
      next[categoryKey] = {
        activated: aggregate.byCategory[categoryKey].activated,
        wins: aggregate.byCategory[categoryKey].wins,
      };
      return next;
    }, {} as EntryStreakSummary["byCategory"]),
  };

  logger.info({
    event: "entry.streak.summary",
    userEmail: normalizedOwner,
    activated: summary.activated,
    wins: summary.wins,
  });
  return summary;
}

/**
 * Thin compatibility wrapper retained for existing `lifecycle.ts` readers.
 * Canonical workflow normalization still lives in `stateMachine.ts`.
 */
export function getEntryWorkflowStatus(entry: EntryEngineRecord) {
  return normalizeEntryStatus(entry);
}

/**
 * Engine-side normalization helper for persisted records. This prepares an
 * entry for workflow-aware reads without moving workflow ownership out of
 * `stateMachine.ts`.
 */
export function normalizeEntryForWorkflow(entry: EntryEngineRecord) {
  const nowISO = new Date().toISOString();
  const category = String(entry.category ?? "").trim().toLowerCase() as CategoryKey;
  if (CATEGORY_KEYS.includes(category)) {
    return prepareEntryForWrite(entry as EntryLike, nowISO, category) as EntryEngineRecord;
  }
  return normalizeEntry(entry as Entry, undefined) as EntryEngineRecord;
}
