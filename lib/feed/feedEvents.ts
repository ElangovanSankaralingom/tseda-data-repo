import "server-only";

import { getCategorySchema } from "@/data/categoryRegistry";
import type { CategoryKey } from "@/lib/entries/types";
import { appendFeedEvent } from "@/lib/feed/feedStore";
import { isEntryActivated, isEntryWon, type StreakProgressEntryLike } from "@/lib/streakProgress";
import { fireAndForget } from "@/lib/utils/fireAndForget";

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
    }
  } catch {
    // Best-effort only.
  }
}
