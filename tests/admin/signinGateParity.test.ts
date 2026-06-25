import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { FACULTY, findFacultyByEmail } from "../../lib/facultyDirectory.ts";
import { ROOT_MASTER_EMAIL } from "../../lib/admin.ts";
import {
  getFacultyRegistry,
  isFacultyAllowed,
  setFacultyStatus,
} from "../../lib/admin/facultyRegistry.ts";

// The registry seeds from the prior hardcoded directory, so the new sign-in gate
// (isFacultyAllowed) must allow exactly the same people as the old one — plus the
// root master, minus anyone explicitly deactivated.
test("new gate matches the old hardcoded gate for all seeded faculty", async () => {
  const ctx = await createTestDataRoot("signin-parity");
  try {
    getFacultyRegistry(); // seeds from FACULTY
    for (const f of FACULTY) {
      assert.equal(isFacultyAllowed(f.email), !!findFacultyByEmail(f.email), f.email);
      assert.equal(isFacultyAllowed(f.email), true, f.email);
    }
    // A non-faculty @tce.edu is rejected, same as before.
    assert.equal(isFacultyAllowed("stranger@tce.edu"), false);
    // The root master is now allowed (the old gate wrongly blocked it).
    assert.equal(isFacultyAllowed(ROOT_MASTER_EMAIL), true);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});

test("deactivating a faculty blocks sign-in", async () => {
  const ctx = await createTestDataRoot("signin-deactivate");
  try {
    getFacultyRegistry();
    const victim = FACULTY[0].email;
    assert.equal(isFacultyAllowed(victim), true);
    setFacultyStatus(victim, "inactive");
    assert.equal(isFacultyAllowed(victim), false);
  } finally {
    ctx.restore();
    await ctx.cleanup();
  }
});
