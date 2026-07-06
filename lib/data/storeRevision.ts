import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { getUserStoreDir } from "@/lib/userStore";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { normalizeEmail } from "@/lib/facultyDirectory";

/**
 * PER-USER STORE REVISION (2026-07 sync strategy, Elan's ruling):
 * "a sync process that is continuously updated … rather than updating only
 * during certain stages of entry."
 *
 * A tiny monotonic stamp bumped by THE write choke point
 * (dataStore.writeCategoryStore) on every entry write/delete, no matter
 * which path performed it — engine, upload handler, jobs, fan-out, future
 * code. Derived stores (user index → dashboard summary) record the
 * revision they were built from; every reader then detects drift in O(1)
 * (one tiny file read) and self-heals by rebuilding from the live store.
 * Event-driven refreshes stay (instant), but correctness no longer DEPENDS
 * on every mutation path remembering them.
 *
 * Monotonicity: next = max(stored + 1, now) — concurrent bumps may lose an
 * increment but still land on a NEW value, so drift never masks. A failed
 * bump is best-effort (worst case: one unnecessary rebuild; the nightly
 * reconcile is the final backstop). Universe-aware via getUserStoreDir —
 * demo revisions live and die with the demo universe.
 */

const REV_FILE = "store-rev.json";

function revPath(email: string): string {
  return path.join(getUserStoreDir(normalizeEmail(email)), REV_FILE);
}

/** Current revision of a user's entry stores (0 = never written/unknown). */
export async function readStoreRevision(email: string): Promise<number> {
  try {
    const raw = JSON.parse(await fs.readFile(revPath(email), "utf8")) as { rev?: unknown };
    const rev = Number(raw?.rev);
    return Number.isFinite(rev) && rev > 0 ? rev : 0;
  } catch {
    return 0;
  }
}

/** Bump after ANY entry-store write. Returns the new revision. */
export async function bumpStoreRevision(email: string): Promise<number> {
  const current = await readStoreRevision(email);
  const next = Math.max(current + 1, Date.now());
  try {
    const filePath = revPath(email);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await atomicWriteTextFile(
      filePath,
      `${JSON.stringify({ rev: next, updatedAt: new Date().toISOString() })}\n`,
    );
  } catch {
    // Best-effort: a failed bump can only cost one unnecessary rebuild.
  }
  return next;
}
