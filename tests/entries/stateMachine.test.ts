import test from "node:test";
import assert from "node:assert/strict";
import {
  computeEntryLifecycle,
  markDirty,
  markSaved,
} from "../../lib/entries/stateMachine.ts";

test("pre-stage starts with all actions disabled except none dirty", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: false,
    preStageValid: false,
    postStageValid: false,
    preStageDirty: false,
    postStageDirty: false,
  });

  assert.equal(state.stage, "pre");
  assert.equal(state.canSave, false);
  assert.equal(state.canGenerate, false);
  assert.equal(state.canDone, false);
  assert.equal(state.canPreview, false);
  assert.equal(state.canDownload, false);
});

test("one pre-stage field change enables save only", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: false,
    preStageValid: false,
    postStageValid: false,
    preStageDirty: true,
    postStageDirty: false,
  });

  assert.equal(state.canSave, true);
  assert.equal(state.canGenerate, false);
  assert.equal(state.canDone, false);
});

test("valid pre-stage with no pdf enables generate", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: false,
    preStageValid: true,
    postStageValid: false,
    preStageDirty: true,
    postStageDirty: false,
  });

  assert.equal(state.canSave, true);
  assert.equal(state.canGenerate, true);
  assert.equal(state.canPreview, false);
  assert.equal(state.canDownload, false);
});

test("existing up-to-date pdf disables generate and enables preview/download", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: false,
    preStageDirty: false,
    postStageDirty: false,
  });

  assert.equal(state.stage, "post");
  assert.equal(state.canGenerate, false);
  assert.equal(state.canPreview, true);
  assert.equal(state.canDownload, true);
});

test("editing a pre-stage field after generate re-enables generate and disables preview/download", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: false,
    preStageDirty: true,
    postStageDirty: false,
  });

  assert.equal(state.canGenerate, true);
  assert.equal(state.canPreview, false);
  assert.equal(state.canDownload, false);
  assert.equal(state.canDone, false);
});

test("post-stage dirty after generate enables save but not done", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: false,
    preStageDirty: false,
    postStageDirty: true,
  });

  assert.equal(state.canSave, true);
  assert.equal(state.canDone, false);
});

test("complete and saved post-stage enables done and disables save", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: true,
    preStageDirty: false,
    postStageDirty: false,
  });

  assert.equal(state.canDone, true);
  assert.equal(state.canSave, false);
});

test("complete but unsaved post-stage keeps done disabled", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: true,
    preStageDirty: false,
    postStageDirty: true,
  });

  assert.equal(state.canDone, false);
  assert.equal(state.canSave, true);
});

test("locked entries disable all actions", () => {
  const state = computeEntryLifecycle({
    isLocked: true,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: true,
    preStageDirty: true,
    postStageDirty: true,
  });

  assert.equal(state.stage, "locked");
  assert.equal(state.canSave, false);
  assert.equal(state.canGenerate, false);
  assert.equal(state.canPreview, false);
  assert.equal(state.canDownload, false);
  assert.equal(state.canDone, false);
});

test("markDirty toggles only targeted stage", () => {
  assert.deepEqual(markDirty({ isDirtyPreStage: false, isDirtyPostStage: false }, "pre"), {
    isDirtyPreStage: true,
    isDirtyPostStage: false,
  });
  assert.deepEqual(markDirty({ isDirtyPreStage: false, isDirtyPostStage: false }, "post"), {
    isDirtyPreStage: false,
    isDirtyPostStage: true,
  });
});

test("markSaved clears only targeted stage or all stages", () => {
  assert.deepEqual(markSaved({ isDirtyPreStage: true, isDirtyPostStage: true }, "pre"), {
    isDirtyPreStage: false,
    isDirtyPostStage: true,
  });
  assert.deepEqual(markSaved({ isDirtyPreStage: true, isDirtyPostStage: true }, "post"), {
    isDirtyPreStage: true,
    isDirtyPostStage: false,
  });
  assert.deepEqual(markSaved({ isDirtyPreStage: true, isDirtyPostStage: true }), {
    isDirtyPreStage: false,
    isDirtyPostStage: false,
  });
});

test("post-stage without pdf can never be done", () => {
  const state = computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: false,
    preStageValid: true,
    postStageValid: true,
    preStageDirty: false,
    postStageDirty: false,
  });

  assert.equal(state.canDone, false);
  assert.equal(state.canPreview, false);
  assert.equal(state.canDownload, false);
});
