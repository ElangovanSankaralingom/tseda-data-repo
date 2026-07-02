import assert from "node:assert/strict";
import test from "node:test";
import { addDaysISO, endOfDayIST, nowISTDateISO } from "../../lib/time.ts";
import { checkStreakEligibility } from "../../lib/streakProgress.ts";
import { computeDueAtISO } from "../../lib/streakTiming.ts";

/**
 * 2026-07 audit gap: no explicit IST/UTC boundary coverage. All deadline and
 * streak math is defined in IST; these assertions pin the exact UTC instants
 * and calendar arithmetic so the suite fails loudly if date handling ever
 * becomes host-timezone-sensitive (the suite runs on both UTC CI and IST
 * developer machines).
 */

test("endOfDayIST maps 23:59:59.999 IST to the exact UTC instant (-05:30)", () => {
  assert.equal(endOfDayIST("2026-07-02"), "2026-07-02T18:29:59.999Z");
  // IST has no DST — the offset must be identical mid-winter.
  assert.equal(endOfDayIST("2026-01-01"), "2026-01-01T18:29:59.999Z");
});

test("endOfDayIST rejects non-ISO input", () => {
  assert.equal(endOfDayIST("02-07-2026"), null);
  assert.equal(endOfDayIST(""), null);
});

test("addDaysISO carries month, year, and leap-day boundaries", () => {
  assert.equal(addDaysISO("2026-06-30", 8), "2026-07-08");
  assert.equal(addDaysISO("2025-12-31", 8), "2026-01-08");
  assert.equal(addDaysISO("2028-02-25", 8), "2028-03-04"); // 2028 is a leap year
  assert.equal(addDaysISO("2026-03-01", -1), "2026-02-28"); // 2026 is not
});

test("streak +8 day grace deadline lands on the exact IST end-of-day instant", () => {
  // endDate + 8 days, 23:59:59.999 IST, expressed in UTC (-05:30).
  assert.equal(computeDueAtISO("2026-06-30"), "2026-07-08T18:29:59.999Z");
  assert.equal(computeDueAtISO("2025-12-31"), "2026-01-08T18:29:59.999Z"); // year carry
  assert.equal(computeDueAtISO("not-a-date"), null);
});

test("streak eligibility boundary: today (IST) is NOT future — tomorrow is", () => {
  const todayIST = nowISTDateISO();
  assert.equal(
    checkStreakEligibility({ endDate: todayIST }),
    false,
    "an entry ending today must not be streak eligible",
  );
  assert.equal(checkStreakEligibility({ endDate: addDaysISO(todayIST, 1) }), true);
  assert.equal(checkStreakEligibility({ endDate: addDaysISO(todayIST, -1) }), false);
});
