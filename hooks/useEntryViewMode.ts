"use client";

import { useMemo } from "react";
import { getCategoryNavigation } from "@/lib/navigationStack";

export function useEntryViewMode(categoryPath: string, viewEntryId?: string) {
  return useMemo(() => getCategoryNavigation(categoryPath, viewEntryId), [categoryPath, viewEntryId]);
}
