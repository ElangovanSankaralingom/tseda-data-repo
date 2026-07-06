import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { AWARD_METRICS } from "../../data/awardMetrics.ts";
import { computeFacultyAwardScore } from "../../lib/awards/scoring.ts";

/**
 * DERIVER COVERAGE GUARD (2026-07 wiring audit): every entry- or
 * profile-sourced metric in the rulebook MUST have a deriver wired in the
 * scoring engine. The engine's fallback reports "No deriver wired" in the
 * metric notes — a metric silently scoring zero because someone added a
 * rulebook row without a deriver is exactly the class of disconnection
 * this repo bans. Behavioral check: score an empty faculty and assert the
 * fallback note never appears.
 */

test("every entry/profile-sourced award metric has a deriver wired", async () => {
  const sandbox = await createTestDataRoot("deriver-coverage");
  try {
    const score = await computeFacultyAwardScore(
      "deriver.guard@tce.edu",
      "Academic Year 2025-2026",
    );

    const autoTracked = AWARD_METRICS.filter(
      (m) => m.source === "entry" || m.source === "profile",
    );
    assert.ok(autoTracked.length > 0, "rulebook must have auto-tracked metrics");
    assert.equal(score.metrics.length, AWARD_METRICS.length, "score covers the whole rulebook");

    const unwired = score.metrics.filter((m) => m.notes.some((n) => n.includes("No deriver wired")));
    assert.deepEqual(
      unwired.map((m) => m.id),
      [],
      `metrics without a deriver: ${unwired.map((m) => m.id).join(", ")}`,
    );
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
});
