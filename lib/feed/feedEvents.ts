import "server-only";

import { getCategorySchema } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";
import { appendFeedEvent, type FeedEventType } from "@/lib/feed/feedStore";
import { isEntryActivated, isEntryWon, type StreakProgressEntryLike } from "@/lib/streakProgress";
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

/**
 * Best-effort: after a generate/finalise succeeds, record milestone events for
 * the department activity feed. Milestone-only (no entry data is broadcast).
 * Idempotent via deterministic event ids, so re-running never double-posts.
 * Never throws — feed emission must not affect the originating action.
 */
export function recordEntryMilestones(
  actorEmail: string,
  category: CategoryKey,
  entry: Record<string, unknown>,
): void {
  const entryId = String(entry.id ?? "").trim();
  if (!entryId) return;
  const candidate = entry as StreakProgressEntryLike;

  try {
    const withNames = collabDisplayNames(actorEmail, category, entry);

    if (isEntryActivated(candidate)) {
      fireAndForget(
        appendFeedEvent({
          id: `streak_started:${entryId}`,
          type: "streak_started",
          actorEmail,
          categoryKey: category,
          ...(withNames.length ? { withNames } : {}),
        }),
        "feed.streak_started",
      );
    }

    const fields = getCategorySchema(category).fields;
    if (isEntryWon(candidate, fields)) {
      fireAndForget(
        appendFeedEvent({
          id: `streak_won:${entryId}`,
          type: "streak_won",
          actorEmail,
          categoryKey: category,
          ...(withNames.length ? { withNames } : {}),
        }),
        "feed.streak_won",
      );
      fireAndForget(emitWinMilestone(actorEmail), "feed.win_milestone");
    }
  } catch {
    // Best-effort only.
  }
}
