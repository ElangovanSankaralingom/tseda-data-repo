import "server-only";
import { safeEmailDir } from "@/lib/userStore";
import {
  DEMO_SESSION_MAX_MS,
  exitDemoMode,
  getDemoState,
} from "@/lib/demo/state";
import { listDemoUserDirs, wipeDemoUniverse, wipeOwnDemoData } from "@/lib/demo/wipe";
import { logger } from "@/lib/logger";

export type DemoCleanupResult = {
  /** Sessions force-exited because they outlived DEMO_SESSION_MAX_MS. */
  expiredSessions: number;
  /** Orphaned demo user subtrees wiped (owner no longer demo-active). */
  orphanedSubtreesWiped: number;
  /** True when nobody was left active and the whole universe was wiped. */
  universeWiped: boolean;
};

/**
 * Nightly demo-mode sweep — the ONLY contact the nightly job has with the
 * demo universe. Everything else in the nightly run (auto-archive, timers,
 * integrity, quarantine purge) executes without a demo context and therefore
 * sees the REAL universe only; demo entries never get auto-finalised,
 * auto-deleted, or timer-warned.
 *
 * The sweep is self-healing:
 * 1. Sessions older than 24h are force-exited (their data wiped) — covers
 *    "entered demo for a presentation and never tapped Exit".
 * 2. Demo subtrees whose owner is not actively in demo are wiped — covers
 *    fan-out copies created for colleagues who never entered the mode.
 * 3. When nobody remains active, the whole demo universe is wiped (feed,
 *    trash, history, caches).
 */
export async function runDemoCleanup(): Promise<DemoCleanupResult> {
  const result: DemoCleanupResult = {
    expiredSessions: 0,
    orphanedSubtreesWiped: 0,
    universeWiped: false,
  };

  // 1. Expire stale sessions (exit wipes their data).
  const state = await getDemoState();
  const now = Date.now();
  for (const [email, meta] of Object.entries(state.active)) {
    const startedAt = Date.parse(meta.activatedAt);
    if (!Number.isFinite(startedAt) || now - startedAt > DEMO_SESSION_MAX_MS) {
      await exitDemoMode(email);
      result.expiredSessions += 1;
      logger.info({ event: "demo.cleanup.expired", email });
    }
  }

  // 2. Wipe subtrees whose owner is no longer active (e.g. fan-out copies
  //    for faculty who never entered demo mode).
  const remaining = await getDemoState();
  const activeDirs = new Set(Object.keys(remaining.active).map((e) => safeEmailDir(e)));
  for (const dir of await listDemoUserDirs()) {
    if (activeDirs.has(dir)) continue;
    // Dir names ARE safeEmailDir(email) values; wipeOwnDemoData re-sanitises.
    await wipeOwnDemoData(dir);
    result.orphanedSubtreesWiped += 1;
  }

  // 3. Nobody left → clear the whole universe.
  if (activeDirs.size === 0) {
    await wipeDemoUniverse();
    result.universeWiped = true;
  }

  return result;
}
