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
import { getDashboardSummary } from "@/lib/entries/summary";

const WIN_MILESTONES = [5, 10, 25, 50, 100];

/** Emit a one-time "hit N wins" milestone when the actor's win count lands exactly on a threshold. */
async function emitWinMilestone(actorEmail: string): Promise<void> {
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
    if (isEntryActivated(candidate)) {
      fireAndForget(
        appendFeedEvent({
          id: `streak_started:${entryId}`,
          type: "streak_started",
          actorEmail,
          categoryKey: category,
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
        }),
        "feed.streak_won",
      );
      fireAndForget(emitWinMilestone(actorEmail), "feed.win_milestone");
    }
  } catch {
    // Best-effort only.
  }
}
