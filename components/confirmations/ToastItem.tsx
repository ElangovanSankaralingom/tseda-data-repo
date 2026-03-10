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
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-600",
    border: "border-l-emerald-500",
    defaultDuration: 4000,
  },
  error: {
    Icon: XCircle,
    iconBg: "bg-red-100",
    iconColor: "text-red-600",
    border: "border-l-red-500",
    defaultDuration: 8000,
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    border: "border-l-amber-500",
    defaultDuration: 6000,
  },
  info: {
    Icon: Info,
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    border: "border-l-blue-500",
    defaultDuration: 4000,
  },
  loading: {
    Icon: Loader2,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    border: "border-l-slate-400",
    defaultDuration: 0,
  },
  undo: {
    Icon: RotateCcw,
    iconBg: "",
    iconColor: "text-white",
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
          ? "bg-slate-900 text-white"
          : "border border-slate-200 border-l-4 bg-white " + config.border
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
          <div className={`text-sm font-semibold ${isUndo ? "text-white" : "text-slate-900"}`}>
            {toast.title}
          </div>
          {toast.message && (
            <p className={`mt-0.5 text-xs ${isUndo ? "text-slate-300" : "text-slate-500"}`}>
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
                ? "bg-white text-slate-900 hover:bg-slate-100"
                : "text-slate-600 hover:bg-slate-100"
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
              isUndo ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-600"
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
              isUndo ? "bg-white/30" : toast.type === "success" ? "bg-emerald-500" : toast.type === "error" ? "bg-red-500" : toast.type === "warning" ? "bg-amber-500" : "bg-blue-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
