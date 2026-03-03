"use client";

import { ActionButton } from "@/components/ui/ActionButton";

type EntryPdfMeta = {
  url: string;
  fileName?: string;
} | null | undefined;

type EntryPdfActionsProps = {
  pdfMeta: EntryPdfMeta;
  disabled?: boolean;
};

export default function EntryPdfActions({ pdfMeta, disabled = false }: EntryPdfActionsProps) {
  const hasPdf = !!pdfMeta?.url && !disabled;

  return (
    <div className="flex flex-wrap gap-2">
      {hasPdf ? (
        <a
          href={pdfMeta.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm transition hover:bg-muted"
        >
          Preview Entry
        </a>
      ) : (
        <ActionButton variant="ghost" disabled>
          Preview Entry
        </ActionButton>
      )}

      {hasPdf ? (
        <a
          href={pdfMeta.url}
          download={pdfMeta.fileName || true}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm transition hover:bg-muted"
        >
          Download Entry
        </a>
      ) : (
        <ActionButton variant="ghost" disabled>
          Download Entry
        </ActionButton>
      )}
    </div>
  );
}
