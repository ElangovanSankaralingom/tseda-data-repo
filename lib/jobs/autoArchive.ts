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
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";

export type AutoArchiveResult = {
  usersScanned: number;
  archived: number;
  locked: number;
  deleted: number;
};

async function permanentlyDeleteEntry(email: string, category: CategoryKey, entry: Record<string, unknown>) {
  const entryId = String(entry.id ?? "");

  // Collect file paths
  const filePaths: string[] = [];
  if (entry.pdfMeta && typeof entry.pdfMeta === "object") {
    const storedPath = (entry.pdfMeta as Record<string, unknown>).storedPath;
    if (typeof storedPath === "string") filePaths.push(storedPath);
  }

  const schema = getCategorySchema(category);
  for (const field of schema.fields) {
    if (field.upload && entry[field.key]) {
      const val = entry[field.key] as Record<string, unknown>;
      if (typeof val?.storedPath === "string") filePaths.push(val.storedPath);
    }
  }

  // Delete entry from store
  await deleteCategoryEntry(email, category, entryId);

  // Delete files
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  for (const storedPath of filePaths) {
    try {
      await fs.rm(path.join(process.cwd(), "public", storedPath), { force: true });
    } catch { /* ignore */ }
  }

  // Delete upload directory
  try {
    await fs.rm(path.join(process.cwd(), "public", "uploads", email, category, entryId), { recursive: true, force: true });
  } catch { /* ignore */ }

  // Invalidate analytics cache
  try {
    await fs.rm(path.join(process.cwd(), ".data", "maintenance", "analytics-cache.json"), { force: true });
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

    for (const userEmail of usersResult.data) {
      for (const category of CATEGORY_KEYS) {
        const entries = await readCategoryEntries(userEmail, category);

        for (const entry of entries) {
          const state = computeWorkflowState(entry as Record<string, unknown>, category as CategoryKey, DEFAULT_WORKFLOW_CONFIG);

          // Skip paused timers, non-expired, already locked
          if (state.timer.isPaused) continue;
          if (!state.timer.isExpired) continue;
          if (state.isPermanentlyLocked) continue;

          if (state.autoAction === "finalise") {
            // Auto-finalise: permanently lock
            (entry as Record<string, unknown>).permanentlyLocked = true;
            (entry as Record<string, unknown>).timerPausedAt = null;
            (entry as Record<string, unknown>).timerRemainingMs = null;
            await upsertCategoryEntry(userEmail, category, entry);
            locked++;

            logger.info({
              event: "nightly.auto-finalise",
              userEmail,
              category,
              entryId: String(entry.id ?? ""),
            });
          } else if (state.autoAction === "delete") {
            // Auto-delete: permanently remove entry + files
            await permanentlyDeleteEntry(userEmail, category as CategoryKey, entry as Record<string, unknown>);
            deleted++;

            const title = extractEntryTitle(entry as unknown as Record<string, unknown>);
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
