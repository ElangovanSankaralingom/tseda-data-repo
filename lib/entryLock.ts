import {
  getEditLockState as getSharedEditLockState,
  isEntryEditable as isSharedEntryEditable,
  isFutureDatedEntry as isSharedFutureDatedEntry,
  isWithinRequestEditWindow as isSharedRequestEditWindow,
  type EditLockState,
} from "@/lib/gamification";

export function getEditLockState(entry: unknown, mode?: "streak" | "generic") {
  void mode;
  return getSharedEditLockState(entry as Parameters<typeof getSharedEditLockState>[0]);
}

export function isEntryEditable(entry: unknown) {
  return isSharedEntryEditable(entry as Parameters<typeof isSharedEntryEditable>[0]);
}

export function isEntryLockedState(entry: unknown, mode?: "streak" | "generic") {
  return getEditLockState(entry, mode).isLocked;
}

export function isFutureDatedEntry(startDate?: string, endDate?: string): boolean;
export function isFutureDatedEntry(args: { startDate?: string; endDate?: string }): boolean;
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

export type { EditLockState };
