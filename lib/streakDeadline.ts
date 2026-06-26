/**
 * Streak deadline utilities.
 *
 * With the simplified streak system (lifetime counters, no time windows),
 * hard deadlines no longer apply. The remaining helpers only format the
 * "days left" display used by the entry lifecycle view.
 */

export type StreakDeadlineColor = "normal" | "yellow" | "red";

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
