"use client";

import { useCallback, useMemo } from "react";
import { isEntryLockedFromStatus } from "@/lib/confirmation";
import { canEditField } from "@/lib/pendingImmutability";
import { isEntryEditable } from "@/lib/entries/workflow";
import type { CategoryKey } from "@/lib/entries/types";

type EntryLike = {
  status?: string | null;
  confirmationStatus?: string | null;
  requestEditStatus?: string | null;
  committedAtISO?: string | null;
  editWindowExpiresAt?: string | null;
  editRequestedAt?: string | null;
  editGrantedAt?: string | null;
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
  const entryEditable = isEntryEditable(entry);

  const coreFieldDisabled = useCallback(
    (fieldKey: string) => controlsDisabled || !canEditField(entry, category, fieldKey),
    [category, controlsDisabled, entry]
  );

  return {
    entryLocked,
    controlsDisabled,
    pendingCoreLocked: !entryEditable,
    coreFieldDisabled,
  };
}
