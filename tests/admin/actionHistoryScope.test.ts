import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { appendActionHistory, getActionHistory } from "../../lib/admin/actionHistory.ts";

function seed() {
  appendActionHistory({
    actionType: "delete_approved",
    entryId: "e1",
    category: "case-studies",
    entryTitle: "CS one",
    userEmail: "f1@tce.edu",
    userName: "F1",
  });
  appendActionHistory({
    actionType: "edit_granted",
    entryId: "e2",
    category: "fdp-attended",
    entryTitle: "FDP one",
    userEmail: "f2@tce.edu",
    userName: "F2",
  });
}

test("getActionHistory returns all categories when unscoped", async () => {
  const ctx = await createTestDataRoot("history-all");
  try {
    seed();
    const all = getActionHistory({});
    assert.equal(all.total, 2);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("allowedCategories scopes the trail to a coordinator's categories", async () => {
  const ctx = await createTestDataRoot("history-scoped");
  try {
    seed();
    const scoped = getActionHistory({ allowedCategories: ["case-studies"] });
    assert.equal(scoped.total, 1);
    assert.equal(scoped.records[0].category, "case-studies");

    const none = getActionHistory({ allowedCategories: [] });
    assert.equal(none.total, 0);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
