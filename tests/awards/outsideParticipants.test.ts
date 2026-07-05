import assert from "node:assert/strict";
import test from "node:test";
import { createTestDataRoot } from "../helpers/testDataRoot.ts";
import { createEntry, commitDraft } from "../../lib/entries/lifecycle.ts";
import { computeFacultyAwardScore } from "../../lib/awards/scoring.ts";
import { addDaysISO, nowISTDateISO } from "../../lib/time.ts";

/**
 * fdp_conducted "> 20 OUTSIDE participants" rule: the dedicated
 * outsideParticipants field wins over the numberOfParticipants proxy,
 * and proxy judgments are noted honestly.
 */

const OWNER = "outside.count@tce.edu";
const YEAR = "Academic Year 2025-2026";

test("fdp_conducted prefers outsideParticipants; total-only entries are proxied and noted", async () => {
  const sandbox = await createTestDataRoot("outside-participants");
  try {
    const today = nowISTDateISO();
    const base = {
      academicYear: YEAR,
      semesterType: "ODD",
      level: "National",
      mode: "Offline",
      startDate: addDaysISO(today, 5),
      endDate: addDaysISO(today, 7), // 3 inclusive days → "short" tier
    };

    // 1. Dedicated outside count 25 → counts via the real rule.
    const dedicated = await createEntry(OWNER, "fdp-conducted", {
      ...base, programName: "FDP with real outside count", outsideParticipants: 25, numberOfParticipants: 40,
    } as never);
    await commitDraft(OWNER, "fdp-conducted", String(dedicated.id));

    // 2. Only the total recorded (30) → counts via the proxy, noted.
    const proxied = await createEntry(OWNER, "fdp-conducted", {
      ...base, programName: "FDP with total only", numberOfParticipants: 30,
    } as never);
    await commitDraft(OWNER, "fdp-conducted", String(proxied.id));

    // 3. Outside count 15 (despite total 40) → the REAL rule skips it.
    const skipped = await createEntry(OWNER, "fdp-conducted", {
      ...base, programName: "FDP mostly internal", outsideParticipants: 15, numberOfParticipants: 40,
    } as never);
    await commitDraft(OWNER, "fdp-conducted", String(skipped.id));

    const score = await computeFacultyAwardScore(OWNER, YEAR);
    const metric = score.metrics.find((m) => m.id === "fdp_conducted");
    assert.equal(metric?.count, 2, "dedicated + proxied count; low outside count skipped");
    assert.ok(metric?.notes.some((n) => n.includes("judged on TOTAL participants")), "proxy noted");
    assert.ok(metric?.notes.some((n) => n.includes("not counted")), "skip noted");
  } finally {
    sandbox.restore();
    await sandbox.cleanup();
  }
});
