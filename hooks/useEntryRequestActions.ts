"use client";

/**
 * Sub-hook: composes request-edit, request-delete, and confirmation actions.
 */
import type { Dispatch, SetStateAction } from "react";
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
  const { requestingIds: requestingEditIds, requestEdit, cancelRequestEdit } = useRequestEdit<TEntry>({
    setItems: options.setList,
    persistRequest: options.persistRequestEdit,
    persistCancel: options.persistCancelRequestEdit,
    onSuccess: (message) => options.showToast("ok", message, 1400),
    onError: (message) => options.showToast("err", message, 1800),
  });

  const { requestingIds: requestingDeleteIds, requestDelete, cancelRequestDelete } = useRequestDelete<TEntry>({
    setItems: options.setList,
    persistRequest: options.persistRequestDelete,
    persistCancel: options.persistCancelRequestDelete,
    onSuccess: (message) => options.showToast("ok", message, 1400),
    onError: (message) => options.showToast("err", message, 1800),
  });

  const { sendingIds: sendingConfirmationIds, sendForConfirmation } = useEntryConfirmation<TEntry>({
    category: options.category,
    setItems: options.setList,
    onSuccess: (message) => options.showToast("ok", message, 1400),
    onError: (message) => options.showToast("err", message, 1800),
  });

  return {
    requestingEditIds,
    requestEdit,
    cancelRequestEdit,
    requestingDeleteIds,
    requestDelete,
    cancelRequestDelete,
    sendingConfirmationIds,
    sendForConfirmation,
  };
}
