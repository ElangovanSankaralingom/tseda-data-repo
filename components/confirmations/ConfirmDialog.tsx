"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Info,
} from "lucide-react";
import type { ConfirmationDialogOptions, ConfirmationType } from "@/lib/confirmations/types";
import { useTranslation } from "@/lib/i18n/useTranslation";

const TYPE_CONFIG: Record<
  ConfirmationType,
  {
    Icon: typeof Info;
    iconBg: string;
    iconColor: string;
    accent?: string;
  }
> = {
  info: {
    Icon: Info,
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-600",
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-600",
    accent: "border-l-4 border-l-amber-500",
  },
  danger: {
    Icon: AlertOctagon,
    iconBg: "bg-red-500/15",
    iconColor: "text-red-400",
    accent: "border-l-4 border-l-red-500",
  },
  success: {
    Icon: CheckCircle,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-600",
  },
};

const CONFIRM_STYLE: Record<string, string> = {
  primary: "bg-[var(--color-button-primary-bg)] text-[var(--color-text-on-accent)] hover:bg-[var(--color-button-primary-hover)]",
  danger: "bg-red-500/15 text-[var(--color-status-error)] hover:bg-red-600 hover:text-[var(--color-text-on-accent)]",
  warning: "bg-amber-500/15 text-[var(--color-status-warning)] hover:bg-amber-600 hover:text-[var(--color-text-on-accent)]",
};

export default function ConfirmDialog({ options, onResult }: { options: ConfirmationDialogOptions; onResult: (confirmed: boolean) => void }) {
  const { t } = useTranslation();
  const {
    type,
    title,
    message,
    details,
    confirmLabel,
    cancelLabel: cancelLabelProp,
    confirmStyle,
    requireTypedConfirmation,
    countdown,
    preventOutsideClose,
  } = options;
  const cancelLabel = cancelLabelProp ?? t("confirm.cancel");

  const [typedText, setTypedText] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState(countdown ?? 0);
  const [animateIn, setAnimateIn] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const config = TYPE_CONFIG[type];
  const Icon = config.Icon;

  // Entrance animation
  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!countdown || countdown <= 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountdownLeft(countdown);
    const interval = setInterval(() => {
      setCountdownLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Focus management — auto-focus cancel for danger, confirm otherwise
  useEffect(() => {
    const target = type === "danger" ? cancelRef.current : confirmRef.current;
    target?.focus();
  }, [type]);

  // Keyboard: Escape to cancel, Enter to confirm (if no typed confirmation)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onResult(false);
      }
      if (e.key === "Enter" && !requireTypedConfirmation && countdownLeft <= 0) {
        e.preventDefault();
        onResult(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onResult, requireTypedConfirmation, countdownLeft]);

  // Focus trap
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const typedMatch = !requireTypedConfirmation || typedText === requireTypedConfirmation;
  const canConfirm = typedMatch && countdownLeft <= 0;

  const handleOverlayClick = useCallback(() => {
    if (preventOutsideClose || type === "danger") return;
    onResult(false);
  }, [onResult, preventOutsideClose, type]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-[var(--color-modal-overlay)] backdrop-blur-sm transition-opacity duration-150 ${
          animateIn ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleOverlayClick}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative z-10 w-full max-w-md overflow-y-auto max-h-[90vh] rounded-2xl border border-[var(--color-glass-border)] bg-[var(--color-modal-bg)] shadow-2xl transition-all duration-200 ${
          config.accent ?? ""
        } ${animateIn ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      >
        {/* Body */}
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div
              className={`flex size-12 items-center justify-center rounded-full ${config.iconBg} ${
                type === "danger" ? "animate-dialog-shake" : ""
              }`}
            >
              <Icon className={`size-6 ${config.iconColor}`} />
            </div>
          </div>

          {/* Title + Message */}
          <h2 className="text-center text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
          <p className="mt-2 text-center text-sm text-[var(--color-text-secondary)]">{message}</p>

          {/* Expandable details */}
          {details && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors mx-auto"
              >
                <ChevronDown
                  className={`size-3.5 transition-transform duration-200 ${showDetails ? "rotate-180" : ""}`}
                />
                {showDetails ? t("confirm2.hideDetails") : t("confirm2.showDetails")}
              </button>
              {showDetails && (
                <div className="mt-2 rounded-lg bg-[var(--color-body-bg)] p-3 text-xs text-[var(--color-text-primary)] animate-fade-in">
                  {details}
                </div>
              )}
            </div>
          )}

          {/* Typed confirmation */}
          {requireTypedConfirmation && (
            <div className="mt-4">
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">
                Type <span className="font-mono font-semibold text-red-400">{requireTypedConfirmation}</span> to
                confirm
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                placeholder={requireTypedConfirmation}
                className="w-full rounded-lg border border-red-500/20 bg-[var(--color-input-bg)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--color-text-secondary)] focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 border-t border-[var(--color-glass-border)] px-6 py-4">
          {type !== "success" && (
            <button
              ref={cancelRef}
              type="button"
              onClick={() => onResult(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)]"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onResult(true)}
            disabled={!canConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              CONFIRM_STYLE[confirmStyle] ?? CONFIRM_STYLE.primary
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {countdownLeft > 0 ? `${confirmLabel} (${countdownLeft}s)` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
