"use client";

import { useEffect } from "react";
import { ActionButton } from "@/components/ui/ActionButton";

export type { ConfirmDialogVariant } from "@/lib/types/ui";
import type { ConfirmDialogVariant } from "@/lib/types/ui";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
  confirmClassName?: string;
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
  confirmClassName,
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
        {description ? (
          typeof description === "string" ? (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          ) : (
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          )
        ) : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <ActionButton
            role="context"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </ActionButton>
          {confirmClassName ? (
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={confirming}
              className={cx(
                "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border px-3 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
                confirming && "pointer-events-none opacity-60",
                confirmClassName,
              )}
            >
              {confirming ? "Please wait..." : confirmLabel}
            </button>
          ) : (
            <ActionButton
              role={variant === "destructive" ? "destructive" : "primary"}
              onClick={onConfirm}
              disabled={confirming}
              className={cx(variant === "default" && "font-medium")}
            >
              {confirming ? "Please wait..." : confirmLabel}
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
