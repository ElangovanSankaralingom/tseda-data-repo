import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  AWARD_METRICS,
  AWARD_SECTIONS,
  getAwardMetric,
} from "../../data/awardMetrics.ts";
import { CATEGORY_LIST } from "../../data/categoryRegistry.ts";
import { upsertCategoryEntry } from "../../lib/dataStore.ts";
import {
  computeFacultyAwardScore,
  listFacultyAcademicYears,
} from "../../lib/awards/scoring.ts";
import { setAwardPointsOverride } from "../../lib/awards/config.ts";

/**
 * AWARD SYSTEM GUARDS — registry invariants + scoring behavior.
 * The rulebook is data; these tests keep it structurally sound and keep the
 * scoring engine honest (committed-only, year-bucketed, override-aware).
 */

const OWNER = "faculty.awards@tce.edu";
const YEAR = "Academic Year 2025-2026";
const OTHER_YEAR = "Academic Year 2026-2027";

test("award registry invariants", () => {
  const ids = AWARD_METRICS.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, "metric ids must be unique");

  for (const metric of AWARD_METRICS) {
    assert.ok(AWARD_SECTIONS[metric.section], `${metric.id}: unknown section`);
    assert.ok(metric.proofs.length > 0, `${metric.id}: proofs required`);
    if (metric.source === "entry") {
      assert.ok(
        metric.categories && metric.categories.length > 0,
        `${metric.id}: entry-derived metrics must declare categories`,
      );
      for (const category of metric.categories ?? []) {
        assert.ok(
          (CATEGORY_LIST as readonly string[]).includes(category),
          `${metric.id}: unknown category "${category}"`,
        );
      }
    }
    if (metric.pointsModel.kind === "tiered") {
      const keys = metric.pointsModel.tiers.map((t) => t.key);
      assert.equal(new Set(keys).size, keys.length, `${metric.id}: duplicate tier keys`);
    }
  }
  assert.ok(getAwardMetric("fdp_conducted"), "known metric resolvable by id");
  assert.equal(getAwardMetric("nope"), null);
});

test("scoring: committed entries score by tier; drafts and other years never do", async () => {
  const sandbox = await createTestDataRoot("awards-scoring");
  try {
    // Committed international workshop → collab_workshop tier "international" (8)
    await upsertCategoryEntry(OWNER, "workshops", {
      id: "aw-1",
      academicYear: YEAR,
      level: "International",
      confirmationStatus: "GENERATED",
      committedAtISO: new Date().toISOString(),
      workshopName: "Intl workshop",
    });
    // Committed national guest lecture → collab_guest_lecture "india" (1)
    await upsertCategoryEntry(OWNER, "guest-lectures", {
      id: "aw-2",
      academicYear: YEAR,
      level: "National",
      confirmationStatus: "GENERATED",
      committedAtISO: new Date().toISOString(),
      topicOfLecture: "GL",
    });
    // FDP conducted, 3 days, 25 participants → fdp_conducted "short" (8)
    await upsertCategoryEntry(OWNER, "fdp-conducted", {
      id: "aw-3",
      academicYear: YEAR,
      startDate: "2025-08-01",
      endDate: "2025-08-03",
      numberOfParticipants: 25,
      confirmationStatus: "GENERATED",
      committedAtISO: new Date().toISOString(),
      programName: "FDP A",
    });
    // FDP conducted but participants NOT > 20 → skipped with a note
    await upsertCategoryEntry(OWNER, "fdp-conducted", {
      id: "aw-4",
      academicYear: YEAR,
      startDate: "2025-09-01",
      endDate: "2025-09-10",
      numberOfParticipants: 12,
      confirmationStatus: "GENERATED",
      committedAtISO: new Date().toISOString(),
      programName: "FDP B",
    });
    // DRAFT workshop — must not score
    await upsertCategoryEntry(OWNER, "workshops", {
      id: "aw-5",
      academicYear: YEAR,
      level: "International",
      confirmationStatus: "DRAFT",
      workshopName: "Draft",
    });
    // Committed but OTHER year — must not score in YEAR
    await upsertCategoryEntry(OWNER, "workshops", {
      id: "aw-6",
      academicYear: OTHER_YEAR,
      level: "National",
      confirmationStatus: "GENERATED",
      committedAtISO: new Date().toISOString(),
      workshopName: "Next year",
    });

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const byId = new Map(score.metrics.map((m) => [m.id, m]));

    assert.equal(byId.get("collab_workshop")?.points, 8);
    assert.equal(byId.get("collab_workshop")?.count, 1);
    assert.equal(byId.get("collab_guest_lecture")?.points, 1);
    const fdp = byId.get("fdp_conducted");
    assert.equal(fdp?.points, 8, "only the >20-participant FDP scores");
    assert.equal(fdp?.count, 1);
    assert.ok(
      fdp?.notes.some((n) => n.includes("participants")),
      "skipped FDP must be explained",
    );
    assert.equal(score.totalPoints, 17);

    // Sections roll up
    const s7 = score.sections.find((s) => s.section === "s7");
    assert.equal(s7?.points, 8);

    // Years listing sees both years
    const years = await listFacultyAcademicYears(OWNER);
    assert.deepEqual(years, [OTHER_YEAR, YEAR]);

    // Other-year score counts only its own entry
    const nextYear = await computeFacultyAwardScore(OWNER, OTHER_YEAR);
    assert.equal(nextYear.totalPoints, 4, "national workshop = 4 in the other year");
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
});

test("admin override changes effective points; reset restores defaults", async () => {
  const sandbox = await createTestDataRoot("awards-override");
  try {
    await upsertCategoryEntry(OWNER, "workshops", {
      id: "ov-1",
      academicYear: YEAR,
      level: "International",
      confirmationStatus: "GENERATED",
      committedAtISO: new Date().toISOString(),
      workshopName: "Intl",
    });

    await setAwardPointsOverride("collab_workshop", { tiers: { international: 20 } }, "admin@tce.edu");
    let score = await computeFacultyAwardScore(OWNER, YEAR);
    assert.equal(
      score.metrics.find((m) => m.id === "collab_workshop")?.points,
      20,
      "override must drive scoring",
    );

    await setAwardPointsOverride("collab_workshop", null, "admin@tce.edu");
    score = await computeFacultyAwardScore(OWNER, YEAR);
    assert.equal(
      score.metrics.find((m) => m.id === "collab_workshop")?.points,
      8,
      "reset must restore the document default",
    );

    await assert.rejects(
      () => setAwardPointsOverride("not_a_metric", { points: 1 }, "admin@tce.edu"),
      "unknown metric ids must be rejected",
    );
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
});
