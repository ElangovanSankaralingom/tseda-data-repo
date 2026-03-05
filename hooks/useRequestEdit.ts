"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { nowISTTimestampISO } from "@/lib/gamification";
import type { RequestEditableEntry } from "@/lib/entries/types";
import { toUserMessage } from "@/lib/errors";
import { safeAction } from "@/lib/safeAction";

type UseRequestEditOptions<TEntry extends RequestEditableEntry> = {
  setItems: Dispatch<SetStateAction<TEntry[]>>;
  persistRequest: (entry: TEntry) => Promise<TEntry>;
  persistCancel: (entry: TEntry) => Promise<TEntry>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

export function useRequestEdit<TEntry extends RequestEditableEntry>({
  setItems,
  persistRequest,
  persistCancel,
  onSuccess,
  onError,
}: UseRequestEditOptions<TEntry>) {
  const [requestingIds, setRequestingIds] = useState<Record<string, boolean>>({});
  const requestingIdsRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    requestingIdsRef.current = requestingIds;
  }, [requestingIds]);

  const requestEdit = useCallback(
    async (entry: TEntry) => {
      if (requestingIdsRef.current[entry.id] || entry.requestEditStatus === "pending") {
        return;
      }

      const optimisticEntry = {
        ...entry,
        requestEditStatus: "pending" as const,
        requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? nowISTTimestampISO(),
      };

      setRequestingIds((current) => ({ ...current, [entry.id]: true }));
      setItems((current) => current.map((item) => (item.id === entry.id ? optimisticEntry : item)));

      const result = await safeAction(() => persistRequest(optimisticEntry), {
        context: "useRequestEdit.requestEdit",
      });

      try {
        if (!result.ok) {
          setItems((current) => current.map((item) => (item.id === entry.id ? entry : item)));
          onError?.(toUserMessage(result.error));
          return;
        }

        const persisted = result.data;
        setItems((current) => current.map((item) => (item.id === entry.id ? persisted : item)));
        onSuccess?.("Request sent.");
      } finally {
        setRequestingIds((current) => ({ ...current, [entry.id]: false }));
      }
    },
    [onError, onSuccess, persistRequest, setItems]
  );

  const cancelRequestEdit = useCallback(
    async (entry: TEntry) => {
      if (requestingIdsRef.current[entry.id]) {
        return;
      }

      const optimisticEntry = {
        ...entry,
        requestEditStatus: "none" as const,
        requestEditRequestedAtISO: null,
      };

      setRequestingIds((current) => ({ ...current, [entry.id]: true }));
      setItems((current) => current.map((item) => (item.id === entry.id ? optimisticEntry : item)));

      const result = await safeAction(() => persistCancel(entry), {
        context: "useRequestEdit.cancelRequestEdit",
      });

      try {
        if (!result.ok) {
          setItems((current) => current.map((item) => (item.id === entry.id ? entry : item)));
          onError?.(toUserMessage(result.error));
          return;
        }

        const persisted = result.data;
        setItems((current) => current.map((item) => (item.id === entry.id ? persisted : item)));
        onSuccess?.("Request cancelled.");
      } finally {
        setRequestingIds((current) => ({ ...current, [entry.id]: false }));
      }
    },
    [onError, onSuccess, persistCancel, setItems]
  );

  return {
    requestingIds,
    requestEdit,
    cancelRequestEdit,
  };
}
