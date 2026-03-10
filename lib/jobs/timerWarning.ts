import "server-only";

import { CATEGORY_KEYS } from "@/lib/categories";
import { listUsers } from "@/lib/admin/integrity";
import { readCategoryEntries, upsertCategoryEntry } from "@/lib/dataStore";
import {
  normalizeEntryStatus,
  getEditTimeRemaining,
} from "@/lib/entries/workflow";
import { notifyTimerWarning, extractEntryTitle } from "@/lib/confirmations/notificationHelpers";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";

export type TimerWarningResult = {
  usersScanned: number;
  warned: number;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function runTimerWarnings(): Promise<Result<TimerWarningResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const usersResult = await listUsers();
    if (!usersResult.ok) throw usersResult.error;

    let warned = 0;

    for (const userEmail of usersResult.data) {
      for (const category of CATEGORY_KEYS) {
        const entries = await readCategoryEntries(userEmail, category);

        for (const entry of entries) {
          const status = normalizeEntryStatus(entry);
          if (status !== "GENERATED") continue;

          // Skip if already warned
          if (entry.timerWarningShown === true) continue;

          const timeRemaining = getEditTimeRemaining(entry);
          if (!timeRemaining.hasEditWindow || timeRemaining.expired) continue;

          // Only warn if within 24 hours
          if (timeRemaining.remainingMs > TWENTY_FOUR_HOURS_MS) continue;

          // No valid PDF — warn the user
          const hasPdf = entry.pdfGenerated === true && !entry.pdfStale;
          if (hasPdf) continue;

          const title = extractEntryTitle(entry as unknown as Record<string, unknown>);
          notifyTimerWarning(userEmail, title, category).catch((err) => {
            logger.warn({ event: "jobs.timerWarning.notifyFailed", userEmail, category }, err instanceof Error ? err.message : String(err));
          });

          // Mark as warned so we don't notify again
          const updated = { ...entry, timerWarningShown: true };
          await upsertCategoryEntry(userEmail, category, updated);
          warned++;

          logger.info({
            event: "jobs.timerWarning.entry",
            userEmail,
            category,
            entryId: String(entry.id ?? ""),
          });
        }
      }
    }

    logger.info({
      event: "jobs.timerWarning.summary",
      usersScanned: usersResult.data.length,
      warned,
      durationMs: Date.now() - startedAt,
    });

    return { usersScanned: usersResult.data.length, warned };
  }, {
    context: "jobs.timerWarning",
  });
}
