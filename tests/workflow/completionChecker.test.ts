import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCompletionState } from "@/lib/workflow/completionChecker";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/workflow/workflowConfig";

const config = DEFAULT_WORKFLOW_CONFIG;

// fdp-attended has stage 1 fields: academicYear, semesterType, level, mode, startDate, endDate,
// programName, organisingBody, sponsored
// (fundingAgency/fundingAmount have required:false so they're excluded from completion)
// and stage 2 fields: permissionLetter, completionCertificate (multi-file arrays)
// (id is required but exportable:false, pdfMeta and streak are exportable:false)

describe("computeCompletionState", () => {
  it("empty entry has stage1Complete=false", () => {
    const state = computeCompletionState({}, "fdp-attended", config, false);
    assert.equal(state.stage1Complete, false);
    assert.equal(state.stage1Filled, 0);
    assert.ok(state.stage1Total > 0);
  });

  it("all stage 1 filled returns stage1Complete=true", () => {
    const entry = {
      academicYear: "2025-26",
      semesterType: "ODD",
      level: "National",
      mode: "Online",
      startDate: "2025-01-01",
      endDate: "2025-01-05",
      programName: "Test FDP",
      organisingBody: "AICTE",
      sponsored: "No",
    };
    const state = computeCompletionState(entry, "fdp-attended", config, false);
    assert.equal(state.stage1Complete, true);
    assert.equal(state.stage1Filled, state.stage1Total);
  });

  it("generated with all stage 2 filled returns stage2Complete=true", () => {
    const entry = {
      academicYear: "2025-26",
      semesterType: "ODD",
      level: "National",
      mode: "Online",
      startDate: "2025-01-01",
      endDate: "2025-01-05",
      programName: "Test FDP",
      organisingBody: "AICTE",
      sponsored: "No",
      permissionLetter: [{ url: "https://example.com/pl.pdf", storedPath: "/some/path" }],
      completionCertificate: [{ url: "https://example.com/cc.pdf", storedPath: "/some/path" }],
    };
    const state = computeCompletionState(entry, "fdp-attended", config, true);
    assert.equal(state.stage2Complete, true);
    assert.equal(state.stage2Filled, state.stage2Total);
  });

  it("PDF exists and not stale returns pdfFresh=true", () => {
    const entry = {
      pdfGenerated: true,
      pdfStale: false,
    };
    const state = computeCompletionState(entry, "fdp-attended", config, true);
    assert.equal(state.pdfExists, true);
    assert.equal(state.pdfFresh, true);
  });

  it("before generate, total counts stage 1 only", () => {
    const state = computeCompletionState({}, "fdp-attended", config, false);
    assert.equal(state.total, state.stage1Total);
  });

  it("after generate, total counts stage 1 + stage 2", () => {
    const state = computeCompletionState({}, "fdp-attended", config, true);
    assert.equal(state.total, state.stage1Total + state.stage2Total);
  });

  // S1 (TECH-AUDIT-2026-06 C4): stage-1 completeness is anchored to the
  // schema's explicit requiredForCommit allowlist (intersected with
  // required!==false), NOT a "required !== false over all fields" default.
  // This is the schema-drift guard: a future stage-1 field that isn't added
  // to requiredForCommit must not retroactively mark existing entries
  // incomplete (which would make the nightly job auto-delete them).
  it("stage1 required set equals requiredForCommit ∩ (required!==false), drift-proof", async () => {
    const { getCategorySchema } = await import("@/data/categoryRegistry");
    const schema = getCategorySchema("fdp-attended");
    const commit = new Set(schema.requiredForCommit ?? []);
    const expected = schema.fields.filter(
      (f) => f.stage !== 2 && commit.has(f.key) && f.required !== false,
    ).length;
    const state = computeCompletionState({}, "fdp-attended", config, false);
    assert.equal(state.stage1Total, expected);
    // Conditional funding fields are NOT in requiredForCommit, so they never
    // count toward stage-1 completeness — a sponsored=No entry with all core
    // fields is complete without them.
    assert.equal(commit.has("fundingAgency"), false);
    const sponsoredNo = {
      academicYear: "2025-26", semesterType: "ODD", level: "National", mode: "Online",
      startDate: "2025-01-01", endDate: "2025-01-05", programName: "X", organisingBody: "Y",
      sponsored: "No",
    };
    assert.equal(computeCompletionState(sponsoredNo, "fdp-attended", config, false).stage1Complete, true);
  });
});
