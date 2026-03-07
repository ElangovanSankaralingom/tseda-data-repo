export type StreakState = {
  activatedAtISO?: string | null;
  dueAtISO?: string | null;
  completedAtISO?: string | null;
  windowDays?: number;
};

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isISODateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function normalizeStreakState(value: unknown): StreakState {
  if (!value || typeof value !== "object") {
    return {
      activatedAtISO: null,
      dueAtISO: null,
      completedAtISO: null,
      windowDays: 5,
    };
  }

  const record = value as {
    activatedAtISO?: unknown;
    dueAtISO?: unknown;
    completedAtISO?: unknown;
    windowDays?: unknown;
  };

  return {
    activatedAtISO:
      typeof record.activatedAtISO === "string" &&
      (isISODate(record.activatedAtISO) || isISODateTime(record.activatedAtISO))
        ? record.activatedAtISO
        : null,
    dueAtISO:
      typeof record.dueAtISO === "string" && isISODateTime(record.dueAtISO) ? record.dueAtISO : null,
    completedAtISO:
      typeof record.completedAtISO === "string" &&
      (isISODate(record.completedAtISO) || isISODateTime(record.completedAtISO))
        ? record.completedAtISO
        : null,
    windowDays:
      typeof record.windowDays === "number" && Number.isFinite(record.windowDays) && record.windowDays > 0
        ? record.windowDays
        : 5,
  };
}
