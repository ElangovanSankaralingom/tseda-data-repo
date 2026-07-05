import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_LIST, getCategoryEntryScope } from "@/data/categoryRegistry";
import { readCategoryEntries } from "@/lib/dataStore";
import { getUniverseDataRoot, getUsersRootDir } from "@/lib/userStore";
import { recordEntryMilestonesAwaited } from "@/lib/feed/feedEvents";
import { logger } from "@/lib/logger";

/**
 * FEED BACKFILL (Elan's "Department Pulse shows no data", 2026-07):
 * milestone events are emitted at ACTION time, so entries that reached
 * activated/won/committed BEFORE the feed wiring existed never appear on
 * the wall. This sweep re-runs the milestone emitter over every stored
 * entry — deterministic event ids make it perfectly idempotent, and event
 * timestamps come from the entries themselves (honest chronology).
 *
 * Cost control: the feed GET calls this on EVERY load, and a versioned
 * marker file per universe reduces the call to a single fs.access once the
 * sweep has run. Bump MARKER whenever the emitter learns a new event kind,
 * so already-swept universes re-sweep for it (v2: entry_committed).
 *
 * Emission is AWAITED — the request that triggers the sweep must see the
 * events when it re-reads the feed (fire-and-forget races the re-read).
 */

const MARKER = ".backfilled-v2";

function markerPath(): string {
  return path.join(process.cwd(), getUniverseDataRoot(), "feed", MARKER);
}

export async function backfillFeedIfNeeded(): Promise<void> {
  try {
    // Marker present → this universe already swept for the current version.
    try {
      await fs.access(markerPath());
      return;
    } catch {
      // no marker — proceed
    }

    // getUsersRootDir() is ALREADY absolute (it joins process.cwd() itself).
    // Wrapping it in another join(cwd, …) doubled the path — the v1 sweep
    // read a nonexistent directory, found zero users, and wrote the marker:
    // the exact "Pulse still shows no data" failure. Never re-prefix it.
    const usersRoot = getUsersRootDir();
    let userDirs: string[] = [];
    try {
      userDirs = (await fs.readdir(usersRoot, { withFileTypes: true }))
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      userDirs = [];
    }

    for (const dir of userDirs) {
      // Stored dirs are sanitized emails (user_at_tce.edu) — recover the
      // email shape the milestone emitter expects.
      const email = dir.replace(/_at_/, "@");
      if (!email.includes("@")) continue;
      for (const category of CATEGORY_LIST) {
        // DLC department records never feed.
        if (getCategoryEntryScope(category) === "dlc") continue;
        try {
          const entries = await readCategoryEntries(email, category);
          for (const entry of entries) {
            await recordEntryMilestonesAwaited(email, category, entry as Record<string, unknown>);
          }
        } catch {
          // Per-category isolation: one bad store never stops the sweep.
        }
      }
    }

    await fs.mkdir(path.dirname(markerPath()), { recursive: true });
    await fs.writeFile(markerPath(), new Date().toISOString(), "utf8");
    logger.info({ event: "feed.backfill.completed", users: String(userDirs.length) });
  } catch (error) {
    logger.warn({ event: "feed.backfill.failed", message: error instanceof Error ? error.message : "unknown" });
  }
}
