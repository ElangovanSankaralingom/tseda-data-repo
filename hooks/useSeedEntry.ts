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
  const lastSeededIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadedEntryRef.current = loadedEntry;
  }, [loadedEntry]);

  useEffect(() => {
    onSeedRef.current = onSeed;
  }, [onSeed]);

  useEffect(() => {
    if (!loadedEntryId) {
      lastSeededIdRef.current = null;
      return;
    }
    if (loading) return;
    if (!loadedEntryId) return;
    if (editorSeedId === loadedEntryId) return;
    if (lastSeededIdRef.current === loadedEntryId) return;

    const entry = loadedEntryRef.current;
    if (!entry) return;

    lastSeededIdRef.current = loadedEntryId;
    onSeedRef.current(entry);
  }, [editorSeedId, loadedEntryId, loading]);
}
