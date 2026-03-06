"use client";

import { useMemo } from "react";
import { computeEntryLifecycle } from "@/lib/entries/stateMachine";
import { useDirtyTracker } from "@/hooks/useDirtyTracker";

type UseEntryWorkflowOptions = {
  isLocked: boolean;
  coreValid: boolean;
  hasPdfSnapshot: boolean;
  pdfStale: boolean;
  completionValid: boolean;
  fieldDirty: boolean;
  committedUploadDirty?: boolean;
};

export function useEntryWorkflow({
  isLocked,
  coreValid,
  hasPdfSnapshot,
  pdfStale,
  completionValid,
  fieldDirty,
  committedUploadDirty = false,
}: UseEntryWorkflowOptions) {
  const dirtyTracker = useDirtyTracker({
    fieldDirty,
    committedUploadDirty,
  });

  const preStageDirty = hasPdfSnapshot ? pdfStale : dirtyTracker.shouldEnableTopSave;
  const postStageDirty = hasPdfSnapshot && !pdfStale && dirtyTracker.shouldEnableTopSave;

  const lifecycle = useMemo(
    () =>
      computeEntryLifecycle({
        isLocked,
        hasPdfSnapshot,
        preStageValid: coreValid,
        postStageValid: hasPdfSnapshot && completionValid,
        preStageDirty,
        postStageDirty,
      }),
    [completionValid, coreValid, hasPdfSnapshot, isLocked, postStageDirty, preStageDirty]
  );

  return {
    dirtyTracker,
    lifecycle,
    stage: lifecycle.stage,
    coreDirty: preStageDirty,
    uploadsDirty: postStageDirty,
    generated: hasPdfSnapshot,
    hasPdfSnapshot,
    isDirtyPreStage: lifecycle.isDirtyPreStage,
    isDirtyPostStage: lifecycle.isDirtyPostStage,
    canSave: lifecycle.canSave,
    canGenerate: lifecycle.canGenerate,
    canPreviewPdf: lifecycle.canPreview,
    canDownloadPdf: lifecycle.canDownload,
    canDone: lifecycle.canDone,
  };
}
