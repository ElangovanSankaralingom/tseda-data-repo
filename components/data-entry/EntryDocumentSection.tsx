"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Eye,
  FileText,
} from "lucide-react";
import PdfPreviewModal from "@/components/data-entry/PdfPreviewModal";

type PdfMeta = {
  url?: string | null;
  fileName?: string;
  generatedAtISO?: string;
} | null | undefined;

type EntryDocumentSectionProps = {
  pdfMeta: PdfMeta;
  pdfStale: boolean;
  canPreview: boolean;
  canDownload: boolean;
  onRegenerate: () => void;
  generating: boolean;
  isViewMode?: boolean;
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function EntryDocumentSection({
  pdfMeta,
  pdfStale,
  canPreview,
  canDownload,
  onRegenerate,
  generating,
  isViewMode = false,
}: EntryDocumentSectionProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasPdf = !!pdfMeta?.url;
  const pdfUrl = pdfMeta?.url ?? "";
  const pdfFileName = pdfMeta?.fileName ?? "entry.pdf";
  const generatedAt = pdfMeta?.generatedAtISO;

  // State 1: No PDF generated yet
  if (!hasPdf) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="size-5 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Entry Document</h3>
        </div>
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100">
            <FileText className="size-8 text-slate-300" />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-500">No document generated yet</p>
          <p className="mt-1 text-xs text-slate-400">
            Fill all required fields and click Generate Entry to create your PDF
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button type="button" disabled className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-400 opacity-50 cursor-not-allowed">
              <span className="flex items-center gap-1.5">
                <Eye className="size-4" />
                Preview
              </span>
            </button>
            <button type="button" disabled className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-medium text-slate-400 opacity-50 cursor-not-allowed">
              <span className="flex items-center gap-1.5">
                <Download className="size-4" />
                Download
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 2: PDF generated but stale (fields changed)
  if (pdfStale) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <FileText className="size-5 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-900">Entry Document</h3>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-500" />
            <span className="text-sm font-semibold text-amber-700">Document outdated</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Fields have been modified since the last generation. Regenerate to update.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-400 opacity-50 cursor-not-allowed"
              title="Regenerate first"
            >
              <span className="flex items-center gap-1.5">
                <Eye className="size-4" />
                Preview
              </span>
            </button>
            <button
              type="button"
              disabled
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white opacity-50 cursor-not-allowed"
              title="Regenerate first"
            >
              <span className="flex items-center gap-1.5">
                <Download className="size-4" />
                Download
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 3: PDF generated and up to date
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="size-5 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-900">Entry Document</h3>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-6">
        <div className="flex items-center gap-2">
          <CheckCircle className="size-5 text-emerald-500" />
          <span className="text-sm font-semibold text-emerald-700">Document ready</span>
        </div>
        {generatedAt && (
          <p className="mt-1 text-xs text-slate-500">Generated {formatRelativeTime(generatedAt)}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={!canPreview}
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center gap-1.5">
              <Eye className="size-4" />
              Preview
            </span>
          </button>
          <a
            href={canDownload ? pdfUrl : undefined}
            download={canDownload ? pdfFileName : undefined}
            className={`rounded-xl px-5 py-2.5 text-sm font-medium shadow-sm transition-colors ${
              canDownload
                ? "bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                : "bg-slate-900 text-white opacity-50 cursor-not-allowed pointer-events-none"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Download className="size-4" />
              Download
            </span>
          </a>
        </div>
      </div>

      {previewOpen && pdfUrl && (
        <PdfPreviewModal
          pdfUrl={pdfUrl}
          pdfFileName={pdfFileName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
