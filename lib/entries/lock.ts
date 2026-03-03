import {
  getEditLockState,
  isEntryEditable,
  isEntryLockedState,
  isFutureDatedEntry,
  isWithinRequestEditWindow,
  type EditLockState,
} from "../entryLock.ts";
import type { LockStateColor } from "./types.ts";

export type EntryLockState = EditLockState & { color: LockStateColor };

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

export {
  getEditLockState,
  isEntryEditable,
  isEntryLockedState,
  isFutureDatedEntry,
  isWithinRequestEditWindow,
};

export type { EditLockState };
