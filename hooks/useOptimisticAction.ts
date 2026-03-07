"use client";

import { useCallback } from "react";
import { useConfirmation } from "@/components/confirmations/ConfirmationProvider";

/**
 * Hook for optimistic updates with undo support.
 *
 * Pattern:
 * 1. Execute optimistic UI change immediately
 * 2. Show undo toast
 * 3. If user clicks "Undo" — reverse the UI change, skip server call
 * 4. If undo window expires — execute server action
 */
export function useOptimisticAction() {
  const { undoable } = useConfirmation();

  const execute = useCallback(
    ({
      optimisticUpdate,
      serverAction,
      undoUpdate,
      description,
      timeout,
    }: {
      optimisticUpdate: () => void;
      serverAction: () => Promise<void>;
      undoUpdate: () => void;
      description: string;
      timeout?: number;
    }) => {
      // Apply optimistic UI change immediately
      optimisticUpdate();

      // Show undo toast — server action runs only if undo expires
      undoable(
        description,
        serverAction,
        async () => {
          undoUpdate();
        },
        timeout,
      );
    },
    [undoable],
  );

  return { execute };
}
