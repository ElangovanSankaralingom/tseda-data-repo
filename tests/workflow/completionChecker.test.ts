import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCompletionState } from "@/lib/workflow/completionChecker";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/workflow/workflowConfig";

const config = DEFAULT_WORKFLOW_CONFIG;

// fdp-attended has stage 1 fields: academicYear, semesterType, startDate, endDate, programName, organisingBody
// (supportAmount has required:false so it's excluded from completion)
// and stage 2 fields: permissionLetter, completionCertificate
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
      startDate: "2025-01-01",
      endDate: "2025-01-05",
      programName: "Test FDP",
      organisingBody: "AICTE",
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
      startDate: "2025-01-01",
      endDate: "2025-01-05",
      programName: "Test FDP",
      organisingBody: "AICTE",
      permissionLetter: { url: "https://example.com/pl.pdf", storedPath: "/some/path" },
      completionCertificate: { url: "https://example.com/cc.pdf", storedPath: "/some/path" },
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
});
