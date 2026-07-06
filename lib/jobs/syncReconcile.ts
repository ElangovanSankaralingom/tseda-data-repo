import "server-only";

import { CATEGORY_LIST, getCategoryEntryScope } from "@/data/categoryRegistry";
import { listUsers } from "@/lib/admin/integrity";
import { rebuildUserIndex } from "@/lib/data/indexStore";
import { readCategoryEntries } from "@/lib/dataStore";
import { collectEntryMilestoneEvents } from "@/lib/feed/feedEvents";
import { syncEntryFeedEvents } from "@/lib/feed/feedStore";
import { logger } from "@/lib/logger";

/**
 * NIGHTLY SYNC RECONCILE (2026-07, Elan's continuous-sync ruling) — the
 * convergence backstop beneath the two live layers:
 *
 *   1. WRITE-TIME  — every mutation refreshes index/summary/feed/analytics
 *                    (instant, but depends on the path being wired);
 *   2. READ-TIME   — store-revision drift check in ensureUserIndex heals
 *                    the index/summary of anyone who LOADS a page;
 *   3. NIGHTLY     — this sweep: rebuild every user's index from the live
 *                    store (re-stamping the revision) and truth-sync every
 *                    entry's Department Pulse events, so even surfaces
 *                    nobody read since a drift converge within a day.
 *
 * Runs contextless → touches the REAL universe only (demo universes heal
 * through their own reads and are wiped by demoCleanup). Per-user failure
 * isolation: one bad store never stops the sweep.
 */

export type SyncReconcileResult = {
  usersSwept: number;
  indexesRebuilt: number;
  entriesReconciled: number;
  usersFailed: number;
};

export async function runSyncReconcile(): Promise<SyncReconcileResult> {
  const result: SyncReconcileResult = {
    usersSwept: 0,
    indexesRebuilt: 0,
    entriesReconciled: 0,
    usersFailed: 0,
  };

  const users = await listUsers();
  if (!users.ok) {
    logger.warn({ event: "jobs.syncReconcile.list_users_failed", code: users.error.code });
    return result;
  }

  for (const email of users.data) {
    try {
      // Index: full rebuild from the live store — also re-stamps storeRev,
      // so tomorrow's reads are O(1) hits again.
      const rebuilt = await rebuildUserIndex(email);
      if (rebuilt.ok) result.indexesRebuilt += 1;

      // Feed: the wall ends the night holding EXACTLY what each entry has
      // earned (idempotent per-entry sync — timestamps/reactions survive).
      for (const category of CATEGORY_LIST) {
        if (getCategoryEntryScope(category) === "dlc") continue;
        const entries = await readCategoryEntries(email, category);
        for (const entry of entries) {
          const record = entry as Record<string, unknown>;
          const entryId = String(record.id ?? "").trim();
          if (!entryId) continue;
          await syncEntryFeedEvents(entryId, collectEntryMilestoneEvents(email, category, record));
          result.entriesReconciled += 1;
        }
      }

      result.usersSwept += 1;
    } catch (error) {
      result.usersFailed += 1;
      logger.warn({
        event: "jobs.syncReconcile.user_failed",
        userEmail: email,
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  logger.info({
    event: "jobs.syncReconcile.completed",
    usersSwept: String(result.usersSwept),
    indexesRebuilt: String(result.indexesRebuilt),
    entriesReconciled: String(result.entriesReconciled),
    usersFailed: String(result.usersFailed),
  });
  return result;
}
