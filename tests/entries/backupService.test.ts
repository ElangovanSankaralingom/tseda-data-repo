import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createBackupZip,
  cleanupOldBackups,
  listBackups,
  readBackupFile,
  streamBackupZip,
} from "../../lib/backup/backupService.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

async function withSandbox<T>(
  label: string,
  run: (ctx: { dataRoot: string; backupRoot: string }) => Promise<T>
): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  const previousBackupRoot = process.env.DATA_BACKUP_ROOT;
  const backupRoot = path.join(sandbox.root, "backups");
  process.env.DATA_BACKUP_ROOT = backupRoot;
  try {
    return await run({ dataRoot: sandbox.root, backupRoot });
  } finally {
    if (previousBackupRoot === undefined) {
      delete process.env.DATA_BACKUP_ROOT;
    } else {
      process.env.DATA_BACKUP_ROOT = previousBackupRoot;
    }
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("createBackupZip writes zip file and list/read APIs return metadata", async () => {
  await withSandbox("backup-service-create", async ({ dataRoot }) => {
    const sampleFile = path.join(dataRoot, "users", "faculty@tce.edu", "workshops.json");
    await fs.mkdir(path.dirname(sampleFile), { recursive: true });
    await fs.writeFile(sampleFile, JSON.stringify([{ id: "w-1", eventName: "Workshop" }]), "utf8");

    const createResult = await createBackupZip();
    assert.equal(createResult.ok, true);
    if (!createResult.ok) return;
    assert.match(createResult.data.filename, /^backup-\d{8}-\d{6}/);
    assert.ok(createResult.data.sizeBytes > 0);

    const listed = await listBackups();
    assert.equal(listed.ok, true);
    if (!listed.ok) return;
    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0]?.filename, createResult.data.filename);

    const readResult = await readBackupFile(createResult.data.filename);
    assert.equal(readResult.ok, true);
    if (!readResult.ok) return;

    assert.equal(readResult.data.buffer[0], 0x50);
    assert.equal(readResult.data.buffer[1], 0x4b);
    const zipText = readResult.data.buffer.toString("utf8");
    assert.match(zipText, /\.data\/users\/faculty@tce\.edu\/workshops\.json/);
  });
});

test("cleanupOldBackups keeps only requested number of backups", async () => {
  await withSandbox("backup-service-cleanup", async ({ backupRoot }) => {
    await fs.mkdir(backupRoot, { recursive: true });

    const names = [
      "backup-20260101-000001.zip",
      "backup-20260101-000002.zip",
      "backup-20260101-000003.zip",
    ];
    for (let index = 0; index < names.length; index += 1) {
      const filePath = path.join(backupRoot, names[index] ?? "");
      await fs.writeFile(filePath, Buffer.from(`zip-${index}`));
      const stamp = new Date(Date.now() + index * 1000);
      await fs.utimes(filePath, stamp, stamp);
    }

    const cleanup = await cleanupOldBackups({ keepLastN: 2 });
    assert.equal(cleanup.ok, true);

    const listed = await listBackups();
    assert.equal(listed.ok, true);
    if (!listed.ok) return;

    assert.equal(listed.data.length, 2);
    assert.equal(listed.data[0]?.filename, "backup-20260101-000003.zip");
    assert.equal(listed.data[1]?.filename, "backup-20260101-000002.zip");
  });
});

test("streamBackupZip creates on-demand zip buffer", async () => {
  await withSandbox("backup-service-stream", async ({ dataRoot }) => {
    const sampleFile = path.join(dataRoot, "users", "faculty@tce.edu", "index.json");
    await fs.mkdir(path.dirname(sampleFile), { recursive: true });
    await fs.writeFile(sampleFile, JSON.stringify({ version: 1 }), "utf8");

    const streamed = await streamBackupZip();
    assert.equal(streamed.ok, true);
    if (!streamed.ok) return;

    assert.match(streamed.data.filename, /^backup-\d{8}-\d{6}\.zip$/);
    assert.ok(streamed.data.sizeBytes > 0);
    assert.equal(streamed.data.buffer[0], 0x50);
    assert.equal(streamed.data.buffer[1], 0x4b);
  });
});
