import {
  getEditLockState as getSharedEditLockState,
  isEntryEditable as isSharedEntryEditable,
  isEntryLockedState as isSharedEntryLockedState,
  isFutureDatedEntry as isSharedFutureDatedEntry,
  isWithinRequestEditWindow as isSharedRequestEditWindow,
  type EditLockState as SharedEditLockState,
} from "../gamification.ts";
import type { LockStateColor } from "./types.ts";

export type EditLockState = SharedEditLockState;
export type EntryLockState = SharedEditLockState & { color: LockStateColor };

export function getEditLockState(entry: unknown, mode?: "streak" | "generic") {
  void mode;
  return getSharedEditLockState(
    entry as Parameters<typeof getSharedEditLockState>[0]
  );
}

export function isEntryEditable(entry: unknown) {
  return isSharedEntryEditable(entry as Parameters<typeof isSharedEntryEditable>[0]);
}

export function isEntryLockedState(entry: unknown, mode?: "streak" | "generic") {
  void mode;
  return isSharedEntryLockedState(
    entry as Parameters<typeof isSharedEntryLockedState>[0]
  );
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
