import "server-only";

import { getCategorySchema } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";
import { appendFeedEvent, type FeedEventType, type NewFeedEvent } from "@/lib/feed/feedStore";
import { getStreakTier, isEntryActivated, isEntryWon, type StreakProgressEntryLike } from "@/lib/streakProgress";
import { isEntryCommitted, normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/workflow";
import { fireAndForget } from "@/lib/utils/fireAndForget";
import { addNotification } from "@/lib/confirmations/notificationStore";
import { resolveFacultyName } from "@/lib/admin/facultyRegistry";

/** Notify a milestone's owner that someone reacted (best-effort, never throws). */
export function notifyMilestoneReaction(ownerEmail: string, reactorEmail: string, type: FeedEventType): void {
  const resolved = resolveFacultyName(reactorEmail);
  const reactorName = resolved ? resolved.trim().split(/\s+/)[0] : (reactorEmail.split("@")[0] ?? "Someone");
  const what = type === "streak_won" ? "streak win" : type === "milestone" ? "milestone" : "streak";
  fireAndForget(
    addNotification(ownerEmail, {
      type: "feed_reaction",
      title: "New reaction",
      message: `${reactorName} reacted to your ${what}`,
      actionUrl: "/dashboard",
      actionLabel: "View",
    }).then(() => undefined),
    "feed.reaction.notify",
  );
}
const WIN_MILESTONES = [5, 10, 25, 50, 100];

/**
 * First names of the entry's collaborators (schema `collaborates` fields),
 * excluding the actor — powers the feed's "with X & Y" rendering. Names only:
 * consistent with the feed's milestone-only privacy design.
 */
function collabDisplayNames(
  actorEmail: string,
  category: CategoryKey,
  entry: Record<string, unknown>,
): string[] {
  const names: string[] = [];
  const seen = new Set<string>([actorEmail.trim().toLowerCase()]);
  try {
    for (const field of getCategorySchema(category).fields) {
      if (!field.collaborates) continue;
      const rows = entry[field.key];
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const record = row as Record<string, unknown>;
        const rowEmail = String(record.email ?? "").trim().toLowerCase();
        if (!rowEmail || seen.has(rowEmail)) continue;
        seen.add(rowEmail);
        const rawName = String(record.name ?? "").trim();
        const display = (rawName || resolveFacultyName(rowEmail) || rowEmail.split("@")[0] || "")
          .trim()
          .split(/\s+/)[0];
        if (display) names.push(display);
        if (names.length >= 4) return names;
      }
    }
  } catch {
    // Best-effort only.
  }
  return names;
}

/** Emit a one-time "hit N wins" milestone when the actor's win count lands exactly on a threshold. */
async function emitWinMilestone(actorEmail: string): Promise<void> {
  // Deferred import: the summary module reaches next/cache, which only
  // resolves inside the Next runtime — jobs/tests import this module too.
  const { getDashboardSummary } = await import("@/lib/entries/summary");
  const summary = await getDashboardSummary(actorEmail);
  const wins = summary.totals.streakWinsCount;
  if (typeof wins === "number" && WIN_MILESTONES.includes(wins)) {
    await appendFeedEvent({
      id: `milestone:${actorEmail}:${wins}`,
      type: "milestone",
      actorEmail,
      milestone: wins,
    });
  }
}

function toISO(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

/**
 * Decide which feed events an entry has earned — pure, no I/O.
 *
 * Three arrival stories, one per entry state (Elan's "Department Pulse shows
 * no data", round 2 — the wall must reflect COMMITS, not just streaks):
 *  - streak_started  — streak-eligible entry committed (the gold track)
 *  - streak_won      — stage 2 complete / record submitted (tiered)
 *  - entry_committed — committed but never streak-eligible (past-dated
 *    permission entries: the everyday reality of post-facto data entry).
 *
 * Event timestamps come from the ENTRY (commit / completion time), so a
 * backfill sweep lands history in honest chronological order instead of
 * stamping everything "just now". Ids are deterministic → idempotent.
 */
export function collectEntryMilestoneEvents(
  actorEmail: string,
  category: CategoryKey,
  entry: Record<string, unknown>,
): NewFeedEvent[] {
  const entryId = String(entry.id ?? "").trim();
  if (!entryId) return [];
  const candidate = entry as StreakProgressEntryLike;
  const events: NewFeedEvent[] = [];

  try {
    const withNames = collabDisplayNames(actorEmail, category, entry);
    const names = withNames.length ? { withNames } : {};
    const committedAt = toISO(entry.committedAtISO) ?? toISO(entry.generatedAt);

    const activated = isEntryActivated(candidate);
    if (activated) {
      events.push({
        id: `streak_started:${entryId}`,
        type: "streak_started",
        actorEmail,
        categoryKey: category,
        ...(committedAt ? { createdAt: committedAt } : {}),
        ...names,
      });
    }

    const fields = getCategorySchema(category).fields;
    const won = isEntryWon(candidate, fields);
    if (won) {
      const streak = entry.streak as { completedAtISO?: unknown } | null | undefined;
      const wonAt = toISO(streak?.completedAtISO) ?? committedAt;
      events.push({
        id: `streak_won:${entryId}`,
        type: "streak_won",
        actorEmail,
        categoryKey: category,
        tier: getStreakTier(candidate),
        ...(wonAt ? { createdAt: wonAt } : {}),
        ...names,
      });
    }

    // Committed but never on the streak track (past-dated permission
    // entries) → the plain "logged" pulse card. Archived entries stay off
    // the wall — an expired incomplete window is nothing to broadcast.
    if (!activated && !won) {
      const state = entry as EntryStateLike;
      if (isEntryCommitted(state) && normalizeEntryStatus(state) !== "ARCHIVED") {
        events.push({
          id: `entry_committed:${entryId}`,
          type: "entry_committed",
          actorEmail,
          categoryKey: category,
          ...(committedAt ? { createdAt: committedAt } : {}),
          ...names,
        });
      }
    }
  } catch {
    // Best-effort only.
  }

  return events;
}

/**
 * Awaited emission — the backfill sweep uses this so the SAME request that
 * triggered the sweep can re-read the feed and see the events (the
 * fire-and-forget path races the re-read).
 */
export async function recordEntryMilestonesAwaited(
  actorEmail: string,
  category: CategoryKey,
  entry: Record<string, unknown>,
): Promise<void> {
  const events = collectEntryMilestoneEvents(actorEmail, category, entry);
  for (const event of events) {
    await appendFeedEvent(event);
    if (event.type === "streak_won") {
      fireAndForget(emitWinMilestone(actorEmail), "feed.win_milestone");
    }
  }
}

/**
 * Reconcile an entry's presence on the wall after a mutation that can
 * change what it has earned (admin grant/reject/archive/restore, user
 * requests, stage-2 file deletion): the wall ends up holding EXACTLY the
 * entry's earned events — archived entries lose all cards, un-wins lose
 * the win card, restores re-assert. Single lock pass; best-effort.
 */
export async function reconcileEntryFeedPresence(
  ownerEmail: string,
  category: CategoryKey,
  entry: Record<string, unknown>,
): Promise<void> {
  const entryId = String(entry.id ?? "").trim();
  if (!entryId) return;
  const { syncEntryFeedEvents } = await import("@/lib/feed/feedStore");
  await syncEntryFeedEvents(entryId, collectEntryMilestoneEvents(ownerEmail, category, entry));
}

/**
 * Best-effort: after a generate/finalise/save succeeds, record milestone
 * events for the department activity feed. Milestone-only (no entry data is
 * broadcast). Idempotent via deterministic event ids, so re-running never
 * double-posts. Never throws — feed emission must not affect the
 * originating action.
 */
export function recordEntryMilestones(
  actorEmail: string,
  category: CategoryKey,
  entry: Record<string, unknown>,
): void {
  try {
    for (const event of collectEntryMilestoneEvents(actorEmail, category, entry)) {
      fireAndForget(appendFeedEvent(event), `feed.${event.type}`);
      if (event.type === "streak_won") {
        fireAndForget(emitWinMilestone(actorEmail), "feed.win_milestone");
      }
    }
  } catch {
    // Best-effort only.
  }
}
