import "server-only";

import { CATEGORY_KEYS } from "@/lib/categories";
import { listUsers } from "@/lib/admin/integrity";
import { readCategoryEntries, upsertCategoryEntry } from "@/lib/dataStore";
import {
  normalizeEntryStatus,
  isEditWindowExpired,
  transitionEntry,
} from "@/lib/entries/workflow";
import {
  type EntryEngineRecord,
  refreshIndexForMutation,
  revalidateDashboardSummary,
} from "@/lib/entries/internal/engineHelpers";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";

export type EditGrantExpiryResult = {
  usersScanned: number;
  expired: number;
};

export async function runEditGrantExpiry(): Promise<Result<EditGrantExpiryResult>> {
  return safeAction(async () => {
    const startedAt = Date.now();
    const usersResult = await listUsers();
    if (!usersResult.ok) throw usersResult.error;

    let expired = 0;

    for (const userEmail of usersResult.data) {
      for (const category of CATEGORY_KEYS) {
        const entries = await readCategoryEntries(userEmail, category);

        for (const entry of entries) {
          const status = normalizeEntryStatus(entry);
          if (status !== "EDIT_GRANTED") continue;
          if (!isEditWindowExpired(entry)) continue;

          // Edit grant expired — revert to GENERATED
          const transitioned = transitionEntry(entry, "generateEntry");
          await upsertCategoryEntry(userEmail, category, transitioned);
          expired++;

          // Keep index counts + dashboard summary in step with the status
          // change (2026-07 correlation audit).
          await refreshIndexForMutation(
            userEmail,
            category,
            entry as unknown as EntryEngineRecord,
            transitioned as unknown as EntryEngineRecord,
          );
          revalidateDashboardSummary(userEmail);

          logger.info({
            event: "jobs.editGrantExpiry.entry",
            userEmail,
            category,
            entryId: String(entry.id ?? ""),
          });
        }
      }
    }

    logger.info({
      event: "jobs.editGrantExpiry.summary",
      usersScanned: usersResult.data.length,
      expired,
      durationMs: Date.now() - startedAt,
    });

    return { usersScanned: usersResult.data.length, expired };
  }, {
    context: "jobs.editGrantExpiry",
  });
}
