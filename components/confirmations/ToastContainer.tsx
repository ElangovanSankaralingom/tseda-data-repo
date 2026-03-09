"use client";

import type { Toast } from "@/lib/confirmations/types";
import ToastItem from "./ToastItem";

export default function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2 max-sm:left-4 max-sm:right-4"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
