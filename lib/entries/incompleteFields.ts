/**
 * Compute which required fields are still missing for each stage.
 * Returns field keys and their schema labels so the UI can show
 * clickable "missing field" pills and scroll to them.
 */
import { getCategorySchema, type CategorySlug } from "@/data/categoryRegistry";

export type IncompleteField = {
  key: string;
  label: string;
  stage: 1 | 2;
};

function isFieldFilled(entry: Record<string, unknown>, key: string, kind: string): boolean {
  const val = entry[key];
  if (val === null || val === undefined) return false;
  if (kind === "array") return Array.isArray(val) && val.length > 0;
  if (kind === "object") {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      if ("url" in obj || "storedPath" in obj) return !!(obj.url || obj.storedPath);
      return Object.values(obj).some(v => !!v);
    }
    return false;
  }
  return String(val).trim() !== "";
}

export function getIncompleteFields(
  category: CategorySlug,
  entry: Record<string, unknown> | null | undefined,
  isGenerated: boolean,
): { stage1: IncompleteField[]; stage2: IncompleteField[] } {
  if (!entry) return { stage1: [], stage2: [] };

  const schema = getCategorySchema(category);
  const requiredForCommit = new Set(schema.requiredForCommit ?? []);

  const stage1: IncompleteField[] = [];
  const stage2: IncompleteField[] = [];

  for (const field of schema.fields) {
    // Skip non-exportable / metadata
    if (field.exportable === false) continue;

    if (field.stage === 2) {
      // Stage 2 only matters after generate
      if (!isGenerated) continue;
      if (field.required === false) continue;
      if (!isFieldFilled(entry, field.key, field.kind)) {
        stage2.push({ key: field.key, label: field.label, stage: 2 });
      }
    } else {
      // Stage 1: only required-for-commit fields
      if (!requiredForCommit.has(field.key)) continue;
      if (!isFieldFilled(entry, field.key, field.kind)) {
        stage1.push({ key: field.key, label: field.label, stage: 1 });
      }
    }
  }

  return { stage1, stage2 };
}

/**
 * Scroll to a field by its `data-field-key` attribute.
 * Used by the completion tracker to jump to missing fields.
 */
export function scrollToField(fieldKey: string): void {
  const el = document.querySelector(`[data-field-key="${fieldKey}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // Flash highlight
  el.classList.add("ring-2", "ring-[var(--color-primary)]", "ring-offset-2", "rounded-lg");
  setTimeout(() => {
    el.classList.remove("ring-2", "ring-[var(--color-primary)]", "ring-offset-2", "rounded-lg");
  }, 2000);
}
