"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import type { Toast, ToastType } from "@/lib/confirmations/types";

const TYPE_CONFIG: Record<
  ToastType,
  {
    Icon: typeof Info;
    iconBg: string;
    iconColor: string;
    border: string;
    defaultDuration: number;
  }
> = {
  success: {
    Icon: CheckCircle,
    iconBg: "bg-[var(--color-status-success-bg)]",
    iconColor: "text-[var(--color-status-success)]",
    border: "border-l-[var(--color-status-success)]",
    defaultDuration: 4000,
  },
  error: {
    Icon: XCircle,
    iconBg: "bg-[var(--color-status-error-bg)]",
    iconColor: "text-[var(--color-status-error)]",
    border: "border-l-[var(--color-status-error)]",
    defaultDuration: 8000,
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: "bg-[var(--color-status-warning-bg)]",
    iconColor: "text-[var(--color-status-warning)]",
    border: "border-l-[var(--color-status-warning)]",
    defaultDuration: 6000,
  },
  info: {
    Icon: Info,
    iconBg: "bg-[var(--color-status-info-bg)]",
    iconColor: "text-[var(--color-status-info)]",
    border: "border-l-[var(--color-status-info)]",
    defaultDuration: 4000,
  },
  loading: {
    Icon: Loader2,
    iconBg: "bg-[var(--color-dropdown-hover)]",
    iconColor: "text-[var(--color-text-secondary)]",
    border: "border-l-[var(--color-text-muted)]",
    defaultDuration: 0,
  },
  undo: {
    Icon: RotateCcw,
    iconBg: "",
    iconColor: "text-[var(--color-text-on-accent)]",
    border: "",
    defaultDuration: 8000,
  },
};

export default function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = TYPE_CONFIG[toast.type];
  const duration = toast.duration ?? config.defaultDuration;
  const [exiting, setExiting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const [startTimeInit] = useState(() => Date.now());
  const startTime = useRef(startTimeInit);
  const [remainingTimeInit] = useState(() => duration);
  const remainingTime = useRef(remainingTimeInit);
  const animFrame = useRef<number>(0);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 150);
  }, [onDismiss, toast.id]);

  // Auto-dismiss with countdown bar
  useEffect(() => {
    if (duration <= 0) return;

    function tick() {
      if (hovered) {
        startTime.current = Date.now();
        animFrame.current = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Date.now() - startTime.current;
      const remaining = remainingTime.current - elapsed;
      if (remaining <= 0) {
        dismiss();
        return;
      }
      setProgress((remaining / duration) * 100);
      animFrame.current = requestAnimationFrame(tick);
    }

    animFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame.current);
  }, [duration, hovered, dismiss]);

  // Pause tracking for hover
  useEffect(() => {
    if (hovered) {
      remainingTime.current -= Date.now() - startTime.current;
    } else {
      startTime.current = Date.now();
    }
  }, [hovered]);

  const Icon = config.Icon;
  const isUndo = toast.type === "undo";
  const dismissible = toast.dismissible !== false;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative overflow-hidden rounded-xl shadow-lg transition-all duration-200 ${
        exiting ? "translate-x-full opacity-0" : "translate-x-0 opacity-100"
      } ${
        isUndo
          ? "bg-[var(--color-button-primary-bg)] text-[var(--color-text-on-accent)]"
          : "border border-[var(--color-glass-border)] border-l-4 bg-[var(--color-toast-bg)] " + config.border
      }`}
      style={{ minWidth: 320, maxWidth: 440 }}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Icon */}
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
            isUndo ? "" : config.iconBg
          }`}
        >
          <Icon
            className={`size-4 ${config.iconColor} ${
              toast.type === "loading" ? "animate-spin" : ""
            }`}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold ${isUndo ? "text-[var(--color-text-on-accent)]" : "text-[var(--color-text-primary)]"}`}>
            {toast.title}
          </div>
          {toast.message && (
            <p className={`mt-0.5 text-xs ${isUndo ? "text-[var(--color-text-on-accent-muted)]" : "text-[var(--color-text-secondary)]"}`}>
              {toast.message}
            </p>
          )}
        </div>

        {/* Action button */}
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className={`shrink-0 rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
              isUndo
                ? "bg-[var(--color-glass-bg)] text-[var(--color-text-primary)] hover:bg-[var(--color-dropdown-hover)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-dropdown-hover)]"
            }`}
          >
            {toast.action.label}
          </button>
        )}

        {/* Dismiss */}
        {dismissible && (
          <button
            type="button"
            onClick={dismiss}
            className={`shrink-0 rounded p-0.5 transition-colors ${
              isUndo ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-accent)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Countdown bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5">
          <div
            className={`h-full transition-none ${
              isUndo ? "bg-[var(--color-surface-on-accent-strong)]" : toast.type === "success" ? "bg-[var(--color-status-success-bg)]" : toast.type === "error" ? "bg-[var(--color-status-error-bg)]" : toast.type === "warning" ? "bg-[var(--color-status-warning-bg)]" : "bg-[var(--color-status-info-bg)]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
