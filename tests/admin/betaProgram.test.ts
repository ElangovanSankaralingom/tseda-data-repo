import assert from "node:assert/strict";
import test from "node:test";
import { addFaculty, getBetaStatus, setBetaStatus, isBetaTester } from "../../lib/admin/facultyRegistry.ts";
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

test("beta lifecycle: none -> requested -> member -> none", async () => {
  await withSandbox("beta-lifecycle", async () => {
    addFaculty("beta.user@tce.edu", "Beta User", "admin@tce.edu");
    assert.equal(getBetaStatus("beta.user@tce.edu"), "none");
    assert.equal(isBetaTester("beta.user@tce.edu"), false);

    setBetaStatus("beta.user@tce.edu", "requested");
    assert.equal(getBetaStatus("beta.user@tce.edu"), "requested");
    assert.equal(isBetaTester("beta.user@tce.edu"), false); // requested is NOT a member

    setBetaStatus("beta.user@tce.edu", "member");
    assert.equal(getBetaStatus("beta.user@tce.edu"), "member");
    assert.equal(isBetaTester("beta.user@tce.edu"), true);

    setBetaStatus("beta.user@tce.edu", "none");
    assert.equal(getBetaStatus("beta.user@tce.edu"), "none");
    assert.equal(isBetaTester("beta.user@tce.edu"), false);
  });
});

test("beta status is 'none' (not a member) for an unregistered email", async () => {
  await withSandbox("beta-unknown", async () => {
    assert.equal(getBetaStatus("ghost@tce.edu"), "none");
    assert.equal(isBetaTester("ghost@tce.edu"), false);
  });
});
