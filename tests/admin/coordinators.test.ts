import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { getAdminUsersConfig } from "../../lib/admin/roles.ts";
import { ROOT_MASTER_EMAIL } from "../../lib/admin.ts";
import {
  upsertCoordinatorType,
  removeCoordinatorType,
  setCoordinatorAssignment,
  getCoordinatorScope,
  getCoordinatorsConfig,
  canCoordinatorApproveEdit,
  canCoordinatorApproveDelete,
  canCoordinatorExport,
  canApproveEditForCategory,
  canApproveDeleteForCategory,
  isEditApprovalCoordinator,
  filterPendingForCoordinator,
  listCoordinatorEmailsForCategory,
  slugifyTypeId,
} from "../../lib/admin/coordinators.ts";

const COORD = "coord1@tce.edu";

test("a type with no valid categories is rejected", async () => {
  const ctx = await createTestDataRoot("coord-invalid");
  try {
    const result = upsertCoordinatorType({ label: "Empty", categories: [], powers: { approveEdits: true, export: false } });
    assert.equal(result, null);
    assert.equal(getCoordinatorsConfig().types.length, 0);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("upsert stores a type with a slugified id", async () => {
  const ctx = await createTestDataRoot("coord-upsert");
  try {
    assert.equal(slugifyTypeId("Case Studies Coordinator"), "case-studies-coordinator");
    const config = upsertCoordinatorType({
      label: "Case Studies Coordinator",
      categories: ["case-studies"],
      powers: { approveEdits: true, export: true },
    });
    assert.ok(config);
    assert.equal(config.types[0].id, "case-studies-coordinator");
    assert.deepEqual(config.types[0].categories, ["case-studies"]);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("scope is the union of assigned types' categories with OR-ed powers", async () => {
  const ctx = await createTestDataRoot("coord-scope");
  try {
    upsertCoordinatorType({ id: "cs", label: "CS", categories: ["case-studies"], powers: { approveEdits: true, export: false } });
    upsertCoordinatorType({ id: "fdp", label: "FDP", categories: ["fdp-attended"], powers: { approveEdits: false, export: true } });
    setCoordinatorAssignment(COORD, ["cs", "fdp"]);

    const scope = getCoordinatorScope(COORD);
    assert.deepEqual(scope.categories.sort(), ["case-studies", "fdp-attended"]);
    assert.equal(scope.approveEdits, true);
    assert.equal(scope.export, true);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("coordinator can approve/export only within scoped categories", async () => {
  const ctx = await createTestDataRoot("coord-perms");
  try {
    upsertCoordinatorType({ id: "cs", label: "CS", categories: ["case-studies"], powers: { approveEdits: true, export: true } });
    setCoordinatorAssignment(COORD, ["cs"]);

    assert.equal(canCoordinatorApproveEdit(COORD, "case-studies"), true);
    assert.equal(canCoordinatorApproveEdit(COORD, "fdp-attended"), false);
    assert.equal(canCoordinatorExport(COORD, "case-studies"), true);
    assert.equal(canCoordinatorApproveEdit(COORD, "not-a-category"), false);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("master can approve edits in any category; coordinator only in scope", async () => {
  const ctx = await createTestDataRoot("coord-master");
  try {
    getAdminUsersConfig(); // seed masters
    upsertCoordinatorType({ id: "cs", label: "CS", categories: ["case-studies"], powers: { approveEdits: true, export: false } });
    setCoordinatorAssignment(COORD, ["cs"]);

    assert.equal(canApproveEditForCategory(ROOT_MASTER_EMAIL, "fdp-attended"), true);
    assert.equal(canApproveEditForCategory(COORD, "case-studies"), true);
    assert.equal(canApproveEditForCategory(COORD, "fdp-attended"), false);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("edit-approval coordinator: queue is scoped to EDIT requests in their categories", async () => {
  const ctx = await createTestDataRoot("coord-queue");
  try {
    upsertCoordinatorType({ id: "cs", label: "CS", categories: ["case-studies"], powers: { approveEdits: true, export: false } });
    setCoordinatorAssignment(COORD, ["cs"]);
    assert.equal(isEditApprovalCoordinator(COORD), true);

    const rows = [
      { categoryKey: "case-studies", status: "EDIT_REQUESTED" },
      { categoryKey: "case-studies", status: "DELETE_REQUESTED" }, // deletes hidden
      { categoryKey: "fdp-attended", status: "EDIT_REQUESTED" }, // out of scope
    ];
    const visible = filterPendingForCoordinator(rows, COORD);
    assert.equal(visible.length, 1);
    assert.equal(visible[0].categoryKey, "case-studies");
    assert.equal(visible[0].status, "EDIT_REQUESTED");
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("an export-only coordinator is not an edit-approval coordinator", async () => {
  const ctx = await createTestDataRoot("coord-export-only");
  try {
    upsertCoordinatorType({ id: "exp", label: "Exp", categories: ["case-studies"], powers: { approveEdits: false, export: true } });
    setCoordinatorAssignment(COORD, ["exp"]);
    assert.equal(isEditApprovalCoordinator(COORD), false);
    assert.deepEqual(filterPendingForCoordinator([{ categoryKey: "case-studies", status: "EDIT_REQUESTED" }], COORD), []);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("approveDeletes power is scoped, and global approvers can always delete", async () => {
  const ctx = await createTestDataRoot("coord-deletes");
  try {
    getAdminUsersConfig(); // seed masters
    upsertCoordinatorType({ id: "cs", label: "CS", categories: ["case-studies"], powers: { approveEdits: true, approveDeletes: true, export: false } });
    upsertCoordinatorType({ id: "fdp", label: "FDP", categories: ["fdp-attended"], powers: { approveEdits: true, approveDeletes: false, export: false } });
    setCoordinatorAssignment(COORD, ["cs", "fdp"]);

    // Coordinator can delete only in the category whose type grants approveDeletes.
    assert.equal(canCoordinatorApproveDelete(COORD, "case-studies"), true);
    assert.equal(canCoordinatorApproveDelete(COORD, "fdp-attended"), false);
    assert.equal(canApproveDeleteForCategory(COORD, "case-studies"), true);
    assert.equal(canApproveDeleteForCategory(COORD, "fdp-attended"), false);

    // Master may delete in any category regardless of coordinator scope.
    assert.equal(canApproveDeleteForCategory(ROOT_MASTER_EMAIL, "fdp-attended"), true);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("removing a type cleans assignments referencing it", async () => {
  const ctx = await createTestDataRoot("coord-remove");
  try {
    upsertCoordinatorType({ id: "cs", label: "CS", categories: ["case-studies"], powers: { approveEdits: true, export: false } });
    setCoordinatorAssignment(COORD, ["cs"]);
    assert.equal(listCoordinatorEmailsForCategory("case-studies").includes(COORD), true);

    removeCoordinatorType("cs");
    assert.equal(getCoordinatorScope(COORD).categories.length, 0);
    assert.equal(listCoordinatorEmailsForCategory("case-studies").length, 0);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
