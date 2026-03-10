"use client";

/**
 * Sub-hook: composes request-edit, request-delete, and confirmation actions.
 *
 * Provides a shared cross-action guard (`anyBusyRef`) so that only one
 * request action can be in flight per entry at a time. This prevents race
 * conditions where a user could trigger e.g. "Request Edit" and "Request
 * Delete" on the same entry before the first completes.
 */
import { useCallback, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import { useEntryConfirmation } from "@/hooks/useEntryConfirmation";
import { useRequestDelete } from "@/hooks/useRequestDelete";
import { useRequestEdit } from "@/hooks/useRequestEdit";
import type { CategoryKey } from "@/lib/entries/types";
import type { CategoryPageEntry, ToastState } from "@/hooks/controllerTypes";

type UseEntryRequestActionsOptions<TEntry extends CategoryPageEntry> = {
  category: CategoryKey;
  setList: Dispatch<SetStateAction<TEntry[]>>;
  showToast: (type: ToastState["type"], msg: string, durationMs?: number) => void;
  persistRequestEdit: (entry: TEntry) => Promise<TEntry>;
  persistCancelRequestEdit: (entry: TEntry) => Promise<TEntry>;
  persistRequestDelete: (entry: TEntry) => Promise<TEntry>;
  persistCancelRequestDelete: (entry: TEntry) => Promise<TEntry>;
};

export function useEntryRequestActions<TEntry extends CategoryPageEntry>(
  options: UseEntryRequestActionsOptions<TEntry>,
) {
  // Shared cross-action guard: only one request action per entry at a time.
  // The ref is set synchronously before each async operation so concurrent
  // clicks on different action types are blocked immediately.
  const anyBusyRef = useRef<Record<string, boolean>>({});

  const { requestingIds: requestingEditIds, requestEdit: rawRequestEdit, cancelRequestEdit: rawCancelRequestEdit } = useRequestEdit<TEntry>({
    setItems: options.setList,
    persistRequest: options.persistRequestEdit,
    persistCancel: options.persistCancelRequestEdit,
    onSuccess: (message) => options.showToast("ok", message, 1400),
    onError: (message) => options.showToast("err", message, 1800),
  });

  const { requestingIds: requestingDeleteIds, requestDelete: rawRequestDelete, cancelRequestDelete: rawCancelRequestDelete } = useRequestDelete<TEntry>({
    setItems: options.setList,
    persistRequest: options.persistRequestDelete,
    persistCancel: options.persistCancelRequestDelete,
    onSuccess: (message) => options.showToast("ok", message, 1400),
    onError: (message) => options.showToast("err", message, 1800),
  });

  const { sendingIds: sendingConfirmationIds, sendForConfirmation: rawSendForConfirmation } = useEntryConfirmation<TEntry>({
    category: options.category,
    setItems: options.setList,
    onSuccess: (message) => options.showToast("ok", message, 1400),
    onError: (message) => options.showToast("err", message, 1800),
  });

  // Wrap each action with the shared guard
  const withGuard = useCallback(
    (fn: (entry: TEntry) => Promise<void>) =>
      async (entry: TEntry) => {
        if (anyBusyRef.current[entry.id]) return;
        anyBusyRef.current = { ...anyBusyRef.current, [entry.id]: true };
        try {
          await fn(entry);
        } finally {
          const next = { ...anyBusyRef.current };
          delete next[entry.id];
          anyBusyRef.current = next;
        }
      },
    [],
  );

  const requestEdit = useCallback((entry: TEntry) => withGuard(rawRequestEdit)(entry), [withGuard, rawRequestEdit]);
  const cancelRequestEdit = useCallback((entry: TEntry) => withGuard(rawCancelRequestEdit)(entry), [withGuard, rawCancelRequestEdit]);
  const requestDelete = useCallback((entry: TEntry) => withGuard(rawRequestDelete)(entry), [withGuard, rawRequestDelete]);
  const cancelRequestDelete = useCallback((entry: TEntry) => withGuard(rawCancelRequestDelete)(entry), [withGuard, rawCancelRequestDelete]);
  const sendForConfirmation = useCallback((entry: TEntry) => withGuard(rawSendForConfirmation)(entry), [withGuard, rawSendForConfirmation]);

  // Merged reactive state for UI: true if any request action is in flight for that entry
  const requestInFlightIds = useMemo(() => {
    const merged: Record<string, boolean> = {};
    for (const [id, v] of Object.entries(requestingEditIds)) if (v) merged[id] = true;
    for (const [id, v] of Object.entries(requestingDeleteIds)) if (v) merged[id] = true;
    for (const [id, v] of Object.entries(sendingConfirmationIds)) if (v) merged[id] = true;
    return merged;
  }, [requestingEditIds, requestingDeleteIds, sendingConfirmationIds]);

  return {
    requestingEditIds,
    requestEdit,
    cancelRequestEdit,
    requestingDeleteIds,
    requestDelete,
    cancelRequestDelete,
    sendingConfirmationIds,
    sendForConfirmation,
    requestInFlightIds,
  };
}
