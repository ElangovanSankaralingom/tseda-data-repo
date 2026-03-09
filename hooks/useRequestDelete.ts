"use client";

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toUserMessage } from "@/lib/errors";
import { safeAction } from "@/lib/safeAction";

type RequestDeletableEntry = {
  id: string;
  confirmationStatus?: string | null;
};

type UseRequestDeleteOptions<TEntry extends RequestDeletableEntry> = {
  setItems: Dispatch<SetStateAction<TEntry[]>>;
  persistRequest: (entry: TEntry) => Promise<TEntry>;
  persistCancel: (entry: TEntry) => Promise<TEntry>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
};

export function useRequestDelete<TEntry extends RequestDeletableEntry>({
  setItems,
  persistRequest,
  persistCancel,
  onSuccess,
  onError,
}: UseRequestDeleteOptions<TEntry>) {
  const [requestingIds, setRequestingIds] = useState<Record<string, boolean>>({});
  const requestingIdsRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    requestingIdsRef.current = requestingIds;
  }, [requestingIds]);

  const requestDelete = useCallback(
    async (entry: TEntry) => {
      if (requestingIdsRef.current[entry.id]) return;

      const status = String(entry.confirmationStatus ?? "");
      if (status === "DELETE_REQUESTED") return;

      const optimisticEntry = {
        ...entry,
        confirmationStatus: "DELETE_REQUESTED" as const,
      };

      setRequestingIds((current) => ({ ...current, [entry.id]: true }));
      setItems((current) => current.map((item) => (item.id === entry.id ? optimisticEntry : item)));

      const result = await safeAction(() => persistRequest(entry), {
        context: "useRequestDelete.requestDelete",
      });

      try {
        if (!result.ok) {
          setItems((current) => current.map((item) => (item.id === entry.id ? entry : item)));
          onError?.(toUserMessage(result.error));
          return;
        }

        const persisted = result.data;
        setItems((current) => current.map((item) => (item.id === entry.id ? persisted : item)));
        onSuccess?.("Delete request sent.");
      } finally {
        setRequestingIds((current) => ({ ...current, [entry.id]: false }));
      }
    },
    [onError, onSuccess, persistRequest, setItems]
  );

  const cancelRequestDelete = useCallback(
    async (entry: TEntry) => {
      if (requestingIdsRef.current[entry.id]) return;

      const optimisticEntry = {
        ...entry,
        confirmationStatus: "GENERATED" as const,
      };

      setRequestingIds((current) => ({ ...current, [entry.id]: true }));
      setItems((current) => current.map((item) => (item.id === entry.id ? optimisticEntry : item)));

      const result = await safeAction(() => persistCancel(entry), {
        context: "useRequestDelete.cancelRequestDelete",
      });

      try {
        if (!result.ok) {
          setItems((current) => current.map((item) => (item.id === entry.id ? entry : item)));
          onError?.(toUserMessage(result.error));
          return;
        }

        const persisted = result.data;
        setItems((current) => current.map((item) => (item.id === entry.id ? persisted : item)));
        onSuccess?.("Delete request cancelled.");
      } finally {
        setRequestingIds((current) => ({ ...current, [entry.id]: false }));
      }
    },
    [onError, onSuccess, persistCancel, setItems]
  );

  return {
    requestingIds,
    requestDelete,
    cancelRequestDelete,
  };
}
