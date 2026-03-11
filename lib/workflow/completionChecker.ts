import { getCategorySchema } from "@/data/categoryRegistry";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";
import type { CategoryKey } from "@/lib/entries/types";
import type { WorkflowConfig } from "./workflowConfig";

export type CompletionState = {
  stage1Complete: boolean;
  stage2Complete: boolean;
  allComplete: boolean;
  pdfExists: boolean;
  pdfFresh: boolean;
  stage1Total: number;
  stage1Filled: number;
  stage2Total: number;
  stage2Filled: number;
  total: number;
  filled: number;
  percent: number;
};

function isFieldFilled(entry: Record<string, unknown>, key: string, kind: string, upload?: boolean): boolean {
  const val = entry[key];
  if (val === null || val === undefined) return false;

  if (upload || kind === "object") {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      if ("url" in obj || "storedPath" in obj) return !!(obj.url || obj.storedPath);
      return Object.values(obj).some(v => !!v);
    }
    return false;
  }

  if (kind === "array") return Array.isArray(val) && val.length > 0;

  return String(val).trim() !== "";
}

export function computeCompletionState(
  entry: Record<string, unknown>,
  category: string,
  config: WorkflowConfig,
  isGenerated: boolean = false,
): CompletionState {
  const schema = getCategorySchema(category);

  const stage1Fields = schema.fields.filter(f => f.stage !== 2 && f.exportable !== false && f.required !== false);
  const stage2Fields = schema.fields.filter(f => f.stage === 2 && f.exportable !== false && f.required !== false);

  const stage1Filled = stage1Fields.filter(f => isFieldFilled(entry, f.key, f.kind, f.upload)).length;
  const stage1Complete = stage1Filled === stage1Fields.length;

  const stage2Filled = stage2Fields.filter(f => isFieldFilled(entry, f.key, f.kind, f.upload)).length;
  const stage2Complete = stage2Filled === stage2Fields.length;

  // Only count stage 2 toward total if entry is generated
  const total = stage1Fields.length + (isGenerated ? stage2Fields.length : 0);
  const filled = stage1Filled + (isGenerated ? stage2Filled : 0);

  const pdfExists = !!(entry.pdfGenerated || entry.pdfGeneratedAt || (entry.pdfMeta && typeof entry.pdfMeta === "object" && (entry.pdfMeta as Record<string, unknown>).url));

  const pdfFresh = pdfExists && entry.pdfStale !== true;

  const allComplete = config.completion.requireAllStage1 && !stage1Complete ? false
    : config.completion.requireAllStage2 && !stage2Complete ? false
    : config.completion.requireFreshPdf && !pdfFresh ? false
    : true;

  return {
    stage1Complete,
    stage2Complete,
    allComplete: stage1Complete && stage2Complete && pdfFresh,
    pdfExists,
    pdfFresh,
    stage1Total: stage1Fields.length,
    stage1Filled,
    stage2Total: stage2Fields.length,
    stage2Filled,
    total,
    filled,
    percent: total > 0 ? Math.round((filled / total) * 100) : 0,
  };
}

/**
 * Check if changes were made since edit was granted.
 */
export function hasChangesSinceGrant(
  entry: Record<string, unknown>,
  category: CategoryKey,
): boolean {
  const grantHash = entry.hashAtEditGrant;
  if (typeof grantHash !== "string" || !grantHash) return false;

  const currentHash = hashPrePdfFields(entry, category);
  return currentHash !== grantHash;
}
