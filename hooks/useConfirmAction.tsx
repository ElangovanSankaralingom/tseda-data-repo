"use client";

import { useCallback, useMemo, useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { ConfirmDialogVariant } from "@/lib/types/ui";
import { trackClientTelemetryEvent } from "@/lib/telemetry/client";

export type ConfirmActionRequest = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  onConfirm: () => void | Promise<void>;
};

type UseConfirmActionResult = {
  requestConfirmation: (request: ConfirmActionRequest) => void;
  confirmationDialog: React.ReactNode;
  confirming: boolean;
};

export function useConfirmAction(): UseConfirmActionResult {
  const [request, setRequest] = useState<ConfirmActionRequest | null>(null);
  const [confirming, setConfirming] = useState(false);

  const requestConfirmation = useCallback((nextRequest: ConfirmActionRequest) => {
    void trackClientTelemetryEvent({
      event: "confirmation.dialog_opened",
      success: true,
      meta: {
        action: "confirmation.dialog_opened",
        title: nextRequest.title.slice(0, 120),
      },
    });
    setRequest(nextRequest);
  }, []);

  const handleCancel = useCallback(() => {
    if (confirming) return;
    setRequest(null);
  }, [confirming]);

  const handleConfirm = useCallback(async () => {
    if (!request) return;
    setConfirming(true);
    try {
      await request.onConfirm();
      setRequest(null);
    } finally {
      setConfirming(false);
    }
  }, [request]);

  const confirmationDialog = useMemo(
    () => (
      <ConfirmDialog
        open={!!request}
        title={request?.title ?? "Are you sure?"}
        description={request?.description}
        confirmLabel={request?.confirmLabel}
        cancelLabel={request?.cancelLabel}
        variant={request?.variant ?? "default"}
        confirming={confirming}
        onCancel={handleCancel}
        onConfirm={() => void handleConfirm()}
      />
    ),
    [confirming, handleCancel, handleConfirm, request]
  );

  return {
    requestConfirmation,
    confirmationDialog,
    confirming,
  };
}
