"use client";

import { useCallback, useState } from "react";
import type { CategoryKey } from "@/lib/entries/types";
import type { EntryStatus } from "@/lib/types/entry";
import type { RequestEditStatus } from "@/lib/types/requestEdit";

type ConfirmableEntry = {
  id: string;
  status?: string | null;
  confirmationStatus?: EntryStatus;
  requestEditStatus?: RequestEditStatus;
};

/**
 * In the new workflow, there is no "send for confirmation" action.
 * This hook is retained for backward compatibility but the send action is a no-op.
 * Entries auto-finalize based on their edit window expiry.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useEntryConfirmation<TEntry extends ConfirmableEntry>(args: {
  category: CategoryKey;
  setItems: React.Dispatch<React.SetStateAction<TEntry[]>>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [sendingIds] = useState<Record<string, boolean>>({});

  const sendForConfirmation = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async (_entry: TEntry) => {
      // No-op: entries auto-finalize in the new workflow
    },
    []
  );

  return {
    sendingIds,
    sendForConfirmation,
  };
}
