import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { getAdminUsersConfig } from "../../lib/admin/roles.ts";
import { ROOT_MASTER_EMAIL } from "../../lib/admin.ts";
import {
  canViewAnalytics,
  canManageAdminUsers,
  canAccessSettings,
  canRunMaintenance,
  canRunIntegrityTools,
  canManageBackups,
  canExport,
  canViewAudit,
} from "../../lib/admin/roles.ts";
import {
  upsertCoordinatorType,
  setCoordinatorAssignment,
  canApproveEditForCategory,
  canCoordinatorExport,
} from "../../lib/admin/coordinators.ts";

const COORD = "coord1@tce.edu";

// Locks the governance invariant: a coordinator must NEVER gain a master-only
// capability. If a future change leaks one of these, this test fails.
test("a coordinator holds NO master-only capability", async () => {
  const ctx = await createTestDataRoot("perm-matrix");
  try {
    getAdminUsersConfig();
    upsertCoordinatorType({
      id: "cs",
      label: "CS",
      categories: ["case-studies"],
      powers: { approveEdits: true, approveDeletes: true, export: true },
    });
    setCoordinatorAssignment(COORD, ["cs"]);

    // Master-only — all must be false for a coordinator.
    for (const check of [
      canViewAnalytics,
      canManageAdminUsers,
      canAccessSettings,
      canRunMaintenance,
      canRunIntegrityTools,
      canManageBackups,
      canExport,
      canViewAudit,
    ]) {
      assert.equal(check(COORD), false, `${check.name} must be false for a coordinator`);
    }

    // But their scoped powers DO work.
    assert.equal(canApproveEditForCategory(COORD, "case-studies"), true);
    assert.equal(canCoordinatorExport(COORD, "case-studies"), true);

    // And the master keeps the master-only capabilities.
    assert.equal(canViewAnalytics(ROOT_MASTER_EMAIL), true);
    assert.equal(canManageAdminUsers(ROOT_MASTER_EMAIL), true);
    assert.equal(canExport(ROOT_MASTER_EMAIL), true);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
