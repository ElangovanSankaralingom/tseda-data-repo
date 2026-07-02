import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  createEntry,
  updateEntry,
  listEntriesForCategory,
} from "../../lib/entries/lifecycle.ts";

/**
 * 2026-07 audit gap: no engine-level concurrency coverage. The dataStore
 * layer already proves serialized upserts; these tests prove the PUBLIC
 * engine facade survives simultaneous PATCH-style traffic (same user, same
 * category) without lost updates or store corruption — the "two tabs open"
 * scenario.
 */

const OWNER = "faculty.concurrent@tce.edu";
const CATEGORY = "workshops" as const;

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("engine: concurrent creates in one category all survive (no lost updates)", async () => {
  await withSandbox("engine-concurrent-creates", async () => {
    const COUNT = 8;
    const created = await Promise.all(
      Array.from({ length: COUNT }, (_, i) =>
        createEntry(OWNER, CATEGORY, { workshopName: `Concurrent workshop ${i}` }),
      ),
    );

    const ids = new Set(created.map((entry) => String(entry.id)));
    assert.equal(ids.size, COUNT, "every create must yield a distinct id");

    const listed = await listEntriesForCategory(OWNER, CATEGORY);
    assert.equal(
      listed.length,
      COUNT,
      "read-modify-write races must not drop concurrently created entries",
    );
  });
});

test("engine: concurrent updates to one entry never corrupt the store", async () => {
  await withSandbox("engine-concurrent-updates", async () => {
    const entry = await createEntry(OWNER, CATEGORY, { workshopName: "Base" });
    const entryId = String(entry.id);

    const WRITERS = 6;
    const names = Array.from({ length: WRITERS }, (_, i) => `Writer ${i}`);
    await Promise.all(
      names.map((workshopName) => updateEntry(OWNER, CATEGORY, entryId, { workshopName })),
    );

    // The store must remain readable, hold exactly one copy of the entry,
    // and its value must be one whole write — never a torn/merged artifact.
    const listed = await listEntriesForCategory(OWNER, CATEGORY);
    assert.equal(listed.length, 1, "concurrent updates must not duplicate the entry");

    const finalName = String((listed[0] as Record<string, unknown>).workshopName);
    assert.ok(
      names.includes(finalName),
      `final value must be one of the concurrent writes, got: ${finalName}`,
    );
  });
});

test("engine: concurrent creates for different users stay isolated", async () => {
  await withSandbox("engine-concurrent-users", async () => {
    const other = "faculty.concurrent2@tce.edu";
    await Promise.all([
      createEntry(OWNER, CATEGORY, { workshopName: "Mine" }),
      createEntry(other, CATEGORY, { workshopName: "Theirs" }),
    ]);

    const mine = await listEntriesForCategory(OWNER, CATEGORY);
    const theirs = await listEntriesForCategory(other, CATEGORY);
    assert.equal(mine.length, 1);
    assert.equal(theirs.length, 1);
    assert.notEqual(
      String((mine[0] as Record<string, unknown>).workshopName),
      String((theirs[0] as Record<string, unknown>).workshopName),
    );
  });
});
