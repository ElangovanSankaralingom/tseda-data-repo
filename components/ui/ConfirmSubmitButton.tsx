"use client";

import { useCallback } from "react";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  confirmLabel: confirmLabelProp,
  cancelLabel: cancelLabelProp,
  variant = "default",
  className,
  disabled = false,
  children,
}: ConfirmSubmitButtonProps) {
  const { t } = useTranslation();
  const confirmLabel = confirmLabelProp ?? t("common.confirm");
  const cancelLabel = cancelLabelProp ?? t("confirm.cancel");
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
