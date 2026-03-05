import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  approveEntry,
  createEntry,
  deleteEntry,
  sendForConfirmation,
} from "../../lib/entryEngine.ts";
import { ensureUserIndex } from "../../lib/data/indexStore.ts";
import { getUserStoreDir } from "../../lib/userStore.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const ownerEmail = "faculty.index@tce.edu";
const adminEmail = "senarch@tce.edu";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("ensureUserIndex creates index.json from category files when missing", async () => {
  await withSandbox("index-store-create", async () => {
    await createEntry(ownerEmail, "workshops", {
      eventName: "Index Seed Entry",
    });

    const ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;

    const indexPath = path.join(getUserStoreDir(ownerEmail), "index.json");
    await fs.access(indexPath);

    assert.equal(ensured.data.totalsByCategory.workshops, 1);
    assert.equal(ensured.data.countsByStatus.DRAFT, 1);
  });
});

test("entry confirmation transitions keep pending and approved index counts in sync", async () => {
  await withSandbox("index-store-status", async () => {
    const created = await createEntry(ownerEmail, "workshops", {
      eventName: "Index Confirmation Entry",
      status: "final",
    });

    await sendForConfirmation(ownerEmail, "workshops", String(created.id));
    let ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;
    assert.equal(ensured.data.countsByStatus.PENDING_CONFIRMATION, 1);
    assert.equal(ensured.data.pendingByCategory.workshops, 1);

    await approveEntry(adminEmail, "workshops", ownerEmail, String(created.id));
    ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;
    assert.equal(ensured.data.countsByStatus.PENDING_CONFIRMATION, 0);
    assert.equal(ensured.data.countsByStatus.APPROVED, 1);
    assert.equal(ensured.data.approvedByCategory.workshops, 1);
  });
});

test("deleteEntry updates index totals without rebuilding manually", async () => {
  await withSandbox("index-store-delete", async () => {
    const created = await createEntry(ownerEmail, "workshops", {
      eventName: "Index Delete Entry",
    });

    let ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;
    assert.equal(ensured.data.totalsByCategory.workshops, 1);

    await deleteEntry(ownerEmail, "workshops", String(created.id));
    ensured = await ensureUserIndex(ownerEmail);
    assert.equal(ensured.ok, true);
    if (!ensured.ok) return;
    assert.equal(ensured.data.totalsByCategory.workshops, 0);
    assert.equal(ensured.data.countsByStatus.DRAFT, 0);
  });
});

