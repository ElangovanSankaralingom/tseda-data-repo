"use client";

import { useMemo } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { type FileMetaLike } from "./entryComponentTypes";

type UploadFieldProps = {
  title: string;
  mode: "edit" | "view";
  meta: FileMetaLike;
  pendingFile: File | null;
  progress: number;
  busy: boolean;
  error: string | null;
  canChoose: boolean;
  canUpload: boolean;
  canDelete: boolean;
  needsEntry?: boolean;
  onSelectFile: (file: File | null) => void;
  onUpload: () => void;
  onDelete: () => void;
  showValidationError?: boolean;
  validationMessage?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-glass-bg)]">
      <div className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function UploadField({
  title,
  mode,
  meta,
  pendingFile,
  progress,
  busy,
  error,
  canChoose,
  canUpload,
  canDelete,
  needsEntry = false,
  onSelectFile,
  onUpload,
  onDelete,
  showValidationError = false,
  validationMessage,
}: UploadFieldProps) {
  const { t } = useTranslation();
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const neutralHelper = useMemo(() => {
    if (needsEntry) return "Save the entry first to upload files.";
    if (pendingFile) return `Selected: ${pendingFile.name}`;
    if (meta) return "Uploaded. Choose a new file and upload to replace it.";
    return "Select a file to enable Upload & Save.";
  }, [meta, needsEntry, pendingFile]);

  return (
    <div className="space-y-3 rounded-xl border-2 border-dashed border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-sm p-5 transition-all duration-300 hover:border-[var(--color-primary)]/20 hover:shadow-lg">
      <div className="text-sm font-semibold text-[var(--color-text-secondary)]">{title}</div>

      {mode === "view" ? (
        meta ? (
          <div className="space-y-3">
            <div className="text-xs text-[var(--color-text-muted)]">
              {meta.fileName} • {(meta.size / (1024 * 1024)).toFixed(2)} MB •{" "}
              {new Date(meta.uploadedAt).toLocaleString()}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={meta.url}
                target="_blank"
                rel="noreferrer"
                className={getButtonClass("context")}
              >
                {t('entry.viewPdf')}
              </a>
            </div>
          </div>
        ) : (
          <div className="text-xs text-[var(--color-text-muted)]">{t('entry.uploadHint')}</div>
        )
      ) : (
        <>
          {meta ? (
            <div className="text-xs text-[var(--color-text-muted)]">
              <a className="underline" href={meta.url} target="_blank" rel="noreferrer">
                {meta.fileName}
              </a>{" "}
              • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
            </div>
          ) : (
            <div className={cx("text-xs", showValidationError ? "text-[var(--color-status-error)]" : "text-[var(--color-text-muted)]")}>
              {showValidationError ? validationMessage || "This upload is mandatory." : "No file uploaded yet."}
            </div>
          )}

          <div className="text-xs text-[var(--color-text-muted)]">{neutralHelper}</div>

          {busy ? (
            <div className="space-y-2">
              <ProgressBar value={progress} />
              <div className="text-xs text-[var(--color-text-muted)]">{progress}% uploading...</div>
            </div>
          ) : null}

          {error ? <div className="text-xs text-[var(--color-status-error)]">{error}</div> : null}

          <div className="flex flex-wrap gap-2">
            {meta ? (
              <>
                <a
                  href={meta.url}
                  target="_blank"
                  rel="noreferrer"
                  className={getButtonClass("context")}
                >
                  {t('entry.viewPdf')}
                </a>
                <ActionButton
                  role="destructive"
                  disabled={!canDelete}
                  onClick={() =>
                    requestConfirmation({
                      title: "Remove uploaded file?",
                      description:
                        "This removes the currently uploaded file from this entry. You can upload a replacement afterward.",
                      confirmLabel: t('entry.delete'),
                      cancelLabel: t('entry.cancel'),
                      variant: "destructive",
                      onConfirm: onDelete,
                    })
                  }
                >
                  {t('entry.delete')}
                </ActionButton>
              </>
            ) : null}

            <label
              className={cx(
                canChoose
                  ? `${getButtonClass("context")} cursor-pointer`
                  : getButtonClass("context", { disabled: true })
              )}
            >
              Choose file
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                disabled={!canChoose}
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  event.currentTarget.value = "";
                  onSelectFile(nextFile);
                }}
              />
            </label>

            <ActionButton role="primary" disabled={!canUpload} onClick={onUpload}>
              {meta && !pendingFile ? "Uploaded" : "Upload & Save"}
            </ActionButton>
          </div>
        </>
      )}
      {confirmationDialog}
    </div>
  );
}
