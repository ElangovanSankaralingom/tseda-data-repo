/**
 * Canonical editor action-state rule layer for entry pages.
 *
 * Edit this module when changing Save / Generate / Done availability or dirty
 * stage transitions during editing.
 *
 * Workflow confirmation rules do not belong here; see `workflow.ts`.
 */

export type EntryLifecycleStage = "pre" | "post";

export type EntryLifecycleInput = {
  isLocked: boolean;
  hasPdfSnapshot: boolean;
  preStageValid: boolean;
  postStageValid: boolean;
  preStageDirty: boolean;
  postStageDirty: boolean;
  streakActivated?: boolean;
  streakCompleted?: boolean;
};

export type EntryLifecycleState = {
  stage: EntryLifecycleStage;
  dirty: boolean;
  isDirtyPreStage: boolean;
  isDirtyPostStage: boolean;
  hasPdfSnapshot: boolean;
  streakActivated: boolean;
  streakCompleted: boolean;
  canSave: boolean;
  canGenerate: boolean;
  canPreview: boolean;
  canDownload: boolean;
  canDone: boolean;
};

export function computeEntryLifecycle({
  isLocked,
  hasPdfSnapshot,
  preStageValid,
  postStageValid,
  preStageDirty,
  postStageDirty,
  streakActivated,
  streakCompleted,
}: EntryLifecycleInput): EntryLifecycleState {
  const dirty = preStageDirty || postStageDirty;
  const stage: EntryLifecycleStage = hasPdfSnapshot ? "post" : "pre";
  const canGenerate = !isLocked && preStageValid && preStageDirty;
  const canPreview = hasPdfSnapshot && preStageValid && !preStageDirty;
  const canDownload = canPreview;
  const canDone = !isLocked && hasPdfSnapshot && preStageValid && postStageValid && !preStageDirty;
  const canSave = !isLocked && dirty;

  return {
    stage,
    dirty,
    isDirtyPreStage: preStageDirty,
    isDirtyPostStage: postStageDirty,
    hasPdfSnapshot,
    streakActivated: streakActivated ?? false,
    streakCompleted: streakCompleted ?? false,
    canSave,
    canGenerate,
    canPreview,
    canDownload,
    canDone,
  };
}

export function markDirty(
  current: Pick<EntryLifecycleState, "isDirtyPreStage" | "isDirtyPostStage">,
  fieldGroup: "pre" | "post"
) {
  return fieldGroup === "pre"
    ? { isDirtyPreStage: true, isDirtyPostStage: current.isDirtyPostStage }
    : { isDirtyPreStage: current.isDirtyPreStage, isDirtyPostStage: true };
}

export function markSaved(
  current: Pick<EntryLifecycleState, "isDirtyPreStage" | "isDirtyPostStage">,
  fieldGroup?: "pre" | "post"
) {
  if (!fieldGroup) {
    return { isDirtyPreStage: false, isDirtyPostStage: false };
  }

  return fieldGroup === "pre"
    ? { isDirtyPreStage: false, isDirtyPostStage: current.isDirtyPostStage }
    : { isDirtyPreStage: current.isDirtyPreStage, isDirtyPostStage: false };
}

export function markGenerated(current: EntryLifecycleState): EntryLifecycleState {
  return computeEntryLifecycle({
    isLocked: false,
    hasPdfSnapshot: true,
    preStageValid: true,
    postStageValid: current.canDone,
    preStageDirty: false,
    postStageDirty: current.isDirtyPostStage,
    streakActivated: current.streakActivated,
    streakCompleted: current.streakCompleted,
  });
}

export function markDone(current: EntryLifecycleState): EntryLifecycleState {
  return {
    ...current,
    streakCompleted: true,
  };
}
