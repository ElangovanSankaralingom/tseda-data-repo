/**
 * Compute field completion progress for the editor UI.
 *
 * Uses the schema's requiredForCommit and immutableWhenPending lists to split
 * fields into pre-generate (core) and post-generate (uploads) phases, then
 * counts how many are filled in the current entry.
 */
import { getCategorySchema, type CategorySlug } from "@/data/categoryRegistry";

export type FieldProgress = {
  total: number;
  completed: number;
  percent: number;
  preGenerate: { total: number; completed: number };
  postGenerate: { total: number; completed: number };
  hasPhases: boolean;
};

function isFieldFilled(entry: Record<string, unknown>, key: string): boolean {
  const parts = key.split(".");
  let value: unknown = entry;
  for (const part of parts) {
    if (!value || typeof value !== "object") return false;
    value = (value as Record<string, unknown>)[part];
  }
  if (value === undefined || value === null) return false;
  if (typeof value === "string" && value.trim() === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function computeFieldProgress(
  category: CategorySlug,
  entry: Record<string, unknown> | null | undefined
): FieldProgress {
  if (!entry) {
    return { total: 0, completed: 0, percent: 0, preGenerate: { total: 0, completed: 0 }, postGenerate: { total: 0, completed: 0 }, hasPhases: false };
  }

  const schema = getCategorySchema(category);
  const requiredFields = schema.requiredForCommit ?? [];
  const immutableFields = new Set(schema.immutableWhenPending ?? []);

  const preGenerate = { total: 0, completed: 0 };
  const postGenerate = { total: 0, completed: 0 };

  for (const key of requiredFields) {
    const filled = isFieldFilled(entry, key);
    if (immutableFields.has(key)) {
      preGenerate.total++;
      if (filled) preGenerate.completed++;
    } else {
      postGenerate.total++;
      if (filled) postGenerate.completed++;
    }
  }

  const total = preGenerate.total + postGenerate.total;
  const completed = preGenerate.completed + postGenerate.completed;
  const hasPhases = preGenerate.total > 0 && postGenerate.total > 0;

  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    preGenerate,
    postGenerate,
    hasPhases,
  };
}
