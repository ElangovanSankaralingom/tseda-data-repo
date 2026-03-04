"use client";

import { useCallback } from "react";
import { runGenerateEntryPipeline } from "@/lib/generateEntryPipeline";
import type { CategoryKey } from "@/lib/entries/types";

type EntryWithId = { id?: string | null };

export function useGenerateEntry<TEntry extends EntryWithId>(args: {
  category: CategoryKey;
  email?: string;
  hydrateEntry: (entry: TEntry) => TEntry;
}) {
  return useCallback(
    async (draftEntry: TEntry, persistDraft: (entry: TEntry) => Promise<TEntry>) => {
      return runGenerateEntryPipeline<TEntry>({
        category: args.category,
        email: args.email,
        draftEntry,
        persistDraft,
        hydrateEntry: args.hydrateEntry,
      });
    },
    [args.category, args.email, args.hydrateEntry]
  );
}
