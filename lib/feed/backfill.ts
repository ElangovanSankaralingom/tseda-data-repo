import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { CATEGORY_LIST, getCategoryEntryScope } from "@/data/categoryRegistry";
import { readCategoryEntries } from "@/lib/dataStore";
import { getUniverseDataRoot, getUsersRootDir } from "@/lib/userStore";
import { recordEntryMilestones } from "@/lib/feed/feedEvents";
import { logger } from "@/lib/logger";

/**
 * FEED BACKFILL (Elan's "Department Pulse shows no data", 2026-07):
 * milestone events are emitted at ACTION time, so entries that reached
 * activated/won BEFORE the feed (or tier) wiring existed never appear on
 * the wall. This sweep re-runs recordEntryMilestones over every stored
 * entry — deterministic event ids (`streak_started:<id>`, `streak_won:<id>`)
 * make it perfectly idempotent.
 *
 * Cost control: runs only when the caller decides (feed GET sees an empty
 * feed), and a marker file per universe ensures the full scan happens at
 * most once per universe — after that, live emission keeps the feed fresh.
 */

function markerPath(): string {
  return path.join(process.cwd(), getUniverseDataRoot(), "feed", ".backfilled");
}

export async function backfillFeedIfNeeded(): Promise<void> {
  try {
    // Marker present → this universe already swept.
    try {
      await fs.access(markerPath());
      return;
    } catch {
      // no marker — proceed
    }

    const usersRoot = path.join(process.cwd(), getUsersRootDir());
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
      // email shape recordEntryMilestones expects.
      const email = dir.replace(/_at_/, "@");
      if (!email.includes("@")) continue;
      for (const category of CATEGORY_LIST) {
        // DLC department records never feed.
        if (getCategoryEntryScope(category) === "dlc") continue;
        try {
          const entries = await readCategoryEntries(email, category);
          for (const entry of entries) {
            recordEntryMilestones(email, category, entry as Record<string, unknown>);
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
