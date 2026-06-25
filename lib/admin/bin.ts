import "server-only";

import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { canManageEditRequests } from "@/lib/admin/roles";
import { canApproveDeleteForCategory } from "@/lib/admin/coordinators";
import {
  listQuarantine,
  getQuarantineManifest,
  restoreFromQuarantine,
  purgeQuarantineBundle,
  FACULTY_DELETE_REASON,
  type TrashManifest,
} from "@/lib/jobs/quarantine";
import { withUserDataLock } from "@/lib/data/locks";
import {
  upsertEntryRaw,
  refreshIndexForMutation,
  revalidateDashboardSummary,
  type EntryEngineRecord,
} from "@/lib/entries/internal/engineHelpers";
import type { CategoryKey } from "@/lib/entries/types";

/**
 * The DLC bin — coordinator-/master-managed recoverable deletes.
 *
 * Only faculty-delete-approved bundles (reason = FACULTY_DELETE_REASON) are the
 * "bin"; system auto-delete quarantine is separate and not surfaced here.
 */

/** Bin entries a viewer may act on: master → all; coordinator → their delete categories. */
export async function listBinForViewer(email: string): Promise<TrashManifest[]> {
  const normalized = normalizeEmail(email);
  const bin = (await listQuarantine()).filter((m) => m.reason === FACULTY_DELETE_REASON);
  if (canManageEditRequests(normalized)) return bin;
  return bin.filter((m) => canApproveDeleteForCategory(normalized, m.category));
}

async function loadActionableBundle(email: string, trashId: string): Promise<TrashManifest> {
  const manifest = await getQuarantineManifest(trashId);
  if (!manifest || manifest.reason !== FACULTY_DELETE_REASON) {
    throw new AppError({ code: "NOT_FOUND", message: "Bin entry not found" });
  }
  if (!canApproveDeleteForCategory(normalizeEmail(email), manifest.category)) {
    throw new AppError({ code: "FORBIDDEN", message: "Forbidden" });
  }
  return manifest;
}

/**
 * Restore a binned entry to the live store. Auto-restores its streak (Q7) by
 * clearing `streakPermanentlyRemoved`, so a deleted Win comes back.
 */
export async function restoreFromBin(adminEmail: string, trashId: string): Promise<EntryEngineRecord> {
  const email = normalizeEmail(adminEmail);
  const manifest = await loadActionableBundle(email, trashId);
  const owner = manifest.ownerEmail;
  const category = manifest.category as CategoryKey;

  return withUserDataLock(owner, async () => {
    const { entry } = await restoreFromQuarantine(trashId);
    // Auto-restore the streak: undo the disqualification set on delete-request.
    (entry as Record<string, unknown>).streakPermanentlyRemoved = false;
    const record = entry as EntryEngineRecord;
    await upsertEntryRaw(owner, category, record);
    await refreshIndexForMutation(owner, category, null, record);
    revalidateDashboardSummary(owner);
    logger.info({ event: "bin.restore", trashId, adminEmail: email, category, entryId: manifest.entryId });
    return record;
  });
}

/** Permanently remove a binned entry (entry + files). Irreversible. */
export async function permanentlyDeleteFromBin(adminEmail: string, trashId: string): Promise<void> {
  const email = normalizeEmail(adminEmail);
  const manifest = await loadActionableBundle(email, trashId);
  await purgeQuarantineBundle(trashId);
  logger.info({ event: "bin.purge", trashId, adminEmail: email, category: manifest.category, entryId: manifest.entryId });
}
