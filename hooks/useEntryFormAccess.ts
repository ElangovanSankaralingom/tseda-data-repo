"use client";

import { useCallback, useMemo } from "react";
import { getEntryApprovalStatus, isEntryLockedFromStatus } from "@/lib/confirmation";
import { canEditField } from "@/lib/pendingImmutability";
import type { CategoryKey } from "@/lib/entries/types";

type EntryLike = {
  status?: string | null;
  confirmationStatus?: string | null;
  requestEditStatus?: string | null;
  sentForConfirmationAtISO?: string | null;
  confirmedAtISO?: string | null;
};

type UseEntryFormAccessOptions<TEntry extends EntryLike> = {
  entry: TEntry;
  category: CategoryKey;
  isViewMode: boolean;
};

export function useEntryFormAccess<TEntry extends EntryLike>({
  entry,
  category,
  isViewMode,
}: UseEntryFormAccessOptions<TEntry>) {
  const entryLocked = useMemo(() => isEntryLockedFromStatus(entry), [entry]);
  const controlsDisabled = isViewMode || entryLocked;
  const pendingCoreLocked = getEntryApprovalStatus(entry) === "PENDING_CONFIRMATION";

  const coreFieldDisabled = useCallback(
    (fieldKey: string) => controlsDisabled || !canEditField(entry, category, fieldKey),
    [category, controlsDisabled, entry]
  );

  return {
    entryLocked,
    controlsDisabled,
    pendingCoreLocked,
    coreFieldDisabled,
  };
}

