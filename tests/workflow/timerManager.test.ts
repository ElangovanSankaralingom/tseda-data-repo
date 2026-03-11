import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeTimerState, pauseTimer, resumeTimer, clearTimer } from "@/lib/workflow/timerManager";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/workflow/workflowConfig";

const config = DEFAULT_WORKFLOW_CONFIG;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("computeTimerState", () => {
  it("returns not expired when timer has time remaining", () => {
    const now = Date.now();
    const entry = { editWindowExpiresAt: new Date(now + 2 * DAY).toISOString() };
    const state = computeTimerState(entry, config, now);
    assert.equal(state.isPaused, false);
    assert.equal(state.isExpired, false);
    assert.ok(state.remainingMs! > DAY);
    assert.ok(state.remainingMs! <= 2 * DAY);
    assert.equal(state.expiresAt, entry.editWindowExpiresAt);
  });

  it("returns expired when timer is past", () => {
    const now = Date.now();
    const entry = { editWindowExpiresAt: new Date(now - HOUR).toISOString() };
    const state = computeTimerState(entry, config, now);
    assert.equal(state.isExpired, true);
    assert.equal(state.remainingMs, 0);
  });

  it("returns paused when timerPausedAt is set", () => {
    const now = Date.now();
    const entry = {
      editWindowExpiresAt: new Date(now + DAY).toISOString(),
      timerPausedAt: new Date(now - HOUR).toISOString(),
      timerRemainingMs: DAY,
    };
    const state = computeTimerState(entry, config, now);
    assert.equal(state.isPaused, true);
    assert.equal(state.isExpired, false);
    assert.equal(state.remainingMs, DAY);
    assert.equal(state.expiresAt, null);
  });

  it("returns no timer when editWindowExpiresAt is absent", () => {
    const state = computeTimerState({}, config);
    assert.equal(state.isPaused, false);
    assert.equal(state.isExpired, false);
    assert.equal(state.remainingMs, null);
    assert.equal(state.expiresAt, null);
  });
});

describe("pauseTimer", () => {
  it("captures remaining time", () => {
    const now = Date.now();
    const entry = { editWindowExpiresAt: new Date(now + 2 * DAY).toISOString() };
    const result = pauseTimer(entry, now);
    assert.ok(result.timerPausedAt);
    assert.ok(result.timerRemainingMs > DAY);
    assert.ok(result.timerRemainingMs <= 2 * DAY);
  });
});

describe("resumeTimer", () => {
  it("sets new expiresAt from remaining time", () => {
    const now = Date.now();
    const entry = { timerRemainingMs: 2 * DAY };
    const result = resumeTimer(entry, now);
    const expectedExpiry = now + 2 * DAY;
    assert.ok(Math.abs(new Date(result.editWindowExpiresAt).getTime() - expectedExpiry) < 1000);
    assert.equal(result.timerPausedAt, null);
    assert.equal(result.timerRemainingMs, null);
  });
});

describe("clearTimer", () => {
  it("clears pause fields", () => {
    const result = clearTimer();
    assert.equal(result.timerPausedAt, null);
    assert.equal(result.timerRemainingMs, null);
  });
});
