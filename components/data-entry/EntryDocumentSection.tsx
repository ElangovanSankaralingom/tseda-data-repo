"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Eye,
} from "lucide-react";
import PdfPreviewModal from "@/components/data-entry/PdfPreviewModal";
import { type EntryDocumentSectionProps } from "./dataEntryTypes";

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  isViewMode = false,
}: EntryDocumentSectionProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasPdf = !!pdfMeta?.url;
  const pdfUrl = pdfMeta?.url ?? "";
  const pdfFileName = pdfMeta?.fileName ?? "entry.pdf";
  const generatedAt = pdfMeta?.generatedAtISO;

  // No PDF: don't render anything
  if (!hasPdf) return null;

  // PDF stale: compact amber bar
  if (pdfStale) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
        <AlertTriangle className="size-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-sm text-amber-700">
          Document outdated — fields changed since last generation
        </span>
      </div>
    );
  }

  // PDF ready: compact emerald bar
  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5">
        <CheckCircle className="size-4 shrink-0 text-emerald-500" />
        <span className="flex-1 text-sm text-emerald-700">
          Document ready{generatedAt ? ` · Generated ${formatRelativeTime(generatedAt)}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!canPreview}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="size-3.5" />
          Preview
        </button>
        <a
          href={canDownload ? pdfUrl : undefined}
          download={canDownload ? pdfFileName : undefined}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            canDownload
              ? "text-emerald-700 hover:bg-emerald-100 cursor-pointer"
              : "text-emerald-700 opacity-50 cursor-not-allowed pointer-events-none"
          }`}
        >
          <Download className="size-3.5" />
          Download
        </a>
      </div>

      {previewOpen && pdfUrl && (
        <PdfPreviewModal
          pdfUrl={pdfUrl}
          pdfFileName={pdfFileName}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
