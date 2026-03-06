"use client";

import { useCallback } from "react";
import { useConfirmAction } from "@/hooks/useConfirmAction";

type ConfirmSubmitButtonProps = {
  formId: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  className: string;
  disabled?: boolean;
  children: React.ReactNode;
};

export default function ConfirmSubmitButton({
  formId,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  className,
  disabled = false,
  children,
}: ConfirmSubmitButtonProps) {
  const { requestConfirmation, confirmationDialog } = useConfirmAction();

  const submitForm = useCallback(() => {
    const form = document.getElementById(formId);
    if (form instanceof HTMLFormElement) {
      form.requestSubmit();
    }
  }, [formId]);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={className}
        onClick={() =>
          requestConfirmation({
            title,
            description,
            confirmLabel,
            cancelLabel,
            variant,
            onConfirm: submitForm,
          })
        }
      >
        {children}
      </button>
      {confirmationDialog}
    </>
  );
}
