"use client";

import { useCallback, useMemo } from "react";
import { isEntryLockedFromStatus } from "@/lib/confirmation";
import { canEditField } from "@/lib/pendingImmutability";
import type { CategoryKey } from "@/lib/entries/types";

type EntryLike = {
  status?: string | null;
  confirmationStatus?: string | null;
  requestEditStatus?: string | null;
  committedAtISO?: string | null;
  editWindowExpiresAt?: string | null;
  editRequestedAt?: string | null;
  editGrantedAt?: string | null;
  /** Server-computed editability (from entryToApiResponse). */
  isEditable?: boolean;
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
  // IMPORTANT: isEditable comes from the SERVER response (via entryToApiResponse).
  // Do NOT recompute on the client. For new entries (no server response yet),
  // isEditable is undefined → treated as true (new drafts are always editable).
  const entryEditable = entry.isEditable !== false;

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
