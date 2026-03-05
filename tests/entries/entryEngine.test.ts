import assert from "node:assert/strict";
import test from "node:test";
import {
  approveEntry,
  createEntry,
  deleteEntry,
  getEntryWorkflowStatus,
  isLockedFromApproval,
  listEntriesForCategory,
  rejectEntry,
  sendForConfirmation,
} from "../../lib/entryEngine.ts";
import type { CategoryKey } from "../../lib/entries/types.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const category: CategoryKey = "workshops";
const ownerEmail = "faculty.engine@tce.edu";
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

test("createEntry stores entry in DRAFT workflow state", async () => {
  await withSandbox("entry-engine-create", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Intro Workshop",
    });

    assert.ok(typeof created.id === "string" && created.id.length > 0);
    assert.equal(getEntryWorkflowStatus(created), "DRAFT");

    const list = await listEntriesForCategory(ownerEmail, category);
    assert.equal(list.length, 1);
    assert.equal(String(list[0]?.id ?? ""), String(created.id));
  });
});

test("sendForConfirmation then approve moves to APPROVED and locks entry", async () => {
  await withSandbox("entry-engine-approve", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Approval Workshop",
      status: "final",
    });

    const pending = await sendForConfirmation(ownerEmail, category, String(created.id));
    assert.equal(getEntryWorkflowStatus(pending), "PENDING_CONFIRMATION");

    const approved = await approveEntry(
      adminEmail,
      category,
      ownerEmail,
      String(created.id)
    );
    assert.equal(getEntryWorkflowStatus(approved), "APPROVED");
    assert.equal(isLockedFromApproval(approved), true);
  });
});

test("rejectEntry moves pending entries to REJECTED and keeps them editable", async () => {
  await withSandbox("entry-engine-reject", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Reject Workshop",
      status: "final",
    });

    await sendForConfirmation(ownerEmail, category, String(created.id));
    const rejected = await rejectEntry(
      adminEmail,
      category,
      ownerEmail,
      String(created.id),
      "Need corrections"
    );

    assert.equal(getEntryWorkflowStatus(rejected), "REJECTED");
    assert.equal(isLockedFromApproval(rejected), false);
  });
});

test("deleteEntry removes persisted records", async () => {
  await withSandbox("entry-engine-delete", async () => {
    const created = await createEntry(ownerEmail, category, {
      eventName: "Delete Workshop",
    });

    const removed = await deleteEntry(ownerEmail, category, String(created.id));
    assert.ok(removed);

    const list = await listEntriesForCategory(ownerEmail, category);
    assert.equal(list.length, 0);
  });
});
