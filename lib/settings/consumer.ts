import "server-only";

import { getSetting } from "@/lib/settings/store";

export async function getEditWindowDays(): Promise<number> {
  return getSetting<number>("entries.defaultEditWindow");
}

export async function getStreakBufferDays(): Promise<number> {
  return getSetting<number>("entries.streakEditBuffer");
}

export async function getPastEntryWindowDays(): Promise<number> {
  return getSetting<number>("entries.pastEntryWindow");
}

export async function getRequestSlaDays(): Promise<number> {
  return getSetting<number>("entries.requestSlaDays");
}

export async function getBackupRetention(): Promise<number> {
  return getSetting<number>("maintenance.backupRetentionCount");
}

export async function getIntegrityCheckInterval(): Promise<number> {
  return getSetting<number>("maintenance.integrityCheckInterval");
}

export async function getAnalyticsCacheTTL(): Promise<number> {
  return getSetting<number>("advanced.analyticsCacheTTL");
}

export async function isStreaksEnabled(): Promise<boolean> {
  return getSetting<boolean>("streaks.enabled");
}

export async function isMaintenanceMode(): Promise<boolean> {
  return getSetting<boolean>("advanced.maintenanceMode");
}

export async function getMaxExportHistory(): Promise<number> {
  return getSetting<number>("maintenance.maxExportHistory");
}

export async function isEditReasonRequired(): Promise<boolean> {
  return getSetting<boolean>("entries.requireEditReason");
}

export async function isStreakLeaderboardShown(): Promise<boolean> {
  return getSetting<boolean>("streaks.showLeaderboard");
}

export async function isActivityFeedEnabled(): Promise<boolean> {
  return getSetting<boolean>("streaks.showActivityFeed");
}
