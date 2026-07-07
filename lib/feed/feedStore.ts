import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { withLock } from "@/lib/data/locks";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getUniverseDataRoot } from "@/lib/userStore";

/**
 * Department activity feed — a shared, append-only stream of *milestone* events
 * (streak started / won / completion milestones). Deliberately milestone-only:
 * no raw entry data is broadcast. Reactions are stored per event.
 *
 * Storage: a single JSON file with deterministic event IDs, so emitting the same
 * milestone twice is idempotent (dedup on append). All writes go through a lock.
 */

export const FEED_REACTIONS = ["like", "fire", "celebrate", "clap"] as const;
export type FeedReaction = (typeof FEED_REACTIONS)[number];

export type FeedEventType = "streak_started" | "streak_won" | "milestone" | "entry_committed";

export type FeedEvent = {
  id: string;
  type: FeedEventType;
  actorEmail: string;
  categoryKey: string | null;
  /** For "milestone" events: the win-count threshold reached (e.g. 5, 10, 25). */
  milestone: number | null;
  /** First names of collaborators on the underlying entry ("with X & Y"). */
  withNames: string[];
  /** Streak tier for "streak_won": GOLD (permission flow) / SILVER (record). */
  tier: "gold" | "silver" | null;
  createdAt: string;
  reactions: Record<FeedReaction, string[]>;
};

export type NewFeedEvent = {
  id: string;
  type: FeedEventType;
  actorEmail: string;
  categoryKey?: string | null;
  milestone?: number | null;
  withNames?: string[];
  tier?: "gold" | "silver" | null;
  createdAt?: string;
};

type FeedConfig = { version: number; events: FeedEvent[]; suppressedIds: string[] };

const CONFIG_VERSION = 1 as const;
const MAX_FEED_EVENTS = 200;
/** Moderation tombstones kept so reconcile sweeps never resurrect a card a
 *  master admin removed on purpose. */
const MAX_SUPPRESSED_IDS = 500;
const FEED_LOCK_KEY = "feed.activity";

// Universe-aware: demo-mode milestones land in the demo feed, so the real
// Celebration Wall never celebrates practice entries.
function feedPath() {
  return path.join(process.cwd(), getUniverseDataRoot(), "feed", "activity.json");
}

function emptyReactions(): Record<FeedReaction, string[]> {
  return { like: [], fire: [], celebrate: [], clap: [] };
}

function isReaction(value: unknown): value is FeedReaction {
  return typeof value === "string" && (FEED_REACTIONS as readonly string[]).includes(value);
}

function normalizeEvent(raw: unknown): FeedEvent | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!id) return null;
  const type = r.type;
  if (type !== "streak_started" && type !== "streak_won" && type !== "milestone" && type !== "entry_committed") return null;
  const actorEmail = typeof r.actorEmail === "string" ? normalizeEmail(r.actorEmail) : "";
  if (!actorEmail) return null;
  const createdAt = typeof r.createdAt === "string" && r.createdAt.trim() ? r.createdAt : new Date().toISOString();

  const reactions = emptyReactions();
  if (r.reactions && typeof r.reactions === "object") {
    for (const [key, list] of Object.entries(r.reactions as Record<string, unknown>)) {
      if (!isReaction(key) || !Array.isArray(list)) continue;
      const seen = new Set<string>();
      for (const e of list) {
        if (typeof e !== "string") continue;
        const em = normalizeEmail(e);
        if (em && !seen.has(em)) {
          seen.add(em);
          reactions[key].push(em);
        }
      }
    }
  }

  return {
    id,
    type,
    actorEmail,
    categoryKey: typeof r.categoryKey === "string" ? r.categoryKey : null,
    milestone: typeof r.milestone === "number" && Number.isFinite(r.milestone) ? r.milestone : null,
    withNames: Array.isArray(r.withNames)
      ? (r.withNames as unknown[])
          .filter((v): v is string => typeof v === "string" && !!v.trim())
          .map((v) => v.trim())
          .slice(0, 4)
      : [],
    tier: r.tier === "gold" || r.tier === "silver" ? r.tier : null,
    createdAt,
    reactions,
  };
}

function sanitize(raw: unknown): FeedConfig {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const byId = new Map<string, FeedEvent>();
  if (Array.isArray(r.events)) {
    for (const e of r.events) {
      const n = normalizeEvent(e);
      if (n && !byId.has(n.id)) byId.set(n.id, n);
    }
  }
  const events = Array.from(byId.values())
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, MAX_FEED_EVENTS);
  const suppressedIds = Array.isArray(r.suppressedIds)
    ? (r.suppressedIds as unknown[])
        .filter((v): v is string => typeof v === "string" && !!v.trim())
        .slice(0, MAX_SUPPRESSED_IDS)
    : [];
  return { version: CONFIG_VERSION, events, suppressedIds };
}

async function readConfig(): Promise<FeedConfig> {
  try {
    const raw = await fs.readFile(feedPath(), "utf8");
    return sanitize(raw.trim() ? JSON.parse(raw) : null);
  } catch {
    return { version: CONFIG_VERSION, events: [], suppressedIds: [] };
  }
}

async function writeConfig(config: FeedConfig): Promise<void> {
  const filePath = feedPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteTextFile(filePath, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * Append a milestone event. Idempotent: a duplicate or suppressed id is
 * silently ignored. Returns TRUE only when the event was newly added — the
 * emitter uses this to fire follow-ups (win-count milestones) exactly once
 * instead of on every idempotent re-emit (2026-07 emission logic pass).
 */
export async function appendFeedEvent(event: NewFeedEvent): Promise<boolean> {
  const id = event.id.trim();
  if (!id) return false;
  try {
    return await withLock(FEED_LOCK_KEY, async () => {
      const config = await readConfig();
      if (config.events.some((e) => e.id === id)) return false;
      // Master-moderated ids stay off the wall — even if re-emitted.
      if (config.suppressedIds.includes(id)) return false;
      const next: FeedEvent = {
        id,
        type: event.type,
        actorEmail: normalizeEmail(event.actorEmail),
        categoryKey: event.categoryKey ?? null,
        milestone: event.milestone ?? null,
        withNames: (event.withNames ?? []).slice(0, 4),
        tier: event.tier ?? null,
        createdAt: event.createdAt ?? new Date().toISOString(),
        reactions: emptyReactions(),
      };
      if (!next.actorEmail) return false;
      const events = [next, ...config.events].slice(0, MAX_FEED_EVENTS);
      await writeConfig({ version: CONFIG_VERSION, events, suppressedIds: config.suppressedIds });
      return true;
    });
  } catch {
    // Feed is best-effort; never let it break the originating action.
    return false;
  }
}

export async function listFeedEvents(limit = 50): Promise<FeedEvent[]> {
  const config = await readConfig();
  const safeLimit = Math.max(1, Math.min(MAX_FEED_EVENTS, Math.floor(limit)));
  return config.events.slice(0, safeLimit);
}

/**
 * Toggle a viewer's reaction on an event. Returns the updated event, or null if
 * the event or reaction is invalid. One reaction key per user per event toggles.
 */
export async function toggleReaction(
  eventId: string,
  reaction: string,
  email: string,
): Promise<FeedEvent | null> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !isReaction(reaction)) return null;
  const targetId = eventId.trim();
  if (!targetId) return null;

  return withLock(FEED_LOCK_KEY, async () => {
    const config = await readConfig();
    const event = config.events.find((e) => e.id === targetId);
    if (!event) return null;

    const current = event.reactions[reaction];
    const idx = current.indexOf(normalizedEmail);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(normalizedEmail);
    }

    await writeConfig(config);
    return event;
  });
}

/** Every deterministic per-entry event id — extend HERE when the emitter
 *  learns a new per-entry kind, and every cleanup/sync path follows. */
function perEntryEventIds(entryId: string): string[] {
  return [`streak_started:${entryId}`, `streak_won:${entryId}`, `entry_committed:${entryId}`];
}

/**
 * Remove EVERY milestone event tied to an entry — the one true cleanup for
 * delete/quarantine paths. Single lock pass.
 */
export async function removeEntryFeedEvents(entryId: string): Promise<void> {
  await syncEntryFeedEvents(entryId, []);
}

/**
 * Make the wall TELL THE TRUTH about one entry (2026-07 wiring audit): in a
 * single lock pass, drop the entry's per-entry events that are no longer
 * earned and append the ones that are (existing ids keep their original
 * timestamps/reactions). Covers un-wins (stage-2 file deleted), archive
 * (nothing earned → all removed) and restore (events re-asserted).
 */
export async function syncEntryFeedEvents(entryId: string, earned: NewFeedEvent[]): Promise<void> {
  const id = entryId.trim();
  if (!id) return;
  const managed = new Set(perEntryEventIds(id));
  const earnedById = new Map(earned.filter((e) => managed.has(e.id)).map((e) => [e.id, e]));
  try {
    await withLock(FEED_LOCK_KEY, async () => {
      const config = await readConfig();
      const kept = config.events.filter((e) => !managed.has(e.id) || earnedById.has(e.id));
      const present = new Set(kept.map((e) => e.id));
      const suppressed = new Set(config.suppressedIds);
      const additions: FeedEvent[] = [];
      for (const event of earnedById.values()) {
        if (present.has(event.id) || suppressed.has(event.id)) continue;
        const actorEmail = normalizeEmail(event.actorEmail);
        if (!actorEmail) continue;
        additions.push({
          id: event.id,
          type: event.type,
          actorEmail,
          categoryKey: event.categoryKey ?? null,
          milestone: event.milestone ?? null,
          withNames: (event.withNames ?? []).slice(0, 4),
          tier: event.tier ?? null,
          createdAt: event.createdAt ?? new Date().toISOString(),
          reactions: emptyReactions(),
        });
      }
      if (additions.length === 0 && kept.length === config.events.length) return;
      const events = [...additions, ...kept]
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, MAX_FEED_EVENTS);
      await writeConfig({ version: CONFIG_VERSION, events, suppressedIds: config.suppressedIds });
    });
  } catch {
    // Feed coherence is best-effort; the originating action must not fail.
  }
}

/** Remove a feed event entirely (master moderation). Returns true if one was removed. */
export async function removeFeedEvent(eventId: string): Promise<boolean> {
  const targetId = eventId.trim();
  if (!targetId) return false;
  return withLock(FEED_LOCK_KEY, async () => {
    const config = await readConfig();
    const next = config.events.filter((e) => e.id !== targetId);
    if (next.length === config.events.length) return false;
    // Tombstone: moderation is final — reconcile sweeps and re-emission
    // must never resurrect a card a master admin removed on purpose.
    const suppressedIds = [targetId, ...config.suppressedIds.filter((id) => id !== targetId)]
      .slice(0, MAX_SUPPRESSED_IDS);
    await writeConfig({ version: CONFIG_VERSION, events: next, suppressedIds });
    return true;
  });
}
