"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ToastState } from "@/lib/types/ui";

type SaveIntent = "save" | "done";

type SaveDraftChangesOptions = {
  closeAfterSave?: boolean;
  intent?: SaveIntent;
  source?: "manual" | "autosave";
  throwOnError?: boolean;
};

type UseEntryPrimaryActionsOptions = {
  defaultCancelTargetHref: string;
  hasBusyUploads: boolean;
  confirmNavigate: () => Promise<boolean>;
  closeForm: (targetHref?: string) => void | Promise<void>;
  saveDraftChanges: (options?: SaveDraftChangesOptions) => Promise<unknown>;
  setToast: Dispatch<SetStateAction<ToastState | null>>;
  setSubmitAttemptedFinal?: Dispatch<SetStateAction<boolean>>;
  cancelBusyMessage?: string;
  saveAndCloseBusyMessage?: string;
  busyToastMs?: number;
};

export function useEntryPrimaryActions({
  defaultCancelTargetHref,
  hasBusyUploads,
  confirmNavigate,
  closeForm,
  saveDraftChanges,
  setToast,
  setSubmitAttemptedFinal,
  cancelBusyMessage = "Please wait for upload to finish.",
  saveAndCloseBusyMessage = "Please wait for upload to finish.",
  busyToastMs = 1800,
}: UseEntryPrimaryActionsOptions) {
  const showBusyToast = useCallback(
    (message: string) => {
      setToast({ type: "err", msg: message });
      setTimeout(() => setToast(null), busyToastMs);
    },
    [busyToastMs, setToast]
  );

  const handleCancel = useCallback(
    async (targetHref = defaultCancelTargetHref) => {
      if (hasBusyUploads) {
        showBusyToast(cancelBusyMessage);
        return;
      }

      const canLeave = await confirmNavigate();
      if (!canLeave) return;
      await closeForm(targetHref);
    },
    [cancelBusyMessage, closeForm, confirmNavigate, defaultCancelTargetHref, hasBusyUploads, showBusyToast]
  );

  const handleSaveDraft = useCallback(async () => {
    await saveDraftChanges({ intent: "save" });
  }, [saveDraftChanges]);

  const handleSaveAndClose = useCallback(async () => {
    setSubmitAttemptedFinal?.(true);

    if (hasBusyUploads) {
      showBusyToast(saveAndCloseBusyMessage);
      return;
    }

    await saveDraftChanges({ closeAfterSave: true, intent: "done" });
  }, [hasBusyUploads, saveAndCloseBusyMessage, saveDraftChanges, setSubmitAttemptedFinal, showBusyToast]);

  return {
    handleCancel,
    handleSaveDraft,
    handleSaveAndClose,
  };
}
