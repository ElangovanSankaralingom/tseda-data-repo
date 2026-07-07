import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  addFaculty,
  setBetaStatus,
  setFacultyStatus,
  setFacultyDepartments,
  getFacultyRegistry,
  getFacultyRecord,
} from "../../lib/admin/facultyRegistry.ts";
import { enterDemoMode, setDemoRoster, getDemoState, resetDemoStateCache } from "../../lib/demo/state.ts";
import { setAwardPointsOverride, getAwardPointsConfig } from "../../lib/awards/config.ts";
import { setInterviewAward, readInterviewPointsForYear } from "../../lib/awards/interview.ts";
import { AWARD_METRICS } from "../../data/awardMetrics.ts";

/**
 * CONCURRENCY / DATA-INTEGRITY GUARDS (Elan's audit item 4, 2026-07):
 *
 * The SYNC stores (faculty registry, roles, coordinators, action history,
 * preferences, export templates) are race-safe on Node's single thread
 * precisely because their read-modify-write never yields — plus, as of
 * this audit, they write ATOMICALLY (temp + fsync + rename) so a crash
 * can never tear the file. The safety property is fragile though: ONE
 * `await` inserted between read and write reopens the race. The static
 * tripwire below fails the suite if anyone async-ifies them.
 *
 * The ASYNC stores that DO yield mid-RMW (demo state, settings, award
 * points config, interview points, feedback claims) are now serialized
 * with withLock. The stress tests here hammer them with Promise.all and
 * assert zero lost updates — these tests FAIL on the pre-lock code.
 */

const MASTER = "senarch@tce.edu";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    resetDemoStateCache();
    return await run();
  } finally {
    resetDemoStateCache();
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("registry: interleaved concurrent mutations lose nothing (sync RMW serializes)", async () => {
  await withSandbox("conc-registry", async () => {
    const emails = Array.from({ length: 10 }, (_, i) => `f${i}@tce.edu`);
    // Concurrent adds.
    await Promise.all(emails.map(async (e, i) => addFaculty(e, `Faculty ${i}`, MASTER)));
    // Concurrent field mutations across users — beta, status, departments.
    await Promise.all([
      ...emails.slice(0, 4).map(async (e) => setBetaStatus(e, "member")),
      ...emails.slice(4, 7).map(async (e) => setFacultyStatus(e, "llp")),
      ...emails.slice(7).map(async (e) => setFacultyDepartments(e, ["architecture"])),
    ]);

    const registry = getFacultyRegistry();
    assert.equal(registry.faculty.filter((f) => f.email.startsWith("f")).length, 10, "no add lost");
    for (const e of emails.slice(0, 4)) assert.equal(getFacultyRecord(e)?.betaStatus, "member", `${e} beta lost`);
    for (const e of emails.slice(4, 7)) assert.equal(getFacultyRecord(e)?.status, "llp", `${e} status lost`);
    for (const e of emails.slice(7)) assert.deepEqual(getFacultyRecord(e)?.departments, ["architecture"], `${e} depts lost`);
  });
});

test("demo state: concurrent activations lose nobody (locked async RMW)", async () => {
  await withSandbox("conc-demo", async () => {
    const users = Array.from({ length: 8 }, (_, i) => `d${i}@tce.edu`);
    for (const u of users) addFaculty(u, u, MASTER);
    await setDemoRoster(users, MASTER);

    // The pre-lock code loses activations here (read-read-write-write).
    await Promise.all(users.map((u) => enterDemoMode(u)));

    const state = await getDemoState();
    for (const u of users) {
      assert.ok(state.active[u], `${u} activation lost — user would hit REAL data believing it's demo`);
    }
  });
});

test("award points config: concurrent overrides on different metrics all survive", async () => {
  await withSandbox("conc-awards", async () => {
    const flat = AWARD_METRICS.filter((m) => m.pointsModel.kind !== "tiered").slice(0, 4);
    assert.ok(flat.length === 4, "need 4 flat-model metrics");
    await Promise.all(flat.map((m) => setAwardPointsOverride(m.id, { points: 7 }, MASTER)));

    const config = await getAwardPointsConfig();
    for (const m of flat) {
      assert.equal(config.overrides[m.id]?.points, 7, `override for ${m.id} lost`);
    }
  });
});

test("interview points: concurrent committee awards on one faculty all survive", async () => {
  await withSandbox("conc-interview", async () => {
    const metrics = AWARD_METRICS.filter((m) => m.source === "interview").slice(0, 3);
    assert.ok(metrics.length >= 2, "need interview metrics");
    const YEAR = "Academic Year 2025-2026";
    await Promise.all(
      metrics.map((m) => setInterviewAward("target@tce.edu", YEAR, m.id, { points: 1 }, MASTER)),
    );
    const awards = await readInterviewPointsForYear("target@tce.edu", YEAR);
    for (const m of metrics) {
      assert.ok(awards[m.id], `committee award for ${m.id} lost`);
    }
  });
});

test("tripwire: sync config stores must STAY synchronous (their race-safety depends on it)", () => {
  // These stores' RMW is safe because it never yields. An `await` (or an
  // async mutator) would silently reopen the lost-update race — fail loudly.
  const SYNC_STORES = [
    "lib/admin/facultyRegistry.ts",
    "lib/admin/roles.ts",
    "lib/admin/coordinators.ts",
  ];
  for (const rel of SYNC_STORES) {
    const source = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
    assert.ok(!/\bawait\b/.test(source), `${rel} must contain no await`);
    assert.ok(!/\basync function\b/.test(source), `${rel} must contain no async function`);
    assert.ok(
      source.includes("atomicWriteTextFileSync"),
      `${rel} must write atomically (crash safety)`,
    );
  }
});
