import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createBackupZip,
  listBackups,
  restoreBackup,
} from "../../lib/backup/backupService.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

/**
 * S1 (TECH-AUDIT-2026-06): the backup restore path did not exist. These tests
 * prove the full round trip (create -> mutate -> restore brings data back) and
 * that a CRC-corrupted archive is rejected rather than silently applied.
 */

async function withBackupSandbox<T>(label: string, run: (dataRoot: string, backupRoot: string) => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  const dataRoot = path.resolve(process.env.DATA_ROOT ?? ".data");
  const backupRoot = path.join(path.dirname(dataRoot), `backups-${label}-${Date.now()}`);
  process.env.DATA_BACKUP_ROOT = backupRoot;
  try {
    return await run(dataRoot, backupRoot);
  } finally {
    delete process.env.DATA_BACKUP_ROOT;
    await fs.rm(backupRoot, { recursive: true, force: true });
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("backup restore round trip recovers mutated data", async () => {
  await withBackupSandbox("restore-roundtrip", async (dataRoot, backupRoot) => {
    // Seed a known file in the live data root.
    const probe = path.join(dataRoot, "users", "probe@tce.edu", "marker.json");
    await fs.mkdir(path.dirname(probe), { recursive: true });
    await fs.writeFile(probe, JSON.stringify({ value: "original" }), "utf8");

    const created = await createBackupZip();
    assert.equal(created.ok, true);
    if (!created.ok) return;

    // Mutate AND delete after the backup.
    await fs.writeFile(probe, JSON.stringify({ value: "corrupted-later" }), "utf8");
    const newFile = path.join(dataRoot, "users", "probe@tce.edu", "added-after.json");
    await fs.writeFile(newFile, "should-be-gone-after-restore", "utf8");

    const listed = await listBackups();
    assert.equal(listed.ok, true);
    if (!listed.ok || listed.data.length === 0) {
      assert.fail("backup not listed");
      return;
    }

    const restored = await restoreBackup(listed.data[0].filename);
    assert.equal(restored.ok, true, restored.ok ? "" : String(restored.error?.message));
    if (!restored.ok) return;
    assert.ok(restored.data.filesRestored >= 1);

    // Original content is back; the post-backup file is gone.
    assert.equal(JSON.parse(await fs.readFile(probe, "utf8")).value, "original");
    await assert.rejects(fs.access(newFile), "post-backup file should not survive restore");

    // The pre-restore data was moved aside, not destroyed.
    await fs.access(restored.data.previousDataMovedTo);
    await fs.rm(restored.data.previousDataMovedTo, { recursive: true, force: true });
    void backupRoot;
  });
});

test("restore rejects a CRC-corrupted archive", async () => {
  await withBackupSandbox("restore-corrupt", async (dataRoot, backupRoot) => {
    const probe = path.join(dataRoot, "users", "probe@tce.edu", "marker.json");
    await fs.mkdir(path.dirname(probe), { recursive: true });
    await fs.writeFile(probe, JSON.stringify({ value: "original" }), "utf8");

    const created = await createBackupZip();
    assert.equal(created.ok, true);
    if (!created.ok) return;

    // Flip a byte inside the FIRST entry's stored file data (not the central
    // directory, which restore does not consume) to break its CRC.
    const buf = await fs.readFile(created.data.filePath);
    assert.equal(buf.readUInt32LE(0), 0x04034b50, "expected a local file header at offset 0");
    const nameLen = buf.readUInt16LE(26);
    const extraLen = buf.readUInt16LE(28);
    const dataStart = 30 + nameLen + extraLen;
    buf[dataStart] ^= 0xff;
    await fs.writeFile(created.data.filePath, buf);

    const restored = await restoreBackup(created.data.filename);
    assert.equal(restored.ok, false, "corrupted backup must be rejected");

    // Live data untouched by the rejected restore.
    assert.equal(JSON.parse(await fs.readFile(probe, "utf8")).value, "original");
    void backupRoot;
  });
});
