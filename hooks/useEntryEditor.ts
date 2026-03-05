"use client";

import { useCallback, useMemo, useState, type SetStateAction } from "react";
import { createDirtySnapshot, isDirtySnapshot } from "@/lib/entries/dirty";
import {
  computePdfState,
  hashPrePdfFields,
  hydratePdfSnapshot,
  type PdfSnapshotCategory,
} from "@/lib/pdfSnapshot";

type EntryEditorLike = {
  pdfMeta?: { url?: string | null; storedPath?: string | null } | null;
  pdfSourceHash?: string | null;
  pdfStale?: boolean;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string | null;
  streak?: unknown;
  requestEditStatus?: string | null;
};

type UseEntryEditorOptions<T extends EntryEditorLike> = {
  initialEntry: T;
  category: PdfSnapshotCategory;
  validatePrePdfFields: (draft: T) => boolean;
};

export function useEntryEditor<T extends EntryEditorLike>({
  initialEntry,
  category,
  validatePrePdfFields,
}: UseEntryEditorOptions<T>) {
  const syncPdfDraftState = useCallback(
    (entry: T) => {
      if (!entry.pdfMeta?.url || !entry.pdfMeta?.storedPath) {
        return entry.pdfStale ? ({ ...entry, pdfStale: false } as T) : entry;
      }

      const nextHash = hashPrePdfFields(entry, category);
      if (!entry.pdfSourceHash) {
        return {
          ...entry,
          pdfSourceHash: nextHash,
          pdfStale: false,
        } as T;
      }

      const nextStale = nextHash !== entry.pdfSourceHash;
      return entry.pdfStale === nextStale ? entry : ({ ...entry, pdfStale: nextStale } as T);
    },
    [category]
  );
  const [draftState, setDraftState] = useState<T>(() => hydratePdfSnapshot(initialEntry, category));
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    createDirtySnapshot(hydratePdfSnapshot(initialEntry, category))
  );
  const setDraft = useCallback(
    (value: SetStateAction<T>) => {
      setDraftState((current) => {
        const nextValue = typeof value === "function" ? (value as (previous: T) => T)(current) : value;
        return syncPdfDraftState(nextValue);
      });
    },
    [syncPdfDraftState]
  );
  const draft = draftState;

  const currentHash = useMemo(() => hashPrePdfFields(draft, category), [category, draft]);
  const lockState = useMemo(
    () => ({
      isLocked: false,
      expiresAtISO: null,
      daysRemaining: 0,
    }),
    []
  );
  const fieldsGateOk = useMemo(() => validatePrePdfFields(draft), [draft, validatePrePdfFields]);

  const pdfState = useMemo(
    () =>
      computePdfState({
        pdfMeta: draft.pdfMeta ?? null,
        pdfSourceHash: draft.pdfSourceHash ?? "",
        draftHash: currentHash,
        fieldsGateOk,
      }),
    [currentHash, draft.pdfMeta, draft.pdfSourceHash, fieldsGateOk]
  );

  const dirty = useMemo(() => isDirtySnapshot(draft, lastSavedSnapshot), [draft, lastSavedSnapshot]);

  const loadEntry = useCallback(
    (nextEntry: T) => {
      const hydratedEntry = syncPdfDraftState(hydratePdfSnapshot(nextEntry, category));
      setDraftState(hydratedEntry);
      setLastSavedSnapshot(createDirtySnapshot(hydratedEntry));
      return hydratedEntry;
    },
    [category, syncPdfDraftState]
  );

  const markSaved = useCallback(
    (nextEntry: T) => {
      return loadEntry(nextEntry);
    },
    [loadEntry]
  );

  const actions = useMemo(
    () => ({
      loadEntry,
      saveDraft: markSaved,
      generatePdf: markSaved,
      finalizeDone: markSaved,
      enterViewMode: loadEntry,
    }),
    [loadEntry, markSaved]
  );

  return {
    draft,
    setDraft,
    dirty,
    lockState,
    pdfState,
    currentHash,
    fieldsGateOk,
    actions,
  };
}
