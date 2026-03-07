/**
 * Deprecated compatibility wrapper.
 *
 * Canonical business progress rules live in `lib/streakProgress.ts`.
 * Prefer importing utility helpers from:
 * - `lib/streakState.ts`
 * - `lib/streakTiming.ts`
 * - `lib/time.ts`
 * - `lib/requestEditWindow.ts`
 */

export { type StreakState, normalizeStreakState } from "./streakState.ts";
export {
  addDaysISO,
  addDaysIST,
  endOfDayIST,
  nowISTDateISO,
  nowISTTimestampISO,
} from "./time.ts";
export {
  computeDueAtISO,
  getStreakDisplayStatus as status,
  isFutureDatedEntry,
  isOverdue,
  isWithinDueWindow,
  remainingDaysFromDueAtISO,
} from "./streakTiming.ts";
export {
  computeEditableUntilISO,
  isWithinRequestEditWindow,
} from "./requestEditWindow.ts";
