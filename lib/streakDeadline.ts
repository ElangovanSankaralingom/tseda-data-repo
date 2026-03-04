import { computeDueAtISO, normalizeStreakState } from "@/lib/gamification";

const DAY_MS = 24 * 60 * 60 * 1000;

type DeadlineEntry = {
  endDate?: string | null;
  streak?: unknown;
};

export type StreakDeadlineColor = "normal" | "yellow" | "red";

export type StreakDeadlineState = {
  hasDeadline: boolean;
  deadlineISO: string | null;
  daysRemaining: number;
  isExpired: boolean;
  color: StreakDeadlineColor;
};

export function getStreakDeadlineISO(entry: DeadlineEntry) {
  const streak = normalizeStreakState(entry.streak);

  if (!streak.activatedAtISO || streak.completedAtISO) {
    return null;
  }

  return streak.dueAtISO || (entry.endDate ? computeDueAtISO(entry.endDate) : null);
}

export function getDaysLeft(deadlineISO: string | null | undefined, nowISO?: string) {
  if (!deadlineISO) return 0;

  const deadlineTime = Date.parse(deadlineISO);
  const nowTime = nowISO ? Date.parse(nowISO) : Date.now();

  if (Number.isNaN(deadlineTime) || Number.isNaN(nowTime)) {
    return 0;
  }

  return Math.ceil((deadlineTime - nowTime) / DAY_MS);
}

export function getDaysLeftColor(daysLeft: number): StreakDeadlineColor {
  if (daysLeft <= 2) return "red";
  if (daysLeft <= 5) return "yellow";
  return "normal";
}

export function isStreakWindowActive(entry: DeadlineEntry, nowISO?: string) {
  const deadlineISO = getStreakDeadlineISO(entry);
  if (!deadlineISO) return false;

  return getDaysLeft(deadlineISO, nowISO) >= 0;
}

export function isStreakExpired(entry: DeadlineEntry, nowISO?: string) {
  const deadlineISO = getStreakDeadlineISO(entry);
  if (!deadlineISO) return false;

  return getDaysLeft(deadlineISO, nowISO) < 0;
}

export function getStreakDeadlineState(entry: DeadlineEntry, nowISO?: string): StreakDeadlineState {
  const deadlineISO = getStreakDeadlineISO(entry);

  if (!deadlineISO) {
    return {
      hasDeadline: false,
      deadlineISO: null,
      daysRemaining: 0,
      isExpired: false,
      color: "normal",
    };
  }

  const daysLeft = getDaysLeft(deadlineISO, nowISO);
  const isExpired = daysLeft < 0;

  return {
    hasDeadline: true,
    deadlineISO,
    daysRemaining: isExpired ? 0 : daysLeft,
    isExpired,
    color: getDaysLeftColor(daysLeft),
  };
}
