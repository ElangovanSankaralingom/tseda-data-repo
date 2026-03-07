import assert from "node:assert/strict";
import test from "node:test";
import {
  CATEGORY_STORE_SCHEMA_VERSION,
  ENTRY_SCHEMA_VERSION,
  USER_INDEX_SCHEMA_VERSION,
  WAL_EVENT_SCHEMA_VERSION,
  migrateCategoryStore,
  migrateEntry,
  migrateUserIndex,
  migrateWalEvent,
} from "../../lib/migrations/index.ts";

test("migrateEntry upgrades legacy entries to canonical format", () => {
  const legacy = {
    id: "legacy-1",
    finalised: true,
    eventName: "  Legacy Event  ",
    speakerName: "   ",
    startDate: "2026-02-05T09:30:00.000Z",
    attachments: null,
    createdAt: "invalid-date",
  };

  const migrated = migrateEntry(legacy);
  assert.equal(migrated.ok, true);
  if (!migrated.ok) return;

  assert.equal(migrated.data.schemaVersion, ENTRY_SCHEMA_VERSION);
  assert.equal(typeof migrated.data.committedAtISO, "string");
  assert.equal(migrated.data.status, undefined);
  assert.equal(migrated.data.confirmationStatus, "GENERATED");
  assert.equal(migrated.data.eventName, "Legacy Event");
  assert.equal(migrated.data.speakerName, null);
  assert.equal(migrated.data.startDate, "2026-02-05");
  assert.deepEqual(migrated.data.attachments, []);
  assert.equal(typeof migrated.data.createdAt, "string");
  assert.equal(typeof migrated.data.updatedAt, "string");
});

test("migrateUserIndex normalizes legacy index payloads", () => {
  const legacy = {
    userEmail: "faculty@tce.edu",
    totalsByCategory: { workshops: 2 },
    countsByStatus: { DRAFT: 2 },
    streakSnapshot: {
      streakActivatedCount: 1,
      activeEntries: [{ id: "e-1", categoryKey: "workshops" }],
    },
  };

  const migrated = migrateUserIndex(legacy);
  assert.equal(migrated.ok, true);
  if (!migrated.ok) return;

  assert.equal(migrated.data.version, USER_INDEX_SCHEMA_VERSION);
  assert.equal(migrated.data.totalsByCategory.workshops, 2);
  assert.equal(migrated.data.countsByStatus.DRAFT, 2);
  assert.equal(migrated.data.countsByStatus.GENERATED, 0);
  assert.equal(migrated.data.streakSnapshot.activeEntries.length, 1);
});

test("migrateWalEvent upgrades and normalizes legacy WAL events", () => {
  const legacy = {
    ts: "2026-03-05T10:00:00.000Z",
    actor: { email: "faculty@tce.edu", role: "user" },
    userEmail: "faculty@tce.edu",
    category: "workshops",
    id: "entry-1",
    action: "update",
    before: { id: "entry-1", status: "draft" },
    after: { id: "entry-1", status: "final", attachments: null },
  };

  const migrated = migrateWalEvent(legacy);
  assert.equal(migrated.ok, true);
  if (!migrated.ok) return;

  assert.equal(migrated.data.v, WAL_EVENT_SCHEMA_VERSION);
  assert.equal(migrated.data.entryId, "entry-1");
  assert.equal(migrated.data.action, "UPDATE");
  assert.equal(migrated.data.before?.status, undefined);
  assert.equal(migrated.data.before?.confirmationStatus, "DRAFT");
  assert.equal(migrated.data.after?.status, undefined);
  assert.equal(migrated.data.after?.schemaVersion, ENTRY_SCHEMA_VERSION);
  assert.equal(migrated.data.after?.confirmationStatus, "DRAFT");
  assert.equal(typeof migrated.data.after?.committedAtISO, "string");
});

test("migrateCategoryStore upgrades legacy entry arrays to V2 byId store", () => {
  const legacy = [
    { id: "legacy-1", eventName: "Legacy One", attachments: null },
    { id: "legacy-2", status: "final", eventName: "Legacy Two" },
  ];

  const migrated = migrateCategoryStore(legacy);
  assert.equal(migrated.ok, true);
  if (!migrated.ok) return;

  assert.equal(migrated.data.version, CATEGORY_STORE_SCHEMA_VERSION);
  assert.deepEqual(migrated.data.order, ["legacy-1", "legacy-2"]);
  assert.equal(migrated.data.byId["legacy-1"]?.schemaVersion, ENTRY_SCHEMA_VERSION);
  assert.deepEqual(migrated.data.byId["legacy-1"]?.attachments, []);
  assert.equal(migrated.data.byId["legacy-2"]?.status, undefined);
  assert.equal(migrated.data.byId["legacy-2"]?.confirmationStatus, "DRAFT");
  assert.equal(typeof migrated.data.byId["legacy-2"]?.committedAtISO, "string");
});
