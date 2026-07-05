import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  feedbackAverage,
  readFeedbackClaimForYear,
  setFeedbackClaim,
} from "../../lib/awards/feedback.ts";
import {
  computeFacultyAwardScore,
  listFacultyAcademicYears,
} from "../../lib/awards/scoring.ts";

/**
 * STUDENT-FEEDBACK CLAIM (S3) — ODD/EVEN percentages averaged into the
 * tier: ≥90 → 10, 80–90 → 5, below → 0. Single-semester claims count
 * as-is with an honest note.
 */

const OWNER = "feedback.owner@tce.edu";
const YEAR = "Academic Year 2025-2026";

async function withSandbox<T>(label: string, run: () => Promise<T>): Promise<T> {
  const sandbox = await createTestDataRoot(label);
  try {
    return await run();
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
}

test("feedback claim: average drives the tier; years listed; notes honest", async () => {
  await withSandbox("feedback-tier", async () => {
    // 92 + 88 → average 90 → top tier.
    await setFeedbackClaim(OWNER, YEAR, { odd: 92, even: 88 }, OWNER);
    const claim = await readFeedbackClaimForYear(OWNER, YEAR);
    assert.equal(feedbackAverage(claim), 90);

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "student_feedback");
    assert.equal(metric?.points, 10, "average 90 hits the ≥90 tier");
    assert.equal(metric?.status, "scored");
    assert.equal(metric?.count, 2, "both semesters entered");
    assert.ok(metric?.notes.some((n) => n.includes("average 90%")));

    // Claim-only faculty still get the year listed (no entries exist).
    const years = await listFacultyAcademicYears(OWNER);
    assert.ok(years.includes(YEAR));

    // Middle tier: 82 average.
    await setFeedbackClaim(OWNER, YEAR, { odd: 84, even: 80 }, OWNER);
    const mid = await computeFacultyAwardScore(OWNER, YEAR);
    assert.equal(mid.metrics.find((m) => m.id === "student_feedback")?.points, 5);

    // Below both tiers: zero, still tracked (not "untracked").
    await setFeedbackClaim(OWNER, YEAR, { odd: 70, even: 72 }, OWNER);
    const low = await computeFacultyAwardScore(OWNER, YEAR);
    const lowMetric = low.metrics.find((m) => m.id === "student_feedback");
    assert.equal(lowMetric?.points, 0);
    assert.equal(lowMetric?.status, "zero");
  });
});

test("feedback claim: single semester counts as-is with a note; guards reject bad input", async () => {
  await withSandbox("feedback-guards", async () => {
    await setFeedbackClaim(OWNER, YEAR, { odd: 91 }, OWNER);
    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "student_feedback");
    assert.equal(metric?.points, 10, "single ODD 91 stands alone");
    assert.equal(metric?.count, 1);
    assert.ok(metric?.notes.some((n) => n.includes("one semester")));

    await assert.rejects(setFeedbackClaim(OWNER, YEAR, { odd: 104 }, OWNER), /between 0 and 100/);
    await assert.rejects(setFeedbackClaim(OWNER, "2025-26", { odd: 90 }, OWNER), /academicYear/);

    // Clearing both removes the year; metric returns to untracked.
    await setFeedbackClaim(OWNER, YEAR, {}, OWNER);
    assert.equal(await readFeedbackClaimForYear(OWNER, YEAR), null);
    const cleared = await computeFacultyAwardScore(OWNER, YEAR);
    assert.equal(cleared.metrics.find((m) => m.id === "student_feedback")?.status, "untracked");
  });
});
