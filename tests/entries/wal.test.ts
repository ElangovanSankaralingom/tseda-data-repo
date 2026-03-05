import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  approveEntry,
  createEntry,
  sendForConfirmation,
  updateEntry,
} from "../../lib/entryEngine.ts";
import { rebuildUserIndexFromWal } from "../../lib/data/recovery.ts";
import { readEvents } from "../../lib/data/wal.ts";
import { getUserStoreDir } from "../../lib/userStore.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const ownerEmail = "faculty.wal@tce.edu";
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

test("entry mutations append WAL events with action and actor metadata", async () => {
  await withSandbox("wal-events", async () => {
    const created = await createEntry(ownerEmail, "workshops", {
      eventName: "WAL Workshop",
      status: "final",
    });

    await updateEntry(ownerEmail, "workshops", String(created.id), {
      eventName: "WAL Workshop Updated",
    });
    await sendForConfirmation(ownerEmail, "workshops", String(created.id));
    await approveEntry(adminEmail, "workshops", ownerEmail, String(created.id));

    const eventsResult = await readEvents(ownerEmail);
    assert.equal(eventsResult.ok, true);
    if (!eventsResult.ok) return;

    const actions = eventsResult.data.map((event) => event.action);
    assert.equal(actions.includes("CREATE"), true);
    assert.equal(actions.includes("UPDATE") || actions.includes("UPLOAD_REPLACE"), true);
    assert.equal(actions.includes("SEND_FOR_CONFIRMATION"), true);
    assert.equal(actions.includes("APPROVE"), true);

    const approveEvent = eventsResult.data.find((event) => event.action === "APPROVE");
    assert.equal(approveEvent?.actor.role, "admin");
    assert.equal(approveEvent?.actor.email, adminEmail);
    assert.equal(approveEvent?.userEmail, ownerEmail);
  });
});

test("rebuildUserIndexFromWal restores index snapshot without category scan", async () => {
  await withSandbox("wal-recovery", async () => {
    const created = await createEntry(ownerEmail, "workshops", {
      eventName: "Recovery Workshop",
      status: "final",
    });
    await sendForConfirmation(ownerEmail, "workshops", String(created.id));

    const userDir = getUserStoreDir(ownerEmail);
    await fs.rm(path.join(userDir, "index.json"), { force: true });
    await fs.rm(path.join(userDir, "workshops.json"), { force: true });

    const rebuilt = await rebuildUserIndexFromWal(ownerEmail);
    assert.equal(rebuilt.ok, true);
    if (!rebuilt.ok) return;

    assert.equal(rebuilt.data.totalsByCategory.workshops, 1);
    assert.equal(rebuilt.data.countsByStatus.PENDING_CONFIRMATION, 1);
    assert.equal(rebuilt.data.pendingByCategory.workshops, 1);

    await fs.access(path.join(userDir, "index.json"));
  });
});

