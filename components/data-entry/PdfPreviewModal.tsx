"use client";

import { useEffect } from "react";
import { Download, FileText, X } from "lucide-react";

export default function PdfPreviewModal({ pdfUrl, pdfFileName, onClose }: { pdfUrl: string; pdfFileName: string; onClose: () => void }) {
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[85vh] animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-900">Entry Preview</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-50 p-0">
          <iframe
            src={pdfUrl}
            className="h-full min-h-[600px] w-full border-0"
            title="PDF Preview"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <a
            href={pdfUrl}
            download={pdfFileName}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800"
          >
            <Download className="size-4" />
            Download PDF
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
