import "server-only";

import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { listUsers } from "@/lib/admin/integrity";
import { readCategoryEntries, upsertCategoryEntry, deleteCategoryEntry } from "@/lib/dataStore";
import {
  transitionEntry,
} from "@/lib/entries/workflow";
import { getCategorySchema } from "@/data/categoryRegistry";
import { computeWorkflowState } from "@/lib/workflow";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/workflow/workflowConfig";
import { notifyAutoArchived, extractEntryTitle } from "@/lib/confirmations/notificationHelpers";
import { appendActionHistory } from "@/lib/admin/actionHistory";
import { getEditWindowDays, getStreakBufferDays, getPastEntryWindowDays } from "@/lib/settings/consumer";
import type { WorkflowConfig } from "@/lib/workflow/workflowConfig";
import {
  type EntryEngineRecord,
  refreshIndexForMutation,
  revalidateDashboardSummary,
} from "@/lib/entries/internal/engineHelpers";
import { recordEntryMilestones } from "@/lib/feed/feedEvents";
import { removeFeedEvent } from "@/lib/feed/feedStore";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";

export type AutoArchiveResult = {
  usersScanned: number;
  archived: number;
  locked: number;
  deleted: number;
};

/**
 * S1: the nightly "delete" verdict now QUARANTINES rather than destroys.
 * The entry JSON + its upload files are moved to recoverable trash with a
 * 30-day retention window; the entry is removed from the live store. This
 * makes an erroneous heuristic (or a schema change that reclassifies valid
 * entries as incomplete) recoverable instead of a silent data-loss event.
 */
async function quarantineDeletedEntry(email: string, category: CategoryKey, entry: Record<string, unknown>) {
  const entryId = String(entry.id ?? "");

  // Collect file paths (PDF + schema upload fields, single or multi-file)
  const filePaths: string[] = [];
  const pushStored = (v: unknown) => {
    const sp = (v as Record<string, unknown> | null | undefined)?.storedPath;
    if (typeof sp === "string" && sp) filePaths.push(sp);
  };
  if (entry.pdfMeta && typeof entry.pdfMeta === "object") pushStored(entry.pdfMeta);

  const schema = getCategorySchema(category);
  for (const field of schema.fields) {
    if (!field.upload || !entry[field.key]) continue;
    const val = entry[field.key];
    if (Array.isArray(val)) val.forEach(pushStored);
    else pushStored(val);
  }

  const { quarantineEntry, removeEmptyUploadDir } = await import("@/lib/jobs/quarantine");
  const title = extractEntryTitle(entry, category);

  // Quarantine moves the files; then remove the entry from the live store.
  await quarantineEntry({
    ownerEmail: email,
    category,
    entry,
    filePaths,
    reason: "nightly_auto_delete",
    entryTitle: title,
  });
  await deleteCategoryEntry(email, category, entryId);
  await removeEmptyUploadDir(email, category, entryId);

  // Invalidate analytics cache via its owning module (path stays in sync
  // with where analytics actually writes — 2026-07 correlation audit).
  try {
    const { invalidateAnalyticsCache } = await import("@/lib/analytics/cache");
    await invalidateAnalyticsCache();
  } catch { /* ignore */ }
}

export async function runAutoArchive(): Promise<Result<AutoArchiveResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const usersResult = await listUsers();
    if (!usersResult.ok) throw usersResult.error;

    let archived = 0;
    let locked = 0;
    let deleted = 0;

    // Judge entries with the SAME live settings the commit path used —
    // frozen defaults here would let nightly verdicts disagree with the
    // timers users were actually given (2026-07 correlation audit).
    const [editWindowDays, streakBufferDays, pastEntryWindowDays] = await Promise.all([
      getEditWindowDays(),
      getStreakBufferDays(),
      getPastEntryWindowDays(),
    ]);
    const liveConfig: WorkflowConfig = {
      ...DEFAULT_WORKFLOW_CONFIG,
      timer: {
        ...DEFAULT_WORKFLOW_CONFIG.timer,
        defaultWindowDays: editWindowDays,
        streakBufferDays,
        pastEntryWindowDays,
      },
    };

    for (const userEmail of usersResult.data) {
      for (const category of CATEGORY_KEYS) {
        const entries = await readCategoryEntries(userEmail, category);

        for (const entry of entries) {
          const state = computeWorkflowState(entry as Record<string, unknown>, category as CategoryKey, liveConfig);

          // Skip paused timers, non-expired, already locked
          if (state.timer.isPaused) continue;
          if (!state.timer.isExpired) continue;
          if (state.isPermanentlyLocked) continue;

          if (state.autoAction === "finalise") {
            // Auto-finalise: permanently lock
            const before = { ...(entry as Record<string, unknown>) };
            (entry as Record<string, unknown>).permanentlyLocked = true;
            (entry as Record<string, unknown>).timerPausedAt = null;
            (entry as Record<string, unknown>).timerRemainingMs = null;
            await upsertCategoryEntry(userEmail, category, entry);
            locked++;

            // Keep derived stores coherent: index counts, dashboard summary,
            // and the Celebration Wall (an auto-finalise can BE the win).
            await refreshIndexForMutation(
              userEmail,
              category as CategoryKey,
              before as EntryEngineRecord,
              entry as unknown as EntryEngineRecord,
            );
            revalidateDashboardSummary(userEmail);
            recordEntryMilestones(userEmail, category as CategoryKey, entry as Record<string, unknown>);

            try {
              appendActionHistory({
                actionType: "auto_finalised",
                entryId: String(entry.id ?? ""),
                category,
                entryTitle: extractEntryTitle(entry as unknown as Record<string, unknown>, category),
                userEmail,
                userName: userEmail.split("@")[0],
              });
            } catch (err) {
              logger.warn({ event: "action_history.append_failed", actionType: "auto_finalised", entryId: String(entry.id ?? "") }, err instanceof Error ? err.message : String(err));
            }

            logger.info({
              event: "nightly.auto-finalise",
              userEmail,
              category,
              entryId: String(entry.id ?? ""),
            });
          } else if (state.autoAction === "delete") {
            // Log action history BEFORE deletion
            try {
              appendActionHistory({
                actionType: "auto_deleted",
                entryId: String(entry.id ?? ""),
                category,
                entryTitle: extractEntryTitle(entry as unknown as Record<string, unknown>, category),
                userEmail,
                userName: userEmail.split("@")[0],
              });
            } catch (err) {
              logger.warn({ event: "action_history.append_failed", actionType: "auto_deleted", entryId: String(entry.id ?? "") }, err instanceof Error ? err.message : String(err));
            }

            // Auto-delete: quarantine entry + files (recoverable, 30-day retention)
            await quarantineDeletedEntry(userEmail, category as CategoryKey, entry as Record<string, unknown>);
            deleted++;

            // Keep derived stores coherent: index/summary reflect the removal,
            // and the feed never celebrates an entry that no longer exists.
            const removedId = String((entry as Record<string, unknown>).id ?? "");
            await refreshIndexForMutation(
              userEmail,
              category as CategoryKey,
              entry as unknown as EntryEngineRecord,
              null,
            );
            revalidateDashboardSummary(userEmail);
            await removeFeedEvent(`streak_started:${removedId}`).catch(() => false);
            await removeFeedEvent(`streak_won:${removedId}`).catch(() => false);

            const title = extractEntryTitle(entry as unknown as Record<string, unknown>, category);
            notifyAutoArchived(userEmail, title, category).catch((err) => {
              logger.warn({ event: "jobs.autoArchive.notifyFailed", userEmail, category }, err instanceof Error ? err.message : String(err));
            });

            logger.info({
              event: "nightly.auto-delete",
              userEmail,
              category,
              entryId: String(entry.id ?? ""),
            });
          } else {
            // Legacy fallback: archive entries without valid PDF
            const hasPdf = entry.pdfGenerated === true && !entry.pdfStale;
            if (!hasPdf) {
              const transitioned = transitionEntry(entry, "archiveEntry", {
                archiveReason: "auto_no_pdf",
              });
              await upsertCategoryEntry(userEmail, category, transitioned);
              archived++;

              const title = extractEntryTitle(entry as unknown as Record<string, unknown>, category);
              notifyAutoArchived(userEmail, title, category).catch((err) => {
                logger.warn({ event: "jobs.autoArchive.notifyFailed", userEmail, category }, err instanceof Error ? err.message : String(err));
              });

              logger.info({
                event: "jobs.autoArchive.entry",
                userEmail,
                category,
                entryId: String(entry.id ?? ""),
              });
            }
          }
        }
      }
    }

    logger.info({
      event: "jobs.autoArchive.summary",
      usersScanned: usersResult.data.length,
      archived,
      locked,
      deleted,
      durationMs: Date.now() - startedAt,
    });

    return { usersScanned: usersResult.data.length, archived, locked, deleted };
  }, {
    context: "jobs.autoArchive",
  });
}
