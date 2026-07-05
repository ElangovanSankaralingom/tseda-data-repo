import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  readInterviewPointsForYear,
  setInterviewAward,
} from "../../lib/awards/interview.ts";
import { computeFacultyAwardScore } from "../../lib/awards/scoring.ts";
import { buildAppraisalModel } from "../../lib/awards/report.ts";
import { runInDemoUniverse } from "../../lib/demo/universe.ts";

/**
 * COMMITTEE-AWARDED POINTS (roadmap #16) — the interview-source metrics
 * (studio focus 5, documentation 3, beyond syllabus 5) are entered by the
 * committee per faculty per year; the scoring engine and the appraisal
 * document must both pick them up, clamped to the effective rulebook max.
 */

const OWNER = "committee.target@tce.edu";
const CHAIR = "chair@tce.edu";
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

test("committee award: scored, clamped, noted — score and report agree", async () => {
  await withSandbox("interview-award", async () => {
    // Beyond max (studio_focus_achievement is fixed 5) → clamped at write.
    await setInterviewAward(
      OWNER,
      YEAR,
      "studio_focus_achievement",
      { points: 99, note: "Strong studio outcomes, verified rubrics" },
      CHAIR,
    );

    const stored = await readInterviewPointsForYear(OWNER, YEAR);
    assert.equal(stored.studio_focus_achievement.points, 5, "clamped to effective max");
    assert.equal(stored.studio_focus_achievement.awardedBy, CHAIR);

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const studio = score.metrics.find((m) => m.id === "studio_focus_achievement");
    assert.equal(studio?.status, "manual");
    assert.equal(studio?.points, 5);
    assert.equal(studio?.count, 1);
    assert.ok(studio?.notes.some((n) => n.includes("Strong studio outcomes")));
    assert.equal(score.totalPoints, 5, "committee points count toward the total");

    // Unassessed interview metric stays at 0.
    const beyond = score.metrics.find((m) => m.id === "beyond_syllabus");
    assert.equal(beyond?.points, 0);
    assert.equal(beyond?.status, "manual");

    // The appraisal document reads the same score — points + note flow in.
    const model = await buildAppraisalModel(OWNER, YEAR);
    const block = model.sections
      .flatMap((s) => s.metrics)
      .find((m) => m.id === "studio_focus_achievement");
    assert.equal(block?.points, 5);
    assert.ok(block?.notes.some((n) => n.includes("Strong studio outcomes")));

    // A different year sees nothing.
    const other = await computeFacultyAwardScore(OWNER, "Academic Year 2024-2025");
    assert.equal(other.metrics.find((m) => m.id === "studio_focus_achievement")?.points, 0);
  });
});

test("committee award: guards — non-interview metric refused, clear removes", async () => {
  await withSandbox("interview-guards", async () => {
    await assert.rejects(
      setInterviewAward(OWNER, YEAR, "journal_publication", { points: 5 }, CHAIR),
      /not committee-assessed/,
    );
    await assert.rejects(
      setInterviewAward(OWNER, "2025-26", "beyond_syllabus", { points: 5 }, CHAIR),
      /academicYear/,
    );
    await assert.rejects(
      setInterviewAward(OWNER, YEAR, "beyond_syllabus", { points: -1 }, CHAIR),
      /non-negative/,
    );

    await setInterviewAward(OWNER, YEAR, "beyond_syllabus", { points: 4, note: "" }, CHAIR);
    assert.equal((await readInterviewPointsForYear(OWNER, YEAR)).beyond_syllabus.points, 4);

    await setInterviewAward(OWNER, YEAR, "beyond_syllabus", null, CHAIR);
    assert.deepEqual(await readInterviewPointsForYear(OWNER, YEAR), {});
  });
});

test("committee award: demo-universe writes never touch real data", async () => {
  await withSandbox("interview-demo", async () => {
    await runInDemoUniverse(async () => {
      await setInterviewAward(OWNER, YEAR, "studio_documentation", { points: 3 }, CHAIR);
      const inDemo = await readInterviewPointsForYear(OWNER, YEAR);
      assert.equal(inDemo.studio_documentation.points, 3);
    });
    // Real universe: untouched.
    assert.deepEqual(await readInterviewPointsForYear(OWNER, YEAR), {});
  });
});
