"use client";

import { useMemo } from "react";
import { computeWorkflowState, type WorkflowState } from "@/lib/workflow";
import { DEFAULT_WORKFLOW_CONFIG } from "@/lib/workflow/workflowConfig";
import type { CategoryKey } from "@/lib/entries/types";

// Client-side only: try to get workflow config. Since getCategorySchema is server-only,
// we use DEFAULT_WORKFLOW_CONFIG on the client and let the server be authoritative.
export function useWorkflowState(
  entry: Record<string, unknown> | null,
  category: CategoryKey,
  options?: { saving?: boolean; loading?: boolean; hasBusyUploads?: boolean; fieldsDirty?: boolean },
): WorkflowState | null {
  return useMemo(() => {
    if (!entry) return null;
    return computeWorkflowState(entry, category, DEFAULT_WORKFLOW_CONFIG, options);
  }, [entry, category, options]);
}
