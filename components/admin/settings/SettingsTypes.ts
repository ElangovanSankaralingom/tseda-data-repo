// ---------------------------------------------------------------------------
// Types & constants for the Settings dashboard
// ---------------------------------------------------------------------------

export type SettingType = "string" | "number" | "boolean" | "select" | "multi-select" | "email" | "email-list" | "color";
export type SettingCategory = "general" | "auth" | "entries" | "streaks" | "maintenance" | "appearance" | "advanced";

export type SelectOption = { value: string; label: string };
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
  dangerous?: boolean;
  group?: string;
};

export type SettingWithMeta = {
  value: unknown;
  definition: SettingDefinition;
  isDefault: boolean;
  lastChangedBy?: string;
  lastChangedAt?: string;
};

export type ChangeLogEntry = {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: string;
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";
