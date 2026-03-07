import "server-only";

import { getSetting } from "@/lib/settings/store";

export async function getEditWindowDays(): Promise<number> {
  return getSetting<number>("entries.defaultEditWindow");
}

export async function getStreakBufferDays(): Promise<number> {
  return getSetting<number>("entries.streakEditBuffer");
}

export async function getAllowedDomain(): Promise<string> {
  return getSetting<string>("auth.allowedDomain");
}

export async function getBackupRetention(): Promise<number> {
  return getSetting<number>("maintenance.backupRetentionCount");
}

export async function getIntegrityCheckInterval(): Promise<number> {
  return getSetting<number>("maintenance.integrityCheckInterval");
}

export async function getWalRetentionDays(): Promise<number> {
  return getSetting<number>("maintenance.walRetentionDays");
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

export async function getMaintenanceMessage(): Promise<string> {
  return getSetting<string>("advanced.maintenanceMessage");
}

export async function isDebugMode(): Promise<boolean> {
  return getSetting<boolean>("advanced.debugMode");
}

export async function getAppName(): Promise<string> {
  return getSetting<string>("general.appName");
}

export async function getInstitutionName(): Promise<string> {
  return getSetting<string>("general.institutionName");
}

export async function getInstitutionShort(): Promise<string> {
  return getSetting<string>("general.institutionShort");
}
