"use client";

import { useCallback } from "react";
import { generateEntrySnapshot } from "@/lib/entries/generate";
import type { CategoryKey } from "@/lib/entries/types";

export function useGenerateEntry<TEntry>(category: CategoryKey) {
  return useCallback(
    async (entryId: string) => {
      const persistedEntryId = String(entryId ?? "").trim();

      if (!persistedEntryId) {
        throw new Error("Could not generate the entry because it was not saved yet.");
      }

      return generateEntrySnapshot<TEntry>(category, persistedEntryId);
    },
    [category]
  );
}
