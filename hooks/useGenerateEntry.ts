"use client";

import { useCallback } from "react";
import { generateEntrySnapshot } from "@/lib/entries/generate";
import type { CategoryKey } from "@/lib/entries/types";

export function useGenerateEntry<TEntry>(category: CategoryKey) {
  return useCallback(
    async (entryId: string) => generateEntrySnapshot<TEntry>(category, entryId),
    [category]
  );
}
