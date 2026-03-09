"use client";

import { cn } from "@/lib/utils";
import type { UiToast } from "@/lib/ui/notify";

export default function Toast({ toast, position = "inline", className }: { toast: UiToast | null | undefined; position?: "fixed" | "inline"; className?: string }) {
  if (!toast) return null;

  const colors =
    toast.type === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-red-200 bg-red-50 text-red-800";

  if (position === "fixed") {
    return (
      <div className="fixed right-4 top-20 z-50" role="status" aria-live="polite">
        <div className={cn("rounded-xl border px-3 py-2 text-sm shadow-sm", colors, className)}>
          {toast.msg}
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("rounded-xl border px-4 py-3 text-sm", colors, className)}
    >
      {toast.msg}
    </div>
  );
}
