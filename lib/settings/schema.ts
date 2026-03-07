export type SettingType =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "email"
  | "email-list"
  | "color";

export type SettingCategory =
  | "general"
  | "auth"
  | "entries"
  | "streaks"
  | "maintenance"
  | "appearance"
  | "advanced";

export type SelectOption = {
  value: string;
  label: string;
};

export type SettingValidation = {
  min?: number;
  max?: number;
  pattern?: string;
  options?: SelectOption[];
  required?: boolean;
};

export type SettingDefinition = {
  key: string;
  label: string;
  description: string;
  category: SettingCategory;
  type: SettingType;
  default: unknown;
  validation?: SettingValidation;
  requiresRestart?: boolean;
  adminOnly?: boolean;
  dangerous?: boolean;
  group?: string;
};

export type StoredSetting = {
  value: unknown;
  changedBy: string;
  changedAt: string;
};

export type SettingsConfig = {
  version: number;
  settings: Record<string, StoredSetting>;
};

export type SettingChangeLogEntry = {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: string;
};

export type SettingsChangeLog = {
  entries: SettingChangeLogEntry[];
};

export type SettingWithMeta = {
  value: unknown;
  definition: SettingDefinition;
  isDefault: boolean;
  lastChangedBy?: string;
  lastChangedAt?: string;
};

export const SETTINGS_VERSION = 1;
export const MAX_CHANGELOG_ENTRIES = 100;
