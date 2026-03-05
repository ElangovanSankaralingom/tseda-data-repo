export type StreakState = {
  activatedAtISO?: string | null;
  dueAtISO?: string | null;
  completedAtISO?: string | null;
  windowDays?: number;
};

type LockableEntryLike = {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  streak?: unknown;
  requestEditStatus?: string | null;
};

export type PendingAggregate = {
  pendingCount: number;
  activeEntryId?: string;
  activeDaysRemaining?: number;
  anyWithinWindow: boolean;
  allZeroDays: boolean;
};

export type PendingCategoryKey = "fdp-attended" | "fdp-conducted";

export type GlobalWinsAggregate = {
  winsCount: number;
};

export type EditLockState = {
  isLocked: boolean;
  expiresAtISO: string | null;
  daysRemaining: number;
};

type PendingCapableStreakEntry = {
  id: string;
  streak: StreakState;
  startDate?: string;
  endDate?: string;
  status?: string;
  completionCertificate?: unknown | null;
  geotaggedPhotos?: unknown[] | null;
};

type StreakWinEntry = {
  streak: StreakState;
  startDate?: string;
  endDate?: string;
  status?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MINUTES = 5.5 * 60;

function isISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isISODateTime(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function toUTCDate(dateISO: string) {
  return new Date(`${dateISO}T00:00:00Z`);
}

function parseDateParts(dateISO: string) {
  const match = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatISTDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function toISTDateTime(dateISO: string, hours: number, minutes: number, seconds = 0, ms = 0) {
  const parts = parseDateParts(dateISO);
  if (!parts) return null;

  const utcMs =
    Date.UTC(parts.year, parts.month - 1, parts.day, hours, minutes, seconds, ms) -
    IST_OFFSET_MINUTES * 60 * 1000;

  return new Date(utcMs).toISOString();
}

function getEntryCompletionValue(entry: PendingCapableStreakEntry | StreakWinEntry) {
  if ("completionCertificate" in entry && entry.completionCertificate) return true;
  return "geotaggedPhotos" in entry && Array.isArray(entry.geotaggedPhotos) && entry.geotaggedPhotos.length > 0;
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

export function nowISTDateISO() {
  return formatISTDate(new Date());
}

export function nowISTTimestampISO() {
  return new Date().toISOString();
}

export function nowIST() {
  return nowISTTimestampISO();
}

export function isWithinRequestEditWindow(
  requestedAtISO: string | null | undefined,
  windowMinutes = 5
) {
  if (!requestedAtISO || !isISODateTime(requestedAtISO)) return false;

  const diffMs = Date.now() - new Date(requestedAtISO).getTime();
  return diffMs >= 0 && diffMs <= windowMinutes * 60 * 1000;
}

export function isFutureDatedEntry(startISO: string, endISO: string) {
  if (!isISODate(startISO) || !isISODate(endISO)) return false;

  const todayIST = nowISTDateISO();
  return startISO >= todayIST && endISO >= todayIST;
}

export function isPastDatedEntry(startISO: string, endISO: string) {
  return !isFutureDatedEntry(startISO, endISO);
}

export function addDaysISO(dateISO: string, days: number) {
  if (!isISODate(dateISO)) return dateISO;

  const date = toUTCDate(dateISO);
  date.setUTCDate(date.getUTCDate() + days);
  return formatISTDate(date);
}

export function addDaysIST(dateISO: string, days: number) {
  return addDaysISO(dateISO, days);
}

export function endOfDayIST(dateISO: string) {
  if (!isISODate(dateISO)) return null;
  return toISTDateTime(dateISO, 23, 59, 59, 999);
}

export function computeDueAtISO(endDateISO: string) {
  if (!isISODate(endDateISO)) return null;
  const dueDayISO = addDaysISO(endDateISO, 8);
  return toISTDateTime(dueDayISO, 23, 59, 59, 999);
}

export function computeEditableUntilISO(createdAtISO: string) {
  if (!createdAtISO) return null;

  const createdDateISO = formatISTDate(new Date(createdAtISO));
  const editableDayISO = addDaysISO(createdDateISO, 2);
  return toISTDateTime(editableDayISO, 23, 59, 59, 999);
}

export function computeGenericDueAtISO(endDateISO: string) {
  if (!isISODate(endDateISO)) return null;
  const dueDayISO = addDaysISO(endDateISO, 2);
  return toISTDateTime(dueDayISO, 23, 59, 59, 999);
}

export function remainingDaysFromDueAtISO(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return 0;

  const diff = new Date(dueAtISO).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

export function remainingDaysCeil(dueAtISO: string | null | undefined) {
  return remainingDaysFromDueAtISO(dueAtISO);
}

export function remainingEditableDays(createdAtISO: string) {
  return remainingDaysFromDueAtISO(computeEditableUntilISO(createdAtISO));
}

export function isWithinDueWindow(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return false;
  return new Date(dueAtISO).getTime() >= Date.now();
}

export function isOverdue(dueAtISO: string | null | undefined) {
  if (!dueAtISO || !isISODateTime(dueAtISO)) return false;
  return new Date(dueAtISO).getTime() < Date.now();
}

export function status(state: StreakState) {
  const normalized = normalizeStreakState(state);
  if (!normalized.activatedAtISO) return "inactive" as const;
  if (normalized.completedAtISO) return "completed" as const;
  if (isWithinDueWindow(normalized.dueAtISO)) return "active" as const;
  return "expired" as const;
}

export function ensureActivated(state: StreakState | undefined, endDateISO?: string) {
  const normalized = normalizeStreakState(state);
  return {
    ...normalized,
    activatedAtISO: normalized.activatedAtISO || nowISTTimestampISO(),
    dueAtISO: normalized.dueAtISO || (endDateISO ? computeDueAtISO(endDateISO) : null),
    completedAtISO: normalized.completedAtISO || null,
  };
}

export function markCompleted(state: StreakState | undefined) {
  const normalized = normalizeStreakState(state);
  return {
    ...normalized,
    completedAtISO: normalized.completedAtISO || nowISTTimestampISO(),
  };
}

export function isEntryLockedByStreak(state: StreakState | undefined) {
  const normalized = normalizeStreakState(state);
  return !!normalized.dueAtISO && isOverdue(normalized.dueAtISO);
}

export function isNonStreakEntryLocked(createdAtISO: string) {
  const editableUntilISO = computeEditableUntilISO(createdAtISO);
  return editableUntilISO ? !isWithinDueWindow(editableUntilISO) : false;
}

export function isRequestEditApproved(value: string | null | undefined) {
  return value === "approved";
}

export function getEditLockState(entry: LockableEntryLike): EditLockState {
  void entry;
  return {
    isLocked: false,
    expiresAtISO: null,
    daysRemaining: 0,
  };
}

export function isEntryLockedState(entry: LockableEntryLike) {
  void entry;
  return false;
}

export function isEntryEditable(entry: LockableEntryLike) {
  void entry;
  return true;
}

function isCompletedWithinDueWindow(state: StreakState) {
  const normalized = normalizeStreakState(state);
  if (!normalized.activatedAtISO || !normalized.completedAtISO || !normalized.dueAtISO) return false;
  return new Date(normalized.completedAtISO).getTime() <= new Date(normalized.dueAtISO).getTime();
}

export function remainingDaysInWindowIST(dueAtISO: string | null | undefined) {
  return remainingDaysFromDueAtISO(dueAtISO);
}

export function aggregateCategoryPending(
  entries: Array<PendingCapableStreakEntry | null | undefined>,
  categoryKey: PendingCategoryKey
): PendingAggregate {
  let pendingCount = 0;
  let activeEntryId: string | undefined;
  let activeDaysRemaining: number | undefined;
  let anyWithinWindow = false;

  for (const entry of entries) {
    if (!entry?.id) continue;
    if (entry.status !== "final") continue;
    if (!isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "")) continue;
    if (!entry.streak?.activatedAtISO) continue;

    const isCompleted =
      categoryKey === "fdp-attended"
        ? !!entry.completionCertificate || !!entry.streak.completedAtISO
        : getEntryCompletionValue(entry) || !!entry.streak.completedAtISO;

    if (isCompleted) continue;

    pendingCount += 1;

    const remaining = remainingDaysFromDueAtISO(entry.streak.dueAtISO);
    if (isWithinDueWindow(entry.streak.dueAtISO)) {
      anyWithinWindow = true;
      if (activeDaysRemaining === undefined || remaining < activeDaysRemaining) {
        activeEntryId = entry.id;
        activeDaysRemaining = remaining;
      }
    }
  }

  return {
    pendingCount,
    activeEntryId,
    activeDaysRemaining,
    anyWithinWindow,
    allZeroDays: pendingCount > 0 && !anyWithinWindow,
  };
}

export function aggregateGlobalWins(
  allCategoryData: Record<string, Array<StreakWinEntry | null | undefined> | undefined>
): GlobalWinsAggregate {
  let winsCount = 0;

  for (const entries of Object.values(allCategoryData)) {
    for (const entry of entries ?? []) {
      if (!entry) continue;
      if (entry.status !== "final") continue;
      if (!isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "")) continue;
      if (isCompletedWithinDueWindow(entry.streak)) {
        winsCount += 1;
      }
    }
  }

  return { winsCount };
}
