import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { universePrivateDataRoot, resolveEntryUploadPath, entryUploadsRoot } from "@/lib/config/storagePaths";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { safeEmailKey } from "@/lib/uploadStore";
import { getCategorySchema } from "@/data/categoryRegistry";

/** Reason tag for entries a coordinator approved-deleted into the manual DLC bin. */
export const FACULTY_DELETE_REASON = "faculty_delete_approved";

/**
 * Collect every stored upload path on an entry (PDF + schema upload fields,
 * single or multi-file) — for moving files into / out of quarantine.
 */
export function collectEntryFilePaths(category: string, entry: Record<string, unknown>): string[] {
  const filePaths: string[] = [];
  const pushStored = (v: unknown) => {
    const sp = (v as Record<string, unknown> | null | undefined)?.storedPath;
    if (typeof sp === "string" && sp) filePaths.push(sp);
  };
  if (entry.pdfMeta && typeof entry.pdfMeta === "object") pushStored(entry.pdfMeta);
  const schema = getCategorySchema(category);
  for (const field of schema?.fields ?? []) {
    if (!field.upload || !entry[field.key]) continue;
    const val = entry[field.key];
    if (Array.isArray(val)) val.forEach(pushStored);
    else pushStored(val);
  }
  return filePaths;
}

/**
 * S1 (TECH-AUDIT-2026-06 C4): the nightly job used to *permanently* destroy
 * entries + files on a heuristic, with no undo — and a routine schema change
 * could flip valid entries to "incomplete → delete". Quarantine makes that
 * destruction recoverable: the entry JSON + its upload files are moved to a
 * trash area with a manifest and a retention window. A separate purge step
 * (or an admin) removes them later; until then they can be restored.
 */

// Universe-aware: demo-mode deletions quarantine into the demo trash, which
// is wiped with the demo universe — never into the real DLC bin.
export function trashRoot(): string {
  return path.join(universePrivateDataRoot(), "trash");
}

/** How long quarantined entries are retained before they may be purged. */
export const TRASH_RETENTION_DAYS = 30;

export type TrashManifest = {
  trashId: string;
  ownerEmail: string;
  category: string;
  entryId: string;
  entryTitle: string;
  reason: string;
  quarantinedAtISO: string;
  /** storedPath values whose files were moved into this trash bundle. */
  files: string[];
};

function trashDir(trashId: string): string {
  return path.join(trashRoot(), trashId);
}

/**
 * Move an entry's JSON snapshot + upload files into quarantine.
 * Returns the trash id. Caller is responsible for removing the entry from the
 * live store (so the snapshot here is the source of truth for restore).
 */
export async function quarantineEntry(args: {
  ownerEmail: string;
  category: string;
  entry: Record<string, unknown>;
  filePaths: string[];
  reason: string;
  entryTitle: string;
}): Promise<string> {
  const trashId = `${Date.now()}_${safeEmailKey(args.ownerEmail)}_${randomUUID().slice(0, 8)}`;
  const dir = trashDir(trashId);
  await fs.mkdir(path.join(dir, "files"), { recursive: true });

  // Move each upload file, preserving its storedPath as the relative key.
  const movedFiles: string[] = [];
  for (const storedPath of args.filePaths) {
    try {
      const abs = resolveEntryUploadPath(storedPath);
      const dest = path.join(dir, "files", storedPath.replace(/[^a-zA-Z0-9._-]/g, "_"));
      await fs.rename(abs, dest).catch(async () => {
        // Cross-device or missing: copy-then-unlink, tolerate absence.
        await fs.copyFile(abs, dest);
        await fs.rm(abs, { force: true });
      });
      movedFiles.push(storedPath);
    } catch {
      /* file already gone or legacy path — record nothing, continue */
    }
  }

  const manifest: TrashManifest = {
    trashId,
    ownerEmail: args.ownerEmail,
    category: args.category,
    entryId: String(args.entry.id ?? ""),
    entryTitle: args.entryTitle,
    reason: args.reason,
    quarantinedAtISO: new Date().toISOString(),
    files: movedFiles,
  };

  await atomicWriteTextFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
  await atomicWriteTextFile(path.join(dir, "entry.json"), JSON.stringify(args.entry, null, 2));

  logger.info({
    event: "quarantine.entry",
    trashId,
    userEmail: args.ownerEmail,
    category: args.category,
    entryId: manifest.entryId,
    fileCount: movedFiles.length,
    reason: args.reason,
  });

  return trashId;
}

/** List quarantined bundles, newest first. */
export async function listQuarantine(): Promise<TrashManifest[]> {
  let ids: string[];
  try {
    ids = await fs.readdir(trashRoot());
  } catch {
    return [];
  }
  const manifests: TrashManifest[] = [];
  for (const id of ids) {
    try {
      const raw = await fs.readFile(path.join(trashDir(id), "manifest.json"), "utf8");
      manifests.push(JSON.parse(raw) as TrashManifest);
    } catch {
      /* skip malformed bundle */
    }
  }
  return manifests.sort((a, b) => b.quarantinedAtISO.localeCompare(a.quarantinedAtISO));
}

/**
 * Restore a quarantined entry: its files return to the entry-uploads root and
 * its JSON snapshot is returned for the caller to re-insert into the live
 * store. The trash bundle is removed on success.
 */
export async function restoreFromQuarantine(trashId: string): Promise<{
  manifest: TrashManifest;
  entry: Record<string, unknown>;
}> {
  const dir = trashDir(trashId);
  const manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8")) as TrashManifest;
  const entry = JSON.parse(await fs.readFile(path.join(dir, "entry.json"), "utf8")) as Record<string, unknown>;

  for (const storedPath of manifest.files) {
    const src = path.join(dir, "files", storedPath.replace(/[^a-zA-Z0-9._-]/g, "_"));
    const dest = resolveEntryUploadPath(storedPath);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.rename(src, dest).catch(async () => {
      await fs.copyFile(src, dest);
    });
  }

  await fs.rm(dir, { recursive: true, force: true });
  logger.info({ event: "quarantine.restore", trashId, userEmail: manifest.ownerEmail, entryId: manifest.entryId });
  return { manifest, entry };
}

/** Read a single quarantine manifest by id (null if missing/malformed). */
export async function getQuarantineManifest(trashId: string): Promise<TrashManifest | null> {
  try {
    const raw = await fs.readFile(path.join(trashDir(trashId), "manifest.json"), "utf8");
    return JSON.parse(raw) as TrashManifest;
  } catch {
    return null;
  }
}

/** Permanently remove one quarantine bundle (entry + files). Returns true if it existed. */
export async function purgeQuarantineBundle(trashId: string): Promise<boolean> {
  const dir = trashDir(trashId);
  try {
    await fs.access(dir);
  } catch {
    return false;
  }
  await fs.rm(dir, { recursive: true, force: true });
  logger.info({ event: "quarantine.purge-one", trashId });
  return true;
}

/** Purge quarantine bundles older than the retention window. Returns count purged. */
export async function purgeExpiredQuarantine(now: number = Date.now()): Promise<number> {
  const cutoff = now - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const manifests = await listQuarantine();
  let purged = 0;
  for (const m of manifests) {
    // The DLC bin is manual-only: faculty-approved deletes never auto-purge —
    // only a coordinator/master removes them by hand.
    if (m.reason === FACULTY_DELETE_REASON) continue;
    if (Date.parse(m.quarantinedAtISO) < cutoff) {
      await fs.rm(trashDir(m.trashId), { recursive: true, force: true });
      purged++;
    }
  }
  if (purged > 0) {
    logger.info({ event: "quarantine.purge", purged, retentionDays: TRASH_RETENTION_DAYS });
  }
  return purged;
}

/** Best-effort cleanup of a now-empty per-entry upload directory. */
export async function removeEmptyUploadDir(ownerEmail: string, category: string, entryId: string): Promise<void> {
  try {
    await fs.rm(path.join(entryUploadsRoot(), ownerEmail, category, entryId), { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
