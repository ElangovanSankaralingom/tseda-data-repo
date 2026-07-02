import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { withLock } from "@/lib/data/locks";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getDataRoot } from "@/lib/userStore";

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

export type FeedEventType = "streak_started" | "streak_won" | "milestone";

export type FeedEvent = {
  id: string;
  type: FeedEventType;
  actorEmail: string;
  categoryKey: string | null;
  /** For "milestone" events: the win-count threshold reached (e.g. 5, 10, 25). */
  milestone: number | null;
  /** First names of collaborators on the underlying entry ("with X & Y"). */
  withNames: string[];
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
  createdAt?: string;
};

type FeedConfig = { version: number; events: FeedEvent[] };

const CONFIG_VERSION = 1 as const;
const MAX_FEED_EVENTS = 200;
const FEED_LOCK_KEY = "feed.activity";

function feedPath() {
  return path.join(process.cwd(), getDataRoot(), "feed", "activity.json");
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
  if (type !== "streak_started" && type !== "streak_won" && type !== "milestone") return null;
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
  return { version: CONFIG_VERSION, events };
}

async function readConfig(): Promise<FeedConfig> {
  try {
    const raw = await fs.readFile(feedPath(), "utf8");
    return sanitize(raw.trim() ? JSON.parse(raw) : null);
  } catch {
    return { version: CONFIG_VERSION, events: [] };
  }
}

async function writeConfig(config: FeedConfig): Promise<void> {
  const filePath = feedPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await atomicWriteTextFile(filePath, `${JSON.stringify(config, null, 2)}\n`);
}

/** Append a milestone event. Idempotent: a duplicate id is silently ignored. */
export async function appendFeedEvent(event: NewFeedEvent): Promise<void> {
  const id = event.id.trim();
  if (!id) return;
  try {
    await withLock(FEED_LOCK_KEY, async () => {
      const config = await readConfig();
      if (config.events.some((e) => e.id === id)) return;
      const next: FeedEvent = {
        id,
        type: event.type,
        actorEmail: normalizeEmail(event.actorEmail),
        categoryKey: event.categoryKey ?? null,
        milestone: event.milestone ?? null,
        withNames: (event.withNames ?? []).slice(0, 4),
        createdAt: event.createdAt ?? new Date().toISOString(),
        reactions: emptyReactions(),
      };
      if (!next.actorEmail) return;
      const events = [next, ...config.events].slice(0, MAX_FEED_EVENTS);
      await writeConfig({ version: CONFIG_VERSION, events });
    });
  } catch {
    // Feed is best-effort; never let it break the originating action.
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

/** Remove a feed event entirely (master moderation). Returns true if one was removed. */
export async function removeFeedEvent(eventId: string): Promise<boolean> {
  const targetId = eventId.trim();
  if (!targetId) return false;
  return withLock(FEED_LOCK_KEY, async () => {
    const config = await readConfig();
    const next = config.events.filter((e) => e.id !== targetId);
    if (next.length === config.events.length) return false;
    await writeConfig({ version: CONFIG_VERSION, events: next });
    return true;
  });
}
