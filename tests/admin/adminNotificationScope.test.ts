import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { getAdminUsersConfig } from "../../lib/admin/roles.ts";
import { ROOT_MASTER_EMAIL } from "../../lib/admin.ts";
import { upsertCoordinatorType, setCoordinatorAssignment } from "../../lib/admin/coordinators.ts";
import { filterVisibleAdminNotifications } from "../../lib/confirmations/adminNotificationHelpers.ts";
import type { AdminNotification } from "../../lib/confirmations/types.ts";

const COORD = "coord1@tce.edu";

function notif(type: string, categoryKey?: string): AdminNotification {
  return {
    id: `${type}-${categoryKey ?? "none"}`,
    type: type as AdminNotification["type"],
    title: "t",
    message: "m",
    createdAt: new Date().toISOString(),
    readBy: [],
    categoryKey,
  };
}

const FEED: AdminNotification[] = [
  notif("edit_request", "case-studies"),
  notif("edit_request", "fdp-attended"),
  notif("delete_request", "case-studies"),
  notif("new_user"),
];

test("master sees the entire admin feed", async () => {
  const ctx = await createTestDataRoot("notif-master");
  try {
    getAdminUsersConfig();
    const visible = filterVisibleAdminNotifications(FEED, ROOT_MASTER_EMAIL);
    assert.equal(visible.length, FEED.length);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("a pure coordinator sees only their categories' edit requests", async () => {
  const ctx = await createTestDataRoot("notif-coord");
  try {
    getAdminUsersConfig();
    upsertCoordinatorType({ id: "cs", label: "CS", categories: ["case-studies"], powers: { approveEdits: true, export: false } });
    setCoordinatorAssignment(COORD, ["cs"]);

    const visible = filterVisibleAdminNotifications(FEED, COORD);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].type, "edit_request");
    assert.equal(visible[0].categoryKey, "case-studies");
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
