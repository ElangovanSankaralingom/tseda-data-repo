import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { DataStore } from "../../lib/dataStore.ts";
import { CATEGORY_STORE_SCHEMA_VERSION } from "../../lib/migrations/index.ts";
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
    const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as {
      version?: number;
      byId?: Record<string, unknown>;
      order?: unknown[];
    };
    assert.equal(raw.version, CATEGORY_STORE_SCHEMA_VERSION);
    assert.deepEqual(raw.byId, {});
    assert.deepEqual(raw.order, []);
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
          {
            id: "legacy-1",
            eventName: "  Legacy no status  ",
            speakerName: "   ",
            startDate: "2026-04-01T08:00:00.000Z",
            attachments: null,
          },
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
    assert.equal(String(entries[0]?.eventName ?? ""), "Legacy no status");
    assert.equal(entries[0]?.speakerName, null);
    assert.equal(String(entries[0]?.startDate ?? ""), "2026-04-01");
    assert.equal(String(entries[0]?.status ?? ""), "draft");
    assert.equal(String(entries[0]?.confirmationStatus ?? ""), "DRAFT");
    assert.equal(String(entries[1]?.confirmationStatus ?? ""), "PENDING_CONFIRMATION");
  });
});

test("DataStore migrates legacy array category files to V2 store format", async () => {
  await withSandbox("datastore-v1-to-v2", async (store) => {
    const filePath = store.categoryFilePath(email, "workshops");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify(
        [
          { id: "legacy-1", eventName: "Legacy 1" },
          { id: "legacy-2", eventName: "Legacy 2" },
        ],
        null,
        2
      ),
      "utf8"
    );

    const entries = await store.readCategory(email, "workshops");
    assert.equal(entries.length, 2);
    assert.equal(String(entries[0]?.id ?? ""), "legacy-1");

    const raw = JSON.parse(await fs.readFile(filePath, "utf8")) as {
      version?: number;
      byId?: Record<string, { id?: string; eventName?: string }>;
      order?: string[];
    };
    assert.equal(raw.version, CATEGORY_STORE_SCHEMA_VERSION);
    assert.deepEqual(raw.order, ["legacy-1", "legacy-2"]);
    assert.equal(raw.byId?.["legacy-2"]?.eventName, "Legacy 2");
  });
});

test("DataStore readEntryById and upsert/delete keep V2 order stable", async () => {
  await withSandbox("datastore-byid-upsert-delete", async (store) => {
    await store.writeCategory(email, "workshops", [
      { id: "a-1", status: "draft", eventName: "A1" },
      { id: "a-2", status: "draft", eventName: "A2" },
    ]);

    const found = await store.readEntryById(email, "workshops", "a-2");
    assert.equal(String(found?.id ?? ""), "a-2");
    assert.equal(String(found?.eventName ?? ""), "A2");

    await store.upsertCategoryEntry(email, "workshops", {
      id: "a-1",
      status: "draft",
      eventName: "A1 Updated",
    });
    await store.upsertCategoryEntry(
      email,
      "workshops",
      {
        id: "a-3",
        status: "draft",
        eventName: "A3",
      },
      { insertPosition: "end" }
    );
    await store.deleteCategoryEntry(email, "workshops", "a-2");

    const raw = JSON.parse(await fs.readFile(store.categoryFilePath(email, "workshops"), "utf8")) as {
      order?: string[];
      byId?: Record<string, { eventName?: string }>;
    };

    assert.deepEqual(raw.order, ["a-1", "a-3"]);
    assert.equal(raw.byId?.["a-1"]?.eventName, "A1 Updated");
    assert.equal(raw.byId?.["a-3"]?.eventName, "A3");
    assert.equal(raw.byId?.["a-2"], undefined);
  });
});

test("DataStore readEntryById resolves directly from byId in V2 files", async () => {
  await withSandbox("datastore-v2-byid-direct", async (store) => {
    const filePath = store.categoryFilePath(email, "case-studies");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          version: CATEGORY_STORE_SCHEMA_VERSION,
          byId: {
            "direct-1": { id: "direct-1", status: "draft", title: "Direct Lookup" },
          },
          order: [],
        },
        null,
        2
      ),
      "utf8"
    );

    const found = await store.readEntryById(email, "case-studies", "direct-1");
    assert.equal(String(found?.id ?? ""), "direct-1");
    assert.equal(String(found?.title ?? ""), "Direct Lookup");

    const list = await store.readCategory(email, "case-studies");
    assert.equal(list.length, 1);
    assert.equal(String(list[0]?.id ?? ""), "direct-1");
  });
});
