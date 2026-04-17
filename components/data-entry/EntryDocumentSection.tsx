"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Download,
  Eye,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
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
  isViewMode = false,
  permanentlyLocked = false,
}: EntryDocumentSectionProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const { t } = useTranslation();
  const hasPdf = !!pdfMeta?.url;
  const pdfUrl = pdfMeta?.url ?? "";
  const pdfFileName = pdfMeta?.fileName ?? "entry.pdf";
  const generatedAt = pdfMeta?.generatedAtISO;

  // No PDF: don't render anything
  if (!hasPdf) return null;

  // PDF stale: compact warning bar
  if (pdfStale && !isViewMode && !permanentlyLocked) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--color-status-warning-border)] bg-[var(--color-status-warning-bg)] px-4 py-2.5">
        <AlertTriangle className="size-4 shrink-0 text-[var(--color-status-warning)]" />
        <span className="flex-1 text-sm text-[var(--color-status-warning)]">
          {t('entry.documentOutdated')}
        </span>
      </div>
    );
  }

  // PDF ready: compact success bar
  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-[var(--color-status-success-border)] bg-[var(--color-status-success-bg)] px-4 py-2.5">
        <CheckCircle className="size-4 shrink-0 text-[var(--color-status-success)]" />
        <span className="flex-1 text-sm text-[var(--color-status-success)]">
          {t('entry.documentReady')}{generatedAt ? ` · Generated ${formatRelativeTime(generatedAt)}` : ""}
        </span>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!canPreview}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-[var(--color-status-success)] hover:bg-[var(--color-status-success-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Eye className="size-3.5" />
          {t('entry.preview')}
        </button>
        <a
          href={canDownload ? pdfUrl : undefined}
          download={canDownload ? pdfFileName : undefined}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            canDownload
              ? "text-[var(--color-status-success)] hover:bg-[var(--color-status-success-bg)] cursor-pointer"
              : "text-[var(--color-status-success)] opacity-50 cursor-not-allowed pointer-events-none"
          }`}
        >
          <Download className="size-3.5" />
          {t('entry.download')}
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
