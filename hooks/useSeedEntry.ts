"use client";

import { useEffect, useRef } from "react";

type UseSeedEntryOptions<T> = {
  loading: boolean;
  loadedEntry: T | null;
  loadedEntryId: string | null;
  editorSeedId: string | null | undefined;
  onSeed: (entry: T) => void;
};

export function useSeedEntry<T>({
  loading,
  loadedEntry,
  loadedEntryId,
  editorSeedId,
  onSeed,
}: UseSeedEntryOptions<T>) {
  const loadedEntryRef = useRef<T | null>(loadedEntry);
  const onSeedRef = useRef(onSeed);

  useEffect(() => {
    loadedEntryRef.current = loadedEntry;
    onSeedRef.current = onSeed;
  }, [loadedEntry, onSeed]);

  useEffect(() => {
    if (loading) return;
    if (!loadedEntryId) return;
    if (editorSeedId === loadedEntryId) return;

    const entry = loadedEntryRef.current;
    if (!entry) return;

    onSeedRef.current(entry);
  }, [editorSeedId, loadedEntryId, loading]);
}
