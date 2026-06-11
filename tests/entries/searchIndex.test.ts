import assert from "node:assert/strict";
import test from "node:test";
import { createEntry, deleteEntry } from "../../lib/entries/lifecycle.ts";
import type { CategoryKey } from "../../lib/entries/types.ts";
import {
  buildSearchText,
  searchAllUsers,
  searchUserEntries,
} from "../../lib/search/searchIndex.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

const ownerEmail = "faculty.search@tce.edu";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("buildSearchText normalizes text for token matching", () => {
  const text = buildSearchText(
    {
      id: "w-1",
      workshopName: "  AI/ML Workshop: 2026!  ",
      resourcePersonName: "Dr. Jane Doe",
      yearOfStudy: "2nd year",
      currentSemester: 3,
    },
    "workshops"
  );

  assert.equal(text.includes("ai ml workshop 2026"), true);
  assert.equal(text.includes("dr jane doe"), true);
  assert.equal(text.includes("workshops"), true);
});

test("searchUserEntries finds indexed entries and supports category filter", async () => {
  await withSandbox("search-user-entries", async () => {
    const workshop = await createEntry(ownerEmail, "workshops", {
      workshopName: "AI Foundations Workshop",
      resourcePersonName: "Dr Ada",
    });
    const guest = await createEntry(ownerEmail, "guest-lectures", {
      topicOfLecture: "AI Ethics Lecture",
      guestSpeakerName: "Dr Turing",
    });

    const all = await searchUserEntries(ownerEmail, "ai");
    assert.equal(all.ok, true);
    if (!all.ok) return;
    const allIds = new Set(all.data.map((row) => row.entryId));
    assert.equal(allIds.has(String(workshop.id)), true);
    assert.equal(allIds.has(String(guest.id)), true);

    const filtered = await searchUserEntries(ownerEmail, "ai", {
      category: "workshops",
    });
    assert.equal(filtered.ok, true);
    if (!filtered.ok) return;
    assert.equal(filtered.data.length, 1);
    assert.equal(filtered.data[0]?.entryId, String(workshop.id));
    assert.equal(filtered.data[0]?.category, "workshops");
  });
});

test("search index removes deleted entries", async () => {
  await withSandbox("search-delete-update", async () => {
    const category: CategoryKey = "workshops";
    const created = await createEntry(ownerEmail, category, {
      workshopName: "Quantum Search Target",
    });

    const beforeDelete = await searchUserEntries(ownerEmail, "quantum search target");
    assert.equal(beforeDelete.ok, true);
    if (!beforeDelete.ok) return;
    assert.equal(beforeDelete.data.some((row) => row.entryId === String(created.id)), true);

    await deleteEntry(ownerEmail, category, String(created.id));
    const afterDelete = await searchUserEntries(ownerEmail, "quantum search target");
    assert.equal(afterDelete.ok, true);
    if (!afterDelete.ok) return;
    assert.equal(afterDelete.data.some((row) => row.entryId === String(created.id)), false);
  });
});

test("searchAllUsers returns owner metadata for admin use", async () => {
  await withSandbox("search-all-users", async () => {
    await createEntry("faculty.one@tce.edu", "workshops", {
      workshopName: "Distributed Systems Workshop",
    });
    await createEntry("faculty.two@tce.edu", "fdp-attended", {
      programName: "Distributed AI FDP",
    });

    const global = await searchAllUsers("distributed");
    assert.equal(global.ok, true);
    if (!global.ok) return;
    const owners = new Set(global.data.map((row) => row.userEmail));
    assert.equal(owners.has("faculty.one@tce.edu"), true);
    assert.equal(owners.has("faculty.two@tce.edu"), true);
  });
});
