import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import {
  readResearchProfile,
  writeResearchProfile,
  listScholarsWhoTagged,
  sanitizeResearchProfile,
} from "../../lib/research/researchProfile.ts";
import { computeFacultyAwardScore, listFacultyAcademicYears } from "../../lib/awards/scoring.ts";
import { academicYearOfDate } from "../../lib/utils/academicYear.ts";
import { runInDemoUniverse } from "../../lib/demo/universe.ts";

/**
 * RESEARCH PROFILE — Ph.D. milestones on the profile (Elan's S7 ruling):
 * viva-year scoring, internal/external tagging, and the derived supervision
 * network ("a proper network of data systems").
 */

const SUPERVISOR = "guide.research@tce.edu";
const SCHOLAR = "scholar.research@tce.edu";
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

test("academicYearOfDate: July–June boundaries", () => {
  assert.equal(academicYearOfDate("2025-07-01"), "Academic Year 2025-2026");
  assert.equal(academicYearOfDate("2026-06-30"), "Academic Year 2025-2026");
  assert.equal(academicYearOfDate("2026-07-01"), "Academic Year 2026-2027");
  assert.equal(academicYearOfDate("not-a-date"), null);
});

test("sanitize: internal tags without an email downgrade to External", () => {
  const profile = sanitizeResearchProfile({
    ownPhd: { status: "Pursuing", supervisorType: "Internal", supervisorName: "Ghost", supervisorEmail: "" },
    guidedScholars: [
      { scholarName: "A", scholarType: "Internal", scholarEmail: "" },
      { scholarName: "B", scholarType: "Internal", scholarEmail: "REAL.person@tce.edu" },
    ],
  });
  assert.equal(profile.ownPhd.supervisorType, "External", "dangling internal supervisor downgraded");
  assert.equal(profile.guidedScholars[0].scholarType, "External");
  assert.equal(profile.guidedScholars[1].scholarType, "Internal");
  assert.equal(profile.guidedScholars[1].scholarEmail, "real.person@tce.edu", "emails normalised");
});

test("scoring: phd_awarded and phd_guided count in the viva year only", async () => {
  await withSandbox("research-scoring", async () => {
    await writeResearchProfile(SUPERVISOR, {
      ownPhd: {
        status: "Awarded",
        university: "Anna University",
        thesisTitle: "Own thesis",
        supervisorType: "External",
        supervisorName: "Prof. External",
        vivaDate: "2025-10-15", // → 2025-2026
      },
      guidedScholars: [
        { id: "s1", scholarType: "External", scholarName: "Scholar One", thesisTitle: "T1", university: "AU", vivaDate: "2026-02-10" }, // 2025-2026
        { id: "s2", scholarType: "External", scholarName: "Scholar Two", thesisTitle: "T2", university: "AU", vivaDate: "2026-09-01" }, // 2026-2027
        { id: "s3", scholarType: "External", scholarName: "Scholar Pending", thesisTitle: "T3", university: "AU", vivaDate: "" }, // pending
      ],
    });

    const score = await computeFacultyAwardScore(SUPERVISOR, YEAR);
    const byId = new Map(score.metrics.map((m) => [m.id, m]));
    assert.equal(byId.get("phd_awarded")?.points, 15, "own viva in-year");
    assert.equal(byId.get("phd_guided")?.points, 12, "one scholar viva in-year");
    assert.equal(byId.get("phd_guided")?.count, 1);
    assert.ok(byId.get("phd_guided")?.notes.some((n) => n.includes("outside this year")), "others explained");

    // Next year: only Scholar Two counts; own PhD notes the other year.
    const nextYear = await computeFacultyAwardScore(SUPERVISOR, "Academic Year 2026-2027");
    const nextById = new Map(nextYear.metrics.map((m) => [m.id, m]));
    assert.equal(nextById.get("phd_awarded")?.points, 0);
    assert.equal(nextById.get("phd_guided")?.points, 12);

    // Years list includes viva-derived years even with zero entries.
    const years = await listFacultyAcademicYears(SUPERVISOR);
    assert.ok(years.includes(YEAR) && years.includes("Academic Year 2026-2027"));
  });
});

test("network: tagging an internal supervisor creates the derived edge", async () => {
  await withSandbox("research-network", async () => {
    await writeResearchProfile(SCHOLAR, {
      ownPhd: {
        status: "Pursuing",
        university: "Anna University",
        thesisTitle: "Scholar thesis on tropical housing",
        supervisorType: "Internal",
        supervisorName: "Dr. Guide",
        supervisorEmail: SUPERVISOR,
        vivaDate: "",
      },
      guidedScholars: [],
    });

    const tags = await listScholarsWhoTagged(SUPERVISOR);
    assert.equal(tags.length, 1);
    assert.equal(tags[0].facultyEmail, SCHOLAR);
    assert.equal(tags[0].phdStatus, "Pursuing");
    assert.equal(tags[0].thesisTitle, "Scholar thesis on tropical housing");

    // Nobody tagged the scholar.
    assert.equal((await listScholarsWhoTagged(SCHOLAR)).length, 0);
  });
});

test("demo isolation: research profiles fork in the demo universe", async () => {
  await withSandbox("research-demo", async () => {
    await writeResearchProfile(SUPERVISOR, {
      ownPhd: { status: "Awarded", university: "AU", thesisTitle: "Real thesis", supervisorType: "External", supervisorName: "X", vivaDate: "2025-10-15" },
      guidedScholars: [],
    });

    await runInDemoUniverse(async () => {
      const demoView = await readResearchProfile(SUPERVISOR);
      assert.equal(demoView.ownPhd.status, "None", "demo universe starts clean");
      await writeResearchProfile(SUPERVISOR, {
        ownPhd: { status: "Pursuing", university: "Demo U", thesisTitle: "Demo thesis", supervisorType: "External", supervisorName: "Y", vivaDate: "" },
        guidedScholars: [],
      });
    });

    const real = await readResearchProfile(SUPERVISOR);
    assert.equal(real.ownPhd.thesisTitle, "Real thesis", "real profile untouched by demo writes");
  });
});
