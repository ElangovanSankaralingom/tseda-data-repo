import "server-only";
import { withLock } from "@/lib/data/locks";
import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { getDataRoot } from "@/lib/userStore";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isMasterAdmin } from "@/lib/admin/roles";
import { isFacultyAllowed } from "@/lib/admin/facultyRegistry";
import { wipeOwnDemoData, wipeDemoUniverse } from "@/lib/demo/wipe";
import { logger } from "@/lib/logger";

/**
 * DEMO MODE — participation state (SHARED store, never universe-forked).
 *
 * Who may use demo mode: the master admins always, plus faculty the master
 * admin assigns to the roster. Who is IN demo mode right now: the `active`
 * map. Lives at `<dataRoot>/demo-mode.json` — deliberately OUTSIDE
 * `<dataRoot>/demo/`, so wiping the universe never wipes the switch.
 */

const STATE_VERSION = 1;

/** A demo session older than this is force-exited (and wiped) by the nightly
 *  sweep — covers "toggled demo and never came back". */
export const DEMO_SESSION_MAX_MS = 24 * 60 * 60 * 1000;

export type DemoState = {
  version: number;
  roster: string[];
  active: Record<string, { activatedAt: string }>;
};

function statePath(): string {
  return path.join(process.cwd(), getDataRoot(), "demo-mode.json");
}

// Checked on every request by demoAware() — short-TTL cache, write-through.
let cachedState: DemoState | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5_000;

function emptyState(): DemoState {
  return { version: STATE_VERSION, roster: [], active: {} };
}

async function readState(): Promise<DemoState> {
  if (cachedState && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedState;
  }
  try {
    const raw = await fs.readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as DemoState;
    if (parsed && Array.isArray(parsed.roster) && parsed.active && typeof parsed.active === "object") {
      cachedState = parsed;
      cacheLoadedAt = Date.now();
      return parsed;
    }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== "ENOENT") {
      logger.warn({ event: "demo.state.read.error", error: String(error) });
    }
  }
  cachedState = emptyState();
  cacheLoadedAt = Date.now();
  return cachedState;
}

async function writeState(state: DemoState): Promise<void> {
  await atomicWriteTextFile(statePath(), JSON.stringify(state, null, 2));
  cachedState = state;
  cacheLoadedAt = Date.now();
}

/** Test hook: drop the in-memory cache (sandboxed data roots). */
export function resetDemoStateCache(): void {
  cachedState = null;
  cacheLoadedAt = 0;
}

/** May this user use demo mode at all? Master admins always; others only
 *  when assigned by the master admin. */
export async function isDemoParticipant(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isMasterAdmin(normalized)) return true;
  const state = await readState();
  return state.roster.includes(normalized);
}

/** Is this user in demo mode right now? */
export async function isDemoActive(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const state = await readState();
  return Boolean(state.active[normalized]);
}

export async function getDemoState(): Promise<DemoState> {
  const state = await readState();
  return { ...state, roster: [...state.roster], active: { ...state.active } };
}

/** Enter demo mode. Rejects non-participants — server-side, never trusts the
 *  client. Entering is non-destructive (any prior demo data for this user
 *  was already wiped on their last exit / by the nightly sweep). */
export async function enterDemoMode(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!(await isDemoParticipant(normalized))) {
    throw new Error("Not permitted to use demo mode");
  }
  // Locked RMW (2026-07 concurrency audit): a lost activation would leave a
  // user believing they are in demo while their requests hit REAL data.
  await withLock("demo.state", async () => {
  const state = await readState();
  if (state.active[normalized]) return;
  const next: DemoState = {
    ...state,
    active: { ...state.active, [normalized]: { activatedAt: new Date().toISOString() } },
  };
  await writeState(next);
  logger.info({ event: "demo.enter", email: normalized });
  });
}

/** Exit demo mode: deactivate, wipe the user's demo data, and if nobody is
 *  left in the mode, wipe the entire demo universe (feed, trash, caches). */
export async function exitDemoMode(email: string): Promise<void> {
  const normalized = normalizeEmail(email);
  await withLock("demo.state", async () => {
    const state = await readState();
    if (!state.active[normalized]) return;
    const active = { ...state.active };
    delete active[normalized];
    await writeState({ ...state, active });
    await wipeOwnDemoData(normalized);
    if (Object.keys(active).length === 0) {
      await wipeDemoUniverse();
    }
    logger.info({ event: "demo.exit", email: normalized });
  });
}

/** Replace the assignment roster (master admin action). Faculty removed from
 *  the roster while active are exited — and their demo data wiped — so a
 *  revoked permission takes effect immediately. */
export async function setDemoRoster(emails: string[], actorEmail: string): Promise<DemoState> {
  const roster = Array.from(
    new Set(
      emails
        .map((e) => normalizeEmail(e))
        .filter((e) => e && e !== normalizeEmail(actorEmail) && isFacultyAllowed(e)),
    ),
  ).sort();
  return withLock("demo.state", async () => {
    const state = await readState();
    const removedActive = Object.keys(state.active).filter(
      (email) => !roster.includes(email) && !isMasterAdmin(email),
    );
    await writeState({ ...state, roster });
    for (const email of removedActive) {
      await exitDemoMode(email); // re-entrant: we already hold demo.state
    }
    logger.info({ event: "demo.roster.set", actor: normalizeEmail(actorEmail), count: roster.length });
    return getDemoState();
  });
}
