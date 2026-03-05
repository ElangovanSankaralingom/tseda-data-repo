import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DataStore } from "../../lib/dataStore.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const email = "faculty.store@tce.edu";

async function withSandbox<T>(label: string, run: (store: DataStore) => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  const store = new DataStore();
  try {
    return await run(store);
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("DataStore readCategory auto-creates missing category files", async () => {
  await withSandbox("datastore-missing-file", async (store) => {
    const entries = await store.readCategory(email, "workshops");
    assert.deepEqual(entries, []);

    const filePath = store.categoryFilePath(email, "workshops");
    const raw = await fs.readFile(filePath, "utf8");
    assert.equal(raw.trim(), "[]");
  });
});

test("DataStore write/read round-trip keeps persisted entries", async () => {
  await withSandbox("datastore-roundtrip", async (store) => {
    const initial = [
      { id: "e-1", status: "draft", eventName: "Roundtrip", attachments: [] },
    ];

    await store.writeCategory(email, "workshops", initial);
    const loaded = await store.readCategory(email, "workshops");

    assert.equal(loaded.length, 1);
    assert.equal(String(loaded[0]?.id ?? ""), "e-1");
    assert.equal(String(loaded[0]?.eventName ?? ""), "Roundtrip");
  });
});

test("DataStore normalization applies default attachments and status values", async () => {
  await withSandbox("datastore-normalize", async (store) => {
    const filePath = store.categoryFilePath(email, "guest-lectures");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify(
        [
          { id: "legacy-1", eventName: "Legacy no status", attachments: null },
          { id: "legacy-2", requestEditStatus: "pending" },
        ],
        null,
        2
      ),
      "utf8"
    );

    const entries = await store.readCategory(email, "guest-lectures");
    assert.equal(entries.length, 2);
    assert.deepEqual(entries[0]?.attachments, []);
    assert.equal(String(entries[0]?.status ?? ""), "draft");
    assert.equal(String(entries[0]?.confirmationStatus ?? ""), "DRAFT");
    assert.equal(String(entries[1]?.confirmationStatus ?? ""), "PENDING_CONFIRMATION");
  });
});
