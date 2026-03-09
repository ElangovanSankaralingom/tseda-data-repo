"use client";

import { ActionButton } from "@/components/ui/ActionButton";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { type EntryPdfMeta } from "./dataEntryTypes";

export default function EntryPdfActions({ pdfMeta, disabled = false }: {
  pdfMeta: EntryPdfMeta;
  disabled?: boolean;
}) {
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
