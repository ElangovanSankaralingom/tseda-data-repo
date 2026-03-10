/**
 * Streak deadline utilities.
 *
 * With the simplified streak system (lifetime counters, no time windows),
 * deadlines are no longer applicable. All functions return inactive/no-deadline state.
 */

export type StreakDeadlineColor = "normal" | "yellow" | "red";

export type StreakDeadlineState = {
  hasDeadline: boolean;
  deadlineISO: string | null;
  daysRemaining: number;
  isExpired: boolean;
  color: StreakDeadlineColor;
};

const NO_DEADLINE: StreakDeadlineState = {
  hasDeadline: false,
  deadlineISO: null,
  daysRemaining: 0,
  isExpired: false,
  color: "normal",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getStreakDeadlineISO(_entry: unknown) {
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getDaysLeft(deadlineISO: string | null | undefined, _nowISO?: string) {
  if (!deadlineISO) return 0;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const deadlineTime = Date.parse(deadlineISO);
  const nowTime = Date.now();

  if (Number.isNaN(deadlineTime)) return 0;
  return Math.ceil((deadlineTime - nowTime) / DAY_MS);
}

export function getDaysLeftColor(daysLeft: number): StreakDeadlineColor {
  if (daysLeft <= 2) return "red";
  if (daysLeft <= 5) return "yellow";
  return "normal";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isStreakWindowActive(_entry: unknown, _nowISO?: string) {
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function isStreakExpired(_entry: unknown, _nowISO?: string) {
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getStreakDeadlineState(_entry: unknown, _nowISO?: string): StreakDeadlineState {
  return { ...NO_DEADLINE };
}
