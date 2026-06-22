"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UiToast } from "@/lib/ui/notify";

export default function Toast({ toast, position = "inline", className, onDismiss }: { toast: UiToast | null | undefined; position?: "fixed" | "inline"; className?: string; onDismiss?: () => void }) {
  if (!toast) return null;

  const isError = toast.type === "err";
  const colors = isError
    ? "border-[var(--color-status-error-border)] bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]"
    : "border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 text-[var(--color-primary-light)]";
  const ariaRole = isError ? "alert" : "status";
  const ariaLive = isError ? "assertive" as const : "polite" as const;

  const dismissButton = onDismiss ? (
    <button
      type="button"
      onClick={onDismiss}
      className="ml-2 shrink-0 rounded p-0.5 text-current opacity-60 transition-opacity hover:opacity-100"
      aria-label="Dismiss"
    >
      <X className="size-3.5" />
    </button>
  ) : null;

  if (position === "fixed") {
    return (
      <div className="fixed right-4 top-20 z-50 animate-slide-in-right" role={ariaRole} aria-live={ariaLive}>
        <div className={cn("flex items-center gap-2 rounded-xl border backdrop-blur-xl px-3 py-2 text-sm shadow-lg", colors, className)}>
          <span className="flex-1">{toast.msg}</span>
          {dismissButton}
        </div>
      </div>
    );
  }

  return (
    <div
      role={ariaRole}
      aria-live={ariaLive}
      className={cn("flex items-center gap-2 rounded-xl border backdrop-blur-xl px-4 py-3 text-sm", colors, className)}
    >
      <span className="flex-1">{toast.msg}</span>
      {dismissButton}
    </div>
  );
}
