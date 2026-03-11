import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeWorkflowState } from "@/lib/workflow/workflowEngine";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/workflow/workflowConfig";

const config = DEFAULT_WORKFLOW_CONFIG;
const DAY = 24 * 60 * 60 * 1000;

function makeEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "test-1",
    confirmationStatus: "DRAFT",
    ...overrides,
  };
}

function makeGeneratedEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return makeEntry({
    confirmationStatus: "GENERATED",
    committedAtISO: "2025-01-01T00:00:00Z",
    editWindowExpiresAt: new Date(Date.now() + 2 * DAY).toISOString(),
    pdfGenerated: true,
    pdfStale: false,
    academicYear: "2025-26",
    semesterType: "ODD",
    startDate: "2025-01-01",
    endDate: "2025-01-05",
    programName: "Test FDP",
    organisingBody: "AICTE",
    permissionLetter: { url: "https://example.com/pl.pdf", storedPath: "/path" },
    completionCertificate: { url: "https://example.com/cc.pdf", storedPath: "/path" },
    ...overrides,
  });
}

describe("computeWorkflowState", () => {
  it("DRAFT entry: generate visible but disabled without fields, save visible, finalise hidden", () => {
    const state = computeWorkflowState(makeEntry(), "fdp-attended", config);
    assert.equal(state.status, "DRAFT");
    assert.equal(state.buttons.generate.visible, true);
    assert.equal(state.buttons.generate.enabled, false);
    assert.equal(state.buttons.save.visible, true);
    assert.equal(state.buttons.finalise.visible, false);
  });

  it("DRAFT with all stage 1 filled: generate enabled", () => {
    const entry = makeEntry({
      academicYear: "2025-26",
      semesterType: "ODD",
      startDate: "2025-01-01",
      endDate: "2025-01-05",
      programName: "Test FDP",
      organisingBody: "AICTE",
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.buttons.generate.enabled, true);
  });

  it("GENERATED with active timer: editable, finalise visible if all complete", () => {
    const state = computeWorkflowState(makeGeneratedEntry(), "fdp-attended", config);
    assert.equal(state.isEditable, true);
    assert.equal(state.buttons.finalise.visible, true);
    assert.equal(state.buttons.finalise.enabled, true);
  });

  it("GENERATED with expired timer: isFinalized, isViewMode, requestAction visible", () => {
    const entry = makeGeneratedEntry({
      editWindowExpiresAt: new Date(Date.now() - DAY).toISOString(),
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.isFinalized, true);
    assert.equal(state.isViewMode, true);
    assert.equal(state.buttons.requestAction.visible, true);
  });

  it("EDIT_REQUESTED: timer paused, isViewMode, no save/generate/finalise", () => {
    const entry = makeGeneratedEntry({
      confirmationStatus: "EDIT_REQUESTED",
      timerPausedAt: new Date().toISOString(),
      timerRemainingMs: DAY,
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.timer.isPaused, true);
    assert.equal(state.isViewMode, true);
    assert.equal(state.buttons.save.visible, false);
    assert.equal(state.buttons.generate.visible, false);
    assert.equal(state.buttons.finalise.visible, false);
  });

  it("DELETE_REQUESTED: timer paused, isViewMode", () => {
    const entry = makeGeneratedEntry({
      confirmationStatus: "DELETE_REQUESTED",
      timerPausedAt: new Date().toISOString(),
      timerRemainingMs: DAY,
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.timer.isPaused, true);
    assert.equal(state.isViewMode, true);
  });

  it("EDIT_GRANTED: isEditable, generate/save visible", () => {
    const entry = makeGeneratedEntry({
      confirmationStatus: "EDIT_GRANTED",
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.isEditable, true);
    assert.equal(state.buttons.save.visible, true);
    assert.equal(state.buttons.generate.visible, true);
  });

  it("permanentlyLocked: everything disabled, no requestAction", () => {
    const entry = makeGeneratedEntry({
      permanentlyLocked: true,
      editWindowExpiresAt: new Date(Date.now() - DAY).toISOString(),
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.isPermanentlyLocked, true);
    assert.equal(state.isEditable, false);
    assert.equal(state.buttons.requestAction.visible, false);
  });

  it("requestActionUsed: no requestAction dropdown", () => {
    const entry = makeGeneratedEntry({
      requestActionUsed: true,
      editWindowExpiresAt: new Date(Date.now() - DAY).toISOString(),
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.buttons.requestAction.visible, false);
    assert.equal(state.requestState.requestActionUsed, true);
  });

  it("all complete + expired: autoAction=finalise", () => {
    const entry = makeGeneratedEntry({
      editWindowExpiresAt: new Date(Date.now() - DAY).toISOString(),
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.autoAction, "finalise");
  });

  it("incomplete + expired: autoAction=delete", () => {
    const entry = makeEntry({
      confirmationStatus: "GENERATED",
      committedAtISO: "2025-01-01T00:00:00Z",
      editWindowExpiresAt: new Date(Date.now() - DAY).toISOString(),
      // No uploads, incomplete
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.autoAction, "delete");
  });

  it("EDIT_GRANTED + no changes + complete + expired: autoAction=finalise", () => {
    const entry = makeGeneratedEntry({
      confirmationStatus: "EDIT_GRANTED",
      editWindowExpiresAt: new Date(Date.now() - DAY).toISOString(),
      // hashAtEditGrant not set → hasChangesSinceGrant returns false
    });
    const state = computeWorkflowState(entry, "fdp-attended", config);
    assert.equal(state.autoAction, "finalise");
  });
});
