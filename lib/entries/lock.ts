import { isEntryLockedFromStatus } from "../confirmation.ts";
import { isWithinRequestEditWindow as isSharedRequestEditWindow } from "../requestEditWindow.ts";
import { isFutureDatedEntry as isSharedFutureDatedEntry } from "../streakTiming.ts";
import type { LockStateColor } from "./types.ts";

type LockableEntryLike = {
  status?: string | null;
  confirmationStatus?: string | null;
};

export type EditLockState = {
  isLocked: boolean;
  expiresAtISO: string | null;
  daysRemaining: number;
};
export type EntryLockState = EditLockState & { color: LockStateColor };

export function getEditLockState(entry: unknown, mode?: "streak" | "generic") {
  void mode;
  return {
    isLocked: isEntryLockedFromStatus(entry as LockableEntryLike),
    expiresAtISO: null,
    daysRemaining: 0,
  };
}

export function isEntryEditable(entry: unknown) {
  return !isEntryLockedFromStatus(entry as LockableEntryLike);
}

export function isEntryLockedState(entry: unknown, mode?: "streak" | "generic") {
  void mode;
  return isEntryLockedFromStatus(entry as LockableEntryLike);
}

export function isFutureDatedEntry(startDate?: string, endDate?: string): boolean;
export function isFutureDatedEntry(args: {
  startDate?: string;
  endDate?: string;
}): boolean;
export function isFutureDatedEntry(
  input?: string | { startDate?: string; endDate?: string },
  endDate?: string
) {
  if (typeof input === "object" && input !== null) {
    return isSharedFutureDatedEntry(input.startDate ?? "", input.endDate ?? "");
  }

  return isSharedFutureDatedEntry(input ?? "", endDate ?? "");
}

export function isWithinRequestEditWindow(
  requestedAtISO: string | null | undefined,
  windowMinutes = 5
) {
  return isSharedRequestEditWindow(requestedAtISO, windowMinutes);
}

export function computeLockState(entry: unknown, mode?: "streak" | "generic"): EntryLockState {
  const state = getEditLockState(entry, mode);
  const color: LockStateColor =
    state.isLocked || state.daysRemaining <= 2
      ? "red"
      : state.daysRemaining <= 5
        ? "yellow"
        : "normal";

  return {
    ...state,
    color,
  };
}
