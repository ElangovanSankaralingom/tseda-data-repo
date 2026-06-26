import assert from "node:assert/strict";
import test from "node:test";
import { appendFeedEvent, listFeedEvents, removeFeedEvent, toggleReaction } from "../../lib/feed/feedStore.ts";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("appendFeedEvent dedups by deterministic id (idempotent emission)", async () => {
  await withSandbox("feed-dedup", async () => {
    await appendFeedEvent({ id: "streak_won:e1", type: "streak_won", actorEmail: "a@tce.edu", categoryKey: "workshops" });
    await appendFeedEvent({ id: "streak_won:e1", type: "streak_won", actorEmail: "a@tce.edu", categoryKey: "workshops" });
    const events = await listFeedEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "streak_won:e1");
    assert.equal(events[0]?.categoryKey, "workshops");
  });
});

test("listFeedEvents returns newest first", async () => {
  await withSandbox("feed-order", async () => {
    await appendFeedEvent({ id: "a", type: "streak_started", actorEmail: "a@tce.edu", createdAt: "2026-01-01T00:00:00.000Z" });
    await appendFeedEvent({ id: "b", type: "streak_won", actorEmail: "b@tce.edu", createdAt: "2026-02-01T00:00:00.000Z" });
    const events = await listFeedEvents();
    assert.equal(events.length, 2);
    assert.equal(events[0]?.id, "b");
    assert.equal(events[1]?.id, "a");
  });
});

test("toggleReaction adds then removes a viewer's reaction", async () => {
  await withSandbox("feed-react", async () => {
    await appendFeedEvent({ id: "x", type: "streak_won", actorEmail: "a@tce.edu" });

    const added = await toggleReaction("x", "fire", "viewer@tce.edu");
    assert.ok(added);
    assert.deepEqual(added?.reactions.fire, ["viewer@tce.edu"]);

    const removed = await toggleReaction("x", "fire", "viewer@tce.edu");
    assert.ok(removed);
    assert.deepEqual(removed?.reactions.fire, []);
  });
});

test("toggleReaction rejects an invalid reaction or a missing event", async () => {
  await withSandbox("feed-react-invalid", async () => {
    await appendFeedEvent({ id: "y", type: "streak_started", actorEmail: "a@tce.edu" });
    assert.equal(await toggleReaction("y", "bogus", "v@tce.edu"), null);
    assert.equal(await toggleReaction("missing", "like", "v@tce.edu"), null);
  });
});

test("removeFeedEvent removes a single event and is idempotent on a missing id", async () => {
  await withSandbox("feed-remove", async () => {
    await appendFeedEvent({ id: "r1", type: "streak_won", actorEmail: "a@tce.edu" });
    await appendFeedEvent({ id: "r2", type: "streak_started", actorEmail: "b@tce.edu" });

    assert.equal(await removeFeedEvent("r1"), true);
    const events = await listFeedEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.id, "r2");

    assert.equal(await removeFeedEvent("r1"), false);
  });
});
