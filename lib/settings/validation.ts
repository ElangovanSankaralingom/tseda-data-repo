import { getSettingDefinition } from "@/lib/settings/registry";
import type { SettingDefinition } from "@/lib/settings/schema";

type ValidationResult = { valid: boolean; error?: string };

function validateValue(def: SettingDefinition, value: unknown): ValidationResult {
  if (value === null || value === undefined) {
    if (def.validation?.required) return { valid: false, error: "Required" };
    return { valid: true };
  }

  switch (def.type) {
    case "boolean": {
      if (typeof value !== "boolean") return { valid: false, error: "Must be true or false" };
      return { valid: true };
    }

    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        return { valid: false, error: "Must be a number" };
      }
      if (def.validation?.min !== undefined && value < def.validation.min) {
        return { valid: false, error: `Minimum is ${def.validation.min}` };
      }
      if (def.validation?.max !== undefined && value > def.validation.max) {
        return { valid: false, error: `Maximum is ${def.validation.max}` };
      }
      return { valid: true };
    }

    case "string":
    case "email": {
      if (typeof value !== "string") return { valid: false, error: "Must be a string" };
      if (def.validation?.required && !value.trim()) {
        return { valid: false, error: "Required" };
      }
      if (def.validation?.pattern) {
        const re = new RegExp(def.validation.pattern);
        if (!re.test(value)) return { valid: false, error: "Invalid format" };
      }
      if (def.type === "email" && value.trim()) {
        if (!value.includes("@")) return { valid: false, error: "Invalid email" };
      }
      return { valid: true };
    }

    case "select": {
      if (typeof value !== "string") return { valid: false, error: "Must be a string" };
      if (def.validation?.options) {
        const valid = def.validation.options.some((opt) => opt.value === value);
        if (!valid) return { valid: false, error: "Invalid option" };
      }
      return { valid: true };
    }

    case "multi-select": {
      if (!Array.isArray(value)) return { valid: false, error: "Must be an array" };
      if (def.validation?.options) {
        const validValues = new Set(def.validation.options.map((o) => o.value));
        for (const item of value) {
          if (!validValues.has(String(item))) {
            return { valid: false, error: `Invalid option: ${item}` };
          }
        }
      }
      return { valid: true };
    }

    case "email-list": {
      if (!Array.isArray(value)) return { valid: false, error: "Must be an array" };
      for (const item of value) {
        if (typeof item !== "string" || !item.includes("@")) {
          return { valid: false, error: `Invalid email: ${item}` };
        }
      }
      return { valid: true };
    }

    case "color": {
      if (typeof value !== "string") return { valid: false, error: "Must be a string" };
      if (!/^#[0-9a-fA-F]{6}$/.test(value)) {
        return { valid: false, error: "Must be a hex color (e.g. #1E3A5F)" };
      }
      return { valid: true };
    }

    default:
      return { valid: true };
  }
}

export function validateSetting(key: string, value: unknown): ValidationResult {
  const def = getSettingDefinition(key);
  if (!def) return { valid: false, error: `Unknown setting: ${key}` };
  return validateValue(def, value);
}

export function validateSettings(
  settings: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  let valid = true;

  for (const [key, value] of Object.entries(settings)) {
    const result = validateSetting(key, value);
    if (!result.valid) {
      errors[key] = result.error ?? "Invalid";
      valid = false;
    }
  }

  return { valid, errors };
}
