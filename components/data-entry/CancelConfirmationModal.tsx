"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Save, Trash2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

type CancelConfirmationModalProps = {
  open: boolean;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onClose: () => void;
  saving?: boolean;
};

export default function CancelConfirmationModal({
  open,
  onSaveDraft,
  onDiscard,
  onClose,
  saving = false,
}: CancelConfirmationModalProps) {
  const { t } = useTranslation();
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center animate-backdrop-in"
      style={{ background: "var(--color-modal-overlay)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm mx-4 overflow-hidden rounded-2xl animate-in fade-in zoom-in-95"
        style={{
          background: "var(--color-modal-bg)",
          border: "1px solid var(--color-border-default)",
          boxShadow: "0 12px 32px -12px rgba(20,30,70,0.20), 0 0 0 1px var(--color-border-subtle)",
        }}
      >
        {/* Top accent */}
        <div
          className="h-[2px]"
          style={{ background: "linear-gradient(90deg, var(--color-primary), #3b82f6, var(--color-primary))" }}
        />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-lg transition-colors cursor-pointer"
          style={{ color: "var(--color-text-tertiary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-surface-raised)";
            e.currentTarget.style.color = "var(--color-text-secondary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--color-text-tertiary)";
          }}
          aria-label={t('confirm.cancel')}
        >
          <X className="size-4" />
        </button>

        {/* Content */}
        <div className="px-6 pt-6 pb-2">
          <h3
            className="text-base font-bold"
            style={{ color: "var(--color-text-primary)" }}
          >
            {t('entry.unsavedChangesTitle')}
          </h3>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {t('entry.unsavedChangesDesc')}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 p-4">
          {/* Save Draft & Exit */}
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--color-button-primary-bg)",
              color: "var(--color-button-primary-text)",
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <Save className="size-4" />
            {saving ? t('entry.saving') : t('entry.saveDraftExit')}
          </button>

          {/* Discard Changes */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: "var(--color-status-error-bg)",
              color: "var(--color-status-error)",
              border: "1px solid var(--color-status-error-border)",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.background = "var(--color-status-error-border)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--color-status-error-bg)";
            }}
          >
            <Trash2 className="size-4" />
            {t('entry.discardChanges')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
