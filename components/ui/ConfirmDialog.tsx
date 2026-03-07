"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/ui/ActionButton";

type ConfirmDialogVariant = "default" | "destructive";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  confirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (confirming) return;
      event.preventDefault();
      onCancel();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [confirming, onCancel, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close confirmation dialog"
        onClick={confirming ? undefined : onCancel}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-2 text-sm text-muted-foreground">{description}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <ActionButton
            role="context"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </ActionButton>
          <ActionButton
            role={variant === "destructive" ? "destructive" : "primary"}
            onClick={onConfirm}
            disabled={confirming}
            className={cx(variant === "default" && "font-medium")}
          >
            {confirming ? "Please wait..." : confirmLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
