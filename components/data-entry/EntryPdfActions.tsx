"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import { getButtonClass } from "@/lib/ui/buttonRoles";

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
          className={getButtonClass("context")}
        >
          Preview Entry
        </a>
      ) : (
        <ActionButton role="context" disabled>
          Preview Entry
        </ActionButton>
      )}

      {hasPdf ? (
        <a
          href={pdfMeta.url}
          download={pdfMeta.fileName || true}
          className={getButtonClass("context")}
        >
          Download Entry
        </a>
      ) : (
        <ActionButton role="context" disabled>
          Download Entry
        </ActionButton>
      )}
    </div>
  );
}
