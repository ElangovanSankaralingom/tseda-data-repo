"use client";

import { useMemo } from "react";
import { getCategoryNavigation } from "@/lib/entryNavigation";

export function useEntryViewMode(categoryPath: string, viewEntryId?: string) {
  return useMemo(() => getCategoryNavigation(categoryPath, viewEntryId), [categoryPath, viewEntryId]);
}
