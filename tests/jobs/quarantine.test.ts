import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  quarantineEntry,
  listQuarantine,
  restoreFromQuarantine,
  purgeExpiredQuarantine,
  TRASH_ROOT,
} from "../../lib/jobs/quarantine.ts";
import { ENTRY_UPLOADS_ROOT, resolveEntryUploadPath } from "../../lib/config/storagePaths.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

/**
 * S1 (TECH-AUDIT-2026-06 C4): nightly auto-delete must be RECOVERABLE.
 * These tests prove the quarantine round trip: a destroyed entry's files
 * leave the live root, land in trash, and can be restored byte-for-byte.
 */

const ownerEmail = "faculty.trash@tce.edu";

async function seedUploadFile(storedPath: string, contents: string): Promise<void> {
  const abs = resolveEntryUploadPath(storedPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, contents, "utf8");
}

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("quarantine moves files out of the live root, then restore brings them back", async () => {
  await withSandbox("quarantine-roundtrip", async () => {
    const storedPath = `uploads/${ownerEmail}/workshops/e1/pdf/doc.pdf`;
    await seedUploadFile(storedPath, "PDF-BYTES");
    const liveAbs = resolveEntryUploadPath(storedPath);

    const entry = { id: "e1", workshopName: "Doomed Entry", pdfMeta: { storedPath } };

    const trashId = await quarantineEntry({
      ownerEmail,
      category: "workshops",
      entry,
      filePaths: [storedPath],
      reason: "test",
      entryTitle: "Doomed Entry",
    });

    // File is gone from the live root...
    await assert.rejects(fs.access(liveAbs), "live file should be moved out");

    // ...and the bundle is listed.
    const listed = await listQuarantine();
    assert.equal(listed.some((m) => m.trashId === trashId), true);

    // Restore returns the entry snapshot and re-materializes the file.
    const { entry: restored } = await restoreFromQuarantine(trashId);
    assert.equal((restored as { workshopName?: string }).workshopName, "Doomed Entry");
    assert.equal(await fs.readFile(liveAbs, "utf8"), "PDF-BYTES");

    // Bundle removed after restore.
    assert.equal((await listQuarantine()).some((m) => m.trashId === trashId), false);
  });
});

test("purge removes bundles older than retention, keeps fresh ones", async () => {
  await withSandbox("quarantine-purge", async () => {
    const entry = { id: "e2", workshopName: "Fresh" };
    const trashId = await quarantineEntry({
      ownerEmail,
      category: "workshops",
      entry,
      filePaths: [],
      reason: "test",
      entryTitle: "Fresh",
    });

    // Fresh bundle survives a purge run.
    await purgeExpiredQuarantine(Date.now());
    assert.equal((await listQuarantine()).some((m) => m.trashId === trashId), true);

    // Purge with a far-future "now" treats everything as expired.
    const purged = await purgeExpiredQuarantine(Date.now() + 365 * 24 * 60 * 60 * 1000);
    assert.equal(purged >= 1, true);
    assert.equal((await listQuarantine()).some((m) => m.trashId === trashId), false);
  });
});

// Keep references used so lint doesn't flag the imports if a test is trimmed.
void TRASH_ROOT;
void ENTRY_UPLOADS_ROOT;
