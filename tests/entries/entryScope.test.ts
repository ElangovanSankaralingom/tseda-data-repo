import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  canCoordinatorEnterData,
  listEntryDlcCategories,
  setCoordinatorAssignment,
  upsertCoordinatorType,
} from "../../lib/admin/coordinators.ts";
import { createEntry, commitDraft } from "../../lib/entries/lifecycle.ts";
import { getCategoryEntryScope, getCategoryFlow, listDlcScopedSlugs, getCategorySchema } from "../../data/categoryRegistry.ts";
import { isEntryActivated, isEntryWon } from "../../lib/streakProgress.ts";
import { computeFacultyAwardScore } from "../../lib/awards/scoring.ts";

/**
 * ENTRY SCOPE (Elan's B2 ruling) — dlc categories are department records:
 * only enterData coordinators may enter; entries never streak, never feed,
 * never score award points.
 */

const DLC = "placement.dlc@tce.edu";
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

test("entryScope invariants: dlc categories are record flow, no award metric reads them", async () => {
  const dlcSlugs = listDlcScopedSlugs();
  assert.ok(dlcSlugs.includes("student-placements"), "reference category registered");
  for (const slug of dlcSlugs) {
    assert.equal(getCategoryFlow(slug), "record", `${slug}: dlc categories must be record flow`);
    // Export-filter spine still applies (department exports need it most).
    const keys = getCategorySchema(slug).fields.map((f) => f.key);
    assert.ok(keys.includes("academicYear") && keys.includes("semesterType"), `${slug}: spine present`);
  }
  assert.equal(getCategoryEntryScope("journal-publications"), "faculty", "default scope untouched");
});

test("enterData power: per-type per-category, drives listEntryDlcCategories", async () => {
  await withSandbox("scope-power", async () => {
    upsertCoordinatorType({
      label: "Placement DLC",
      categories: ["student-placements"],
      powers: { enterData: true },
    });
    // A second type WITHOUT enterData must not leak the power.
    upsertCoordinatorType({
      label: "Case Studies Coordinator",
      categories: ["case-studies"],
      powers: { approveEdits: true },
    });
    setCoordinatorAssignment(DLC, ["placement-dlc", "case-studies-coordinator"]);

    assert.equal(canCoordinatorEnterData(DLC, "student-placements"), true);
    assert.equal(canCoordinatorEnterData(DLC, "case-studies"), false, "power bound to its own type");
    assert.equal(canCoordinatorEnterData("other@tce.edu", "student-placements"), false);
    assert.deepEqual(listEntryDlcCategories(DLC), ["student-placements"]);
  });
});

test("dlc commit: locked record with NO streak, NO win, NO award points", async () => {
  await withSandbox("scope-commit", async () => {
    const entry = await createEntry(DLC, "student-placements", {
      academicYear: YEAR,
      semesterType: "EVEN",
      regNo: "21AR023",
      studentName: "R. Priyadharshini",
      programme: "B.Arch",
      companyName: "Morphogenesis",
      offerDate: "2026-02-10",
      placementType: "On-Campus",
    } as never);
    const committed = await commitDraft(DLC, "student-placements", String(entry.id)) as Record<string, unknown>;

    // Record semantics: locked on submit, no timer.
    assert.equal(committed.confirmationStatus, "GENERATED");
    assert.equal(committed.entryFlow, "record");
    assert.equal(committed.editWindowExpiresAt, null);

    // B2 semantics: department records NEVER streak, NEVER feed.
    assert.equal(committed.streakEligible, false, "dlc entries are never streak eligible");
    const fields = getCategorySchema("student-placements").fields;
    assert.equal(isEntryActivated(committed as never), false);
    assert.equal(isEntryWon(committed as never, fields as never), false, "no win → no feed milestone");

    // And NEVER award points — no metric reads a dlc category.
    const score = await computeFacultyAwardScore(DLC, YEAR);
    assert.equal(score.totalPoints, 0);
  });
});
