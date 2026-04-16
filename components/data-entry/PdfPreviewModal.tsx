"use client";

import { useEffect } from "react";
import { Download, FileText, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function PdfPreviewModal({ pdfUrl, pdfFileName, onClose }: { pdfUrl: string; pdfFileName: string; onClose: () => void }) {
  const { t } = useTranslation();
  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-modal-overlay)] backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--color-modal-bg)] shadow-2xl max-h-[85vh] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-glass-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-[var(--color-text-secondary)]" />
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t('entry.entryPreview')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-dropdown-hover)] hover:text-[var(--color-text-primary)]"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-[var(--color-body-bg)] p-0">
          <iframe
            src={pdfUrl}
            className="h-full min-h-[600px] w-full border-0"
            title="PDF Preview"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-glass-border)] px-6 py-4">
          <a
            href={pdfUrl}
            download={pdfFileName}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-button-primary-bg)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-button-primary-hover)]"
          >
            <Download className="size-4" />
            {t('entry.downloadPdf')}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--color-input-border)] bg-[var(--color-glass-bg)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-dropdown-hover)]"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
