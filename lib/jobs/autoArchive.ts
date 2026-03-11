import "server-only";

import { CATEGORY_KEYS } from "@/lib/categories";
import { listUsers } from "@/lib/admin/integrity";
import { readCategoryEntries, upsertCategoryEntry } from "@/lib/dataStore";
import {
  normalizeEntryStatus,
  isEditWindowExpired,
  transitionEntry,
} from "@/lib/entries/workflow";
import { notifyAutoArchived, extractEntryTitle } from "@/lib/confirmations/notificationHelpers";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";

export type AutoArchiveResult = {
  usersScanned: number;
  archived: number;
  locked: number;
};

export async function runAutoArchive(): Promise<Result<AutoArchiveResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const usersResult = await listUsers();
    if (!usersResult.ok) throw usersResult.error;

    let archived = 0;
    let locked = 0;

    for (const userEmail of usersResult.data) {
      for (const category of CATEGORY_KEYS) {
        const entries = await readCategoryEntries(userEmail, category);

        for (const entry of entries) {
          const status = normalizeEntryStatus(entry);
          if (status !== "GENERATED") continue;
          if (!isEditWindowExpired(entry)) continue;

          const hasPdf = entry.pdfGenerated === true && !entry.pdfStale;

          if (!hasPdf) {
            // Timer expired without valid PDF — archive
            const transitioned = transitionEntry(entry, "archiveEntry", {
              archiveReason: "auto_no_pdf",
            });
            await upsertCategoryEntry(userEmail, category, transitioned);
            archived++;

            const title = extractEntryTitle(entry as unknown as Record<string, unknown>);
            notifyAutoArchived(userEmail, title, category).catch((err) => {
              logger.warn({ event: "jobs.autoArchive.notifyFailed", userEmail, category }, err instanceof Error ? err.message : String(err));
            });

            logger.info({
              event: "jobs.autoArchive.entry",
              userEmail,
              category,
              entryId: String(entry.id ?? ""),
            });
          } else if ((entry as Record<string, unknown>).permanentlyLocked !== true) {
            // Timer expired with valid PDF — permanently lock
            const updated = { ...entry, permanentlyLocked: true };
            await upsertCategoryEntry(userEmail, category, updated);
            locked++;

            logger.info({
              event: "jobs.autoLock.entry",
              userEmail,
              category,
              entryId: String(entry.id ?? ""),
            });
          }
        }
      }
    }

    logger.info({
      event: "jobs.autoArchive.summary",
      usersScanned: usersResult.data.length,
      archived,
      locked,
      durationMs: Date.now() - startedAt,
    });

    return { usersScanned: usersResult.data.length, archived, locked };
  }, {
    context: "jobs.autoArchive",
  });
}
