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

  // Arrays (including multi-upload fields) — check length
  if (kind === "array") return Array.isArray(val) && val.length > 0;

  // Single object uploads or object fields
  if (upload || kind === "object") {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      if ("url" in obj || "storedPath" in obj) return !!(obj.url || obj.storedPath);
      return Object.values(obj).some(v => !!v);
    }
    return false;
  }

  return String(val).trim() !== "";
}

export function computeCompletionState(
  entry: Record<string, unknown>,
  category: string,
  config: WorkflowConfig,
  isGenerated: boolean = false,
): CompletionState {
  const schema = getCategorySchema(category);

  /* S1 (TECH-AUDIT-2026-06 C4): stage-1 completeness — which drives the
     nightly auto-DELETE verdict — must use the schema's EXPLICIT
     `requiredForCommit` allowlist, the same gate generation uses. The old
     `required !== false` default treated every newly-added field as
     required, so adding a stage-1 field would retroactively mark every
     existing (already-generated) entry incomplete → auto-deleted. Anchoring
     to the explicit list makes the delete criterion drift-proof: if an entry
     could be generated, a later schema addition can never make it deletable
     on stage-1 grounds. */
  const commitKeys = schema.requiredForCommit;
  const stage1Fields = (commitKeys && commitKeys.length > 0)
    // Intersect the explicit allowlist with `required !== false` so
    // conditionally-required fields (e.g. funding, gated on sponsored=Yes and
    // enforced by validate()) stay excluded from the unconditional check.
    ? schema.fields.filter(f => f.stage !== 2 && commitKeys.includes(f.key) && f.required !== false)
    : schema.fields.filter(f => f.stage !== 2 && f.exportable !== false && f.required !== false);
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
    allComplete,
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
