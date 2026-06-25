import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  getAdminUsersConfig,
  removeAdminUser,
  setAdminUsersConfig,
  isMasterAdmin as isMasterRole,
  isRootMaster,
} from "../../lib/admin/roles.ts";
import { isMasterAdmin, ROOT_MASTER_EMAIL, MASTER_ADMIN_EMAIL } from "../../lib/admin.ts";

test("default config seeds both founders as masters", async () => {
  const ctx = await createTestDataRoot("roles-seed");
  try {
    const config = getAdminUsersConfig();
    const byEmail = Object.fromEntries(config.users.map((u) => [u.email, u]));
    assert.ok(byEmail[ROOT_MASTER_EMAIL]?.roles.includes("MASTER_ADMIN"), "root is master");
    assert.ok(byEmail[MASTER_ADMIN_EMAIL]?.roles.includes("MASTER_ADMIN"), "founder is master");
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("root master (hodarch) cannot be removed", async () => {
  const ctx = await createTestDataRoot("roles-root-protected");
  try {
    getAdminUsersConfig();
    const after = removeAdminUser(ROOT_MASTER_EMAIL);
    assert.ok(
      after.users.some((u) => u.email === ROOT_MASTER_EMAIL && u.roles.includes("MASTER_ADMIN")),
      "root remains a master after a removal attempt"
    );
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("founding master (senarch) IS removable", async () => {
  const ctx = await createTestDataRoot("roles-founder-removable");
  try {
    getAdminUsersConfig();
    const after = removeAdminUser(MASTER_ADMIN_EMAIL);
    assert.ok(!after.users.some((u) => u.email === MASTER_ADMIN_EMAIL), "founder removed");
    assert.ok(after.users.some((u) => u.email === ROOT_MASTER_EMAIL), "root still present");
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("demoting the root master is auto-reverted on next load", async () => {
  const ctx = await createTestDataRoot("roles-root-demote");
  try {
    getAdminUsersConfig();
    // Attempt to strip the root's roles entirely.
    setAdminUsersConfig([{ email: ROOT_MASTER_EMAIL, roles: [] }]);
    const reloaded = getAdminUsersConfig();
    const root = reloaded.users.find((u) => u.email === ROOT_MASTER_EMAIL);
    assert.ok(root?.roles.includes("MASTER_ADMIN"), "root MASTER_ADMIN role restored");
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("both founders pass the static master check; only root passes isRootMaster", () => {
  assert.equal(isMasterAdmin(ROOT_MASTER_EMAIL), true);
  assert.equal(isMasterAdmin(MASTER_ADMIN_EMAIL), true);
  assert.equal(isMasterAdmin("random@tce.edu"), false);
  assert.equal(isRootMaster(ROOT_MASTER_EMAIL), true);
  assert.equal(isRootMaster(MASTER_ADMIN_EMAIL), false);
});

test("role-based isMasterAdmin recognises a dynamically added master", async () => {
  const ctx = await createTestDataRoot("roles-dynamic-master");
  try {
    getAdminUsersConfig();
    setAdminUsersConfig([
      { email: ROOT_MASTER_EMAIL, roles: ["MASTER_ADMIN"] },
      { email: "newmaster@tce.edu", roles: ["MASTER_ADMIN"] },
    ]);
    assert.equal(isMasterRole("newmaster@tce.edu"), true);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
