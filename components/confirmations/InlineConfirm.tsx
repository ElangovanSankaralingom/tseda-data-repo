"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Contextual confirmation strip that replaces a trigger button.
 * Auto-cancels after `autoCancel` milliseconds (default 5s).
 */
export default function InlineConfirm({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  autoCancel = 5000,
  variant = "danger",
}: {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  autoCancel?: number;
  variant?: "danger" | "warning";
}) {
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-cancel timer
  useEffect(() => {
    if (autoCancel <= 0) return;
    const timer = setTimeout(onCancel, autoCancel);
    return () => clearTimeout(timer);
  }, [autoCancel, onCancel]);

  const handleConfirm = useCallback(() => {
    onConfirm();
  }, [onConfirm]);

  const bgClass = variant === "danger" ? "bg-red-50" : "bg-amber-50";
  const textClass = variant === "danger" ? "text-red-700" : "text-amber-900";
  const btnClass =
    variant === "danger"
      ? "bg-red-500 text-white hover:bg-red-600"
      : "bg-amber-500 text-white hover:bg-amber-600";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all duration-200 ${bgClass} ${
        visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}
    >
      <span className={`text-xs ${textClass}`}>{message}</span>
      <button
        type="button"
        onClick={handleConfirm}
        className={`rounded px-2 py-1 text-xs font-medium transition-colors ${btnClass}`}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
