import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { ROOT_MASTER_EMAIL } from "../../lib/admin.ts";
import {
  getFacultyRegistry,
  getFacultyRecord,
  addFaculty,
  addFacultyBulk,
  setFacultyStatus,
  setFacultyDepartments,
  removeDepartment,
  isFacultyAllowed,
  facultyCanMutate,
} from "../../lib/admin/facultyRegistry.ts";

const NEW = "newfac@tce.edu";

test("registry seeds from the hardcoded faculty + default departments", async () => {
  const ctx = await createTestDataRoot("reg-seed");
  try {
    const config = getFacultyRegistry();
    assert.ok(config.faculty.length > 0, "seeded faculty");
    assert.ok(config.departments.some((d) => d.id === "architecture"));
    assert.ok(config.departments.some((d) => d.id === "planning"));
    assert.ok(config.departments.some((d) => d.id === "design"));
    // A known seeded faculty is active.
    assert.equal(getFacultyRecord("senarch@tce.edu")?.status, "active");
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("add (single + bulk) is permanent and idempotent", async () => {
  const ctx = await createTestDataRoot("reg-add");
  try {
    addFaculty(NEW, "New Faculty", "master@tce.edu");
    assert.equal(getFacultyRecord(NEW)?.name, "New Faculty");
    // Adding again is a no-op (record permanent).
    addFaculty(NEW, "Changed", "master@tce.edu");
    assert.equal(getFacultyRecord(NEW)?.name, "New Faculty");

    const { added } = addFacultyBulk([NEW, "a@tce.edu", "b@tce.edu"], "master@tce.edu");
    assert.equal(added, 2); // NEW already existed
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("status drives sign-in + mutation gates", async () => {
  const ctx = await createTestDataRoot("reg-status");
  try {
    addFaculty(NEW, "New", "master@tce.edu");

    // Active → allowed + can mutate.
    assert.equal(isFacultyAllowed(NEW), true);
    assert.equal(facultyCanMutate(NEW), true);

    // LLP → allowed (read-only): sign in yes, mutate no.
    setFacultyStatus(NEW, "llp");
    assert.equal(isFacultyAllowed(NEW), true);
    assert.equal(facultyCanMutate(NEW), false);

    // Inactive → blocked.
    setFacultyStatus(NEW, "inactive");
    assert.equal(isFacultyAllowed(NEW), false);
    assert.equal(facultyCanMutate(NEW), false);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("root master is always allowed even if not on the list", async () => {
  const ctx = await createTestDataRoot("reg-root");
  try {
    getFacultyRegistry();
    assert.equal(getFacultyRecord(ROOT_MASTER_EMAIL), null); // hodarch not seeded
    assert.equal(isFacultyAllowed(ROOT_MASTER_EMAIL), true); // but always allowed
    assert.equal(facultyCanMutate(ROOT_MASTER_EMAIL), true);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("deleting a department moves its faculty to Unassigned", async () => {
  const ctx = await createTestDataRoot("reg-dept");
  try {
    addFaculty(NEW, "New", "master@tce.edu");
    setFacultyDepartments(NEW, ["architecture", "planning"]);
    assert.deepEqual(getFacultyRecord(NEW)?.departments.sort(), ["architecture", "planning"]);

    removeDepartment("planning");
    assert.deepEqual(getFacultyRecord(NEW)?.departments, ["architecture"]);
    assert.ok(!getFacultyRegistry().departments.some((d) => d.id === "planning"));
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
