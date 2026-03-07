import "server-only";

import { getLastReport } from "@/lib/integrity/report";
import { getIntegrityCheckInterval } from "@/lib/settings/consumer";

const DEFAULT_CHECK_INTERVAL_DAYS = 7;

export async function getScheduleStatus() {
  const result = await getLastReport();
  const lastReport = result.ok ? result.data : null;

  let checkInterval = DEFAULT_CHECK_INTERVAL_DAYS;
  try { checkInterval = await getIntegrityCheckInterval(); } catch { /* use default */ }

  const lastCheckAt = lastReport?.runAt ?? null;
  const lastCheckMs = lastCheckAt ? Date.parse(lastCheckAt) : 0;
  const msSinceLastCheck = lastCheckMs > 0 ? Date.now() - lastCheckMs : Infinity;
  const daysSinceLastCheck = msSinceLastCheck / (24 * 60 * 60 * 1000);
  const isOverdue = daysSinceLastCheck > checkInterval;

  return {
    lastCheckAt,
    daysSinceLastCheck: Number.isFinite(daysSinceLastCheck) ? Math.floor(daysSinceLastCheck) : null,
    isOverdue,
    lastStatus: lastReport?.status ?? null,
  };
}
