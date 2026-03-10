import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { logger } from "@/lib/logger";
import { getDataRoot } from "@/lib/userStore";
import {
  getSettingDefinition,
  getDefaultValue,
  getSettingsForCategory,
  getAllSettings,
} from "@/lib/settings/registry";
import type {
  SettingCategory,
  SettingChangeLogEntry,
  SettingsChangeLog,
  SettingsConfig,
  SettingWithMeta,
} from "@/lib/settings/schema";
import { SETTINGS_VERSION, MAX_CHANGELOG_ENTRIES } from "@/lib/settings/schema";
import { validateSetting } from "@/lib/settings/validation";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function settingsDir() {
  return path.join(process.cwd(), getDataRoot(), "settings");
}

function configPath() {
  return path.join(settingsDir(), "config.json");
}

function changelogPath() {
  return path.join(settingsDir(), "changelog.json");
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

let cachedConfig: SettingsConfig | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

// ---------------------------------------------------------------------------
// Read / Write config
// ---------------------------------------------------------------------------

async function readConfig(): Promise<SettingsConfig> {
  if (cachedConfig && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const raw = await fs.readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as SettingsConfig;
    if (parsed && typeof parsed === "object" && parsed.settings) {
      cachedConfig = parsed;
      cacheLoadedAt = Date.now();
      return parsed;
    }
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code !== "ENOENT") {
      logger.warn({ event: "settings.read.error", error: String(error) });
    }
  }

  const empty: SettingsConfig = { version: SETTINGS_VERSION, settings: {} };
  cachedConfig = empty;
  cacheLoadedAt = Date.now();
  return empty;
}

async function writeConfig(config: SettingsConfig): Promise<void> {
  await atomicWriteTextFile(configPath(), JSON.stringify(config, null, 2));
  cachedConfig = config;
  cacheLoadedAt = Date.now();
}

// ---------------------------------------------------------------------------
// Changelog
// ---------------------------------------------------------------------------

async function readChangelog(): Promise<SettingsChangeLog> {
  try {
    const raw = await fs.readFile(changelogPath(), "utf8");
    const parsed = JSON.parse(raw) as SettingsChangeLog;
    if (parsed && Array.isArray(parsed.entries)) return parsed;
  } catch {
    // empty changelog
  }
  return { entries: [] };
}

async function appendChangelog(entry: SettingChangeLogEntry): Promise<void> {
  const log = await readChangelog();
  log.entries.unshift(entry);
  if (log.entries.length > MAX_CHANGELOG_ENTRIES) {
    log.entries = log.entries.slice(0, MAX_CHANGELOG_ENTRIES);
  }
  await atomicWriteTextFile(changelogPath(), JSON.stringify(log, null, 2));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getSetting<T = unknown>(key: string): Promise<T> {
  const config = await readConfig();
  const stored = config.settings[key];
  if (stored !== undefined && stored !== null) {
    return stored.value as T;
  }
  return getDefaultValue(key) as T;
}

export async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const config = await readConfig();
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    const stored = config.settings[key];
    result[key] = stored?.value ?? getDefaultValue(key);
  }
  return result;
}

export async function getCategorySettings(category: SettingCategory): Promise<Record<string, unknown>> {
  const defs = getSettingsForCategory(category);
  const keys = defs.map((d) => d.key);
  return getSettings(keys);
}

export async function setSetting(key: string, value: unknown, changedBy: string): Promise<void> {
  const def = getSettingDefinition(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);

  const validation = validateSetting(key, value);
  if (!validation.valid) throw new Error(`Invalid value for ${key}: ${validation.error}`);

  const config = await readConfig();
  const oldValue = config.settings[key]?.value ?? def.default;
  const nowISO = new Date().toISOString();

  // If setting back to default, remove from stored config (sparse storage)
  if (JSON.stringify(value) === JSON.stringify(def.default)) {
    delete config.settings[key];
  } else {
    config.settings[key] = { value, changedBy, changedAt: nowISO };
  }

  await writeConfig(config);
  await appendChangelog({ key, oldValue, newValue: value, changedBy, changedAt: nowISO });

  logger.info({
    event: "settings.changed",
    key,
    changedBy,
    oldValue: JSON.stringify(oldValue),
    newValue: JSON.stringify(value),
  });
}

export async function setSettings(
  settings: Record<string, unknown>,
  changedBy: string
): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value, changedBy);
  }
}

export async function resetSetting(key: string, changedBy: string): Promise<void> {
  const def = getSettingDefinition(key);
  if (!def) throw new Error(`Unknown setting: ${key}`);
  await setSetting(key, def.default, changedBy);
}

export async function resetAllSettings(changedBy: string): Promise<void> {
  const config = await readConfig();
  const nowISO = new Date().toISOString();

  for (const [key, stored] of Object.entries(config.settings)) {
    const def = getSettingDefinition(key);
    if (!def) continue;
    await appendChangelog({
      key,
      oldValue: stored.value,
      newValue: def.default,
      changedBy,
      changedAt: nowISO,
    });
  }

  await writeConfig({ version: SETTINGS_VERSION, settings: {} });
  logger.info({ event: "settings.reset-all", changedBy });
}

export async function getSettingWithMeta(key: string): Promise<SettingWithMeta | null> {
  const def = getSettingDefinition(key);
  if (!def) return null;

  const config = await readConfig();
  const stored = config.settings[key];

  return {
    value: stored?.value ?? def.default,
    definition: def,
    isDefault: !stored,
    lastChangedBy: stored?.changedBy,
    lastChangedAt: stored?.changedAt,
  };
}

export async function getAllSettingsWithMeta(): Promise<SettingWithMeta[]> {
  const config = await readConfig();
  const defs = getAllSettings();

  return defs.map((def) => {
    const stored = config.settings[def.key];
    return {
      value: stored?.value ?? def.default,
      definition: def,
      isDefault: !stored,
      lastChangedBy: stored?.changedBy,
      lastChangedAt: stored?.changedAt,
    };
  });
}

export async function getChangeLog(): Promise<SettingChangeLogEntry[]> {
  const log = await readChangelog();
  return log.entries;
}

export async function exportSettings(): Promise<Record<string, unknown>> {
  const config = await readConfig();
  const result: Record<string, unknown> = {};
  for (const [key, stored] of Object.entries(config.settings)) {
    result[key] = stored.value;
  }
  return result;
}

export async function importSettings(
  data: Record<string, unknown>,
  changedBy: string
): Promise<{ imported: number; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  let imported = 0;

  for (const [key, value] of Object.entries(data)) {
    const def = getSettingDefinition(key);
    if (!def) {
      errors[key] = "Unknown setting";
      continue;
    }
    const validation = validateSetting(key, value);
    if (!validation.valid) {
      errors[key] = validation.error ?? "Invalid";
      continue;
    }
    await setSetting(key, value, changedBy);
    imported++;
  }

  return { imported, errors };
}

/** Get count of non-default settings per category */
export async function getNonDefaultCounts(): Promise<Record<SettingCategory, number>> {
  const config = await readConfig();
  const counts: Record<string, number> = {};

  for (const [key] of Object.entries(config.settings)) {
    const def = getSettingDefinition(key);
    if (!def) continue;
    counts[def.category] = (counts[def.category] ?? 0) + 1;
  }

  return counts as Record<SettingCategory, number>;
}
