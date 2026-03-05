"use client";

import { useCallback, useRef, useState } from "react";
import { getEntryApprovalStatus } from "@/lib/confirmation";
import type { CategoryKey } from "@/lib/entries/types";

type ConfirmableEntry = {
  id: string;
  confirmationStatus?: "DRAFT" | "PENDING_CONFIRMATION" | "APPROVED" | "REJECTED";
  requestEditStatus?: "none" | "pending" | "approved" | "rejected";
};

export function useEntryConfirmation<TEntry extends ConfirmableEntry>(args: {
  category: CategoryKey;
  setItems: React.Dispatch<React.SetStateAction<TEntry[]>>;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [sendingIds, setSendingIds] = useState<Record<string, boolean>>({});
  const sendingIdsRef = useRef<Record<string, boolean>>({});

  const sendForConfirmation = useCallback(
    async (entry: TEntry) => {
      if (!entry?.id) return;
      if (sendingIdsRef.current[entry.id]) return;
      const approvalStatus = getEntryApprovalStatus(entry);
      if (approvalStatus === "PENDING_CONFIRMATION" || approvalStatus === "APPROVED") return;

      sendingIdsRef.current = { ...sendingIdsRef.current, [entry.id]: true };
      setSendingIds(sendingIdsRef.current);

      try {
        const response = await fetch("/api/me/entry/confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryKey: args.category,
            entryId: entry.id,
          }),
        });
        const payload = (await response.json()) as TEntry | { error?: string };

        if (!response.ok) {
          throw new Error(("error" in payload && payload.error) || "Failed to send for confirmation.");
        }

        const updated = payload as TEntry;
        args.setItems((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        args.onSuccess?.("Sent for confirmation.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send for confirmation.";
        args.onError?.(message);
      } finally {
        const rest = { ...sendingIdsRef.current };
        delete rest[entry.id];
        sendingIdsRef.current = rest;
        setSendingIds(rest);
      }
    },
    [args]
  );

  return {
    sendingIds,
    sendForConfirmation,
  };
}
