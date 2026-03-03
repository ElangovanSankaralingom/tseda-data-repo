"use client";

import { useMemo } from "react";

type UseDirtyTrackerOptions = {
  fieldDirty: boolean;
  committedUploadDirty?: boolean;
};

export function useDirtyTracker({
  fieldDirty,
  committedUploadDirty = false,
}: UseDirtyTrackerOptions) {
  return useMemo(
    () => ({
      isDirtyFields: fieldDirty,
      isDirtyUploadsCommitted: committedUploadDirty,
      shouldEnableTopSave: fieldDirty || committedUploadDirty,
    }),
    [committedUploadDirty, fieldDirty]
  );
}
