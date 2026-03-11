import type { WorkflowConfig } from "./workflowConfig";

type TimerEntry = {
  editWindowExpiresAt?: string | null;
  timerPausedAt?: string | null;
  timerRemainingMs?: number | null;
  confirmationStatus?: string | null;
};

export type TimerState = {
  isPaused: boolean;
  isExpired: boolean;
  remainingMs: number | null;
  expiresAt: string | null;
  pausedAt: string | null;
};

export function computeTimerState(
  entry: TimerEntry,
  config: WorkflowConfig,
  nowMs: number = Date.now(),
): TimerState {
  // Timer paused during pending requests
  if (config.timer.pauseOnRequest && entry.timerPausedAt) {
    return {
      isPaused: true,
      isExpired: false,
      remainingMs: typeof entry.timerRemainingMs === "number" ? entry.timerRemainingMs : null,
      expiresAt: null,
      pausedAt: entry.timerPausedAt,
    };
  }

  const expiresAt = entry.editWindowExpiresAt;
  if (!expiresAt) {
    return {
      isPaused: false,
      isExpired: false,
      remainingMs: null,
      expiresAt: null,
      pausedAt: null,
    };
  }

  const expiresMs = new Date(expiresAt).getTime();
  const remainingMs = Math.max(0, expiresMs - nowMs);

  return {
    isPaused: false,
    isExpired: remainingMs <= 0,
    remainingMs: remainingMs > 0 ? remainingMs : 0,
    expiresAt,
    pausedAt: null,
  };
}

/**
 * Compute pause snapshot when entering EDIT_REQUESTED or DELETE_REQUESTED.
 * Returns the fields to set on the entry.
 */
export function pauseTimer(entry: TimerEntry, nowMs: number = Date.now()): {
  timerPausedAt: string;
  timerRemainingMs: number;
} {
  const expiresAt = entry.editWindowExpiresAt;
  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : nowMs;
  const remainingMs = Math.max(0, expiresMs - nowMs);

  return {
    timerPausedAt: new Date(nowMs).toISOString(),
    timerRemainingMs: remainingMs,
  };
}

/**
 * Compute resume fields when admin acts (grant/reject).
 * Returns the new editWindowExpiresAt.
 */
export function resumeTimer(entry: TimerEntry, nowMs: number = Date.now()): {
  editWindowExpiresAt: string;
  timerPausedAt: null;
  timerRemainingMs: null;
} {
  const remainingMs = typeof entry.timerRemainingMs === "number"
    ? entry.timerRemainingMs
    : 3 * 24 * 60 * 60 * 1000; // fallback 3 days

  return {
    editWindowExpiresAt: new Date(nowMs + remainingMs).toISOString(),
    timerPausedAt: null,
    timerRemainingMs: null,
  };
}

/**
 * Clear timer entirely (used when permanently locking).
 */
export function clearTimer(): {
  timerPausedAt: null;
  timerRemainingMs: null;
} {
  return {
    timerPausedAt: null,
    timerRemainingMs: null,
  };
}
