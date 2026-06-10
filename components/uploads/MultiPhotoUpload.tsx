"use client";

import { useEffect, useMemo, useState } from "react";
import { RoleButton } from "@/components/ui/RoleButton";
import { useConfirmAction } from "@/hooks/useConfirmAction";
import { AppError, toUserMessage } from "@/lib/errors";
import { safeAction } from "@/lib/safeAction";
import { getButtonClass } from "@/lib/ui/buttonRoles";
import { deleteFile, uploadFile } from "@/lib/upload/uploadService";
import { type FileMeta } from "@/lib/types/entry";
import { useTranslation } from "@/lib/i18n/useTranslation";

export type { FileMeta };

type MultiPhotoUploadProps = {
  title: string;
  value: FileMeta[];
  onUploaded: (meta: FileMeta) => void | Promise<void>;
  onDeleted: (meta: FileMeta) => void | Promise<void>;
  uploadEndpoint: string;
  email: string;
  recordId: string;
  slotName: string;
  showRequiredError?: boolean;
  requiredErrorText?: string;
  onStatusChange?: (status: { hasPending: boolean; busy: boolean }) => void;
  disabled?: boolean;
  viewOnly?: boolean;
  maxFileSizeMB?: number;
  acceptedFileTypes?: string[];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-hover)]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-[var(--color-text-primary)]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MultiPhotoUpload({
  title,
  value,
  onUploaded,
  onDeleted,
  uploadEndpoint,
  email,
  recordId,
  slotName,
  showRequiredError,
  requiredErrorText,
  onStatusChange,
  disabled = false,
  viewOnly = false,
  maxFileSizeMB = 20,
  acceptedFileTypes = [".pdf", ".jpg", ".jpeg", ".png"],
}: MultiPhotoUploadProps) {
  const { t } = useTranslation();
  const { requestConfirmation, confirmationDialog } = useConfirmAction();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStatusChange?.({ hasPending: pendingFiles.length > 0, busy });
  }, [busy, onStatusChange, pendingFiles.length]);

  const overallProgress = useMemo(() => {
    if (pendingFiles.length === 0) return 0;
    return Math.round(((completedCount + currentProgress / 100) / pendingFiles.length) * 100);
  }, [completedCount, currentProgress, pendingFiles.length]);

  const hasPending = pendingFiles.length > 0;

  async function deletePhoto(meta: FileMeta) {
    if (disabled) return;

    const result = await safeAction(async () => {
      await deleteFile({
        endpoint: uploadEndpoint,
        storedPath: meta.storedPath,
      });
      await Promise.resolve(onDeleted(meta));
    }, {
      context: "MultiPhotoUpload.deletePhoto",
    });

    if (!result.ok) {
      setError(toUserMessage(result.error));
    }
  }

  async function uploadSelected() {
    if (!pendingFiles.length || busy || disabled) return;

    setError(null);
    setBusy(true);
    setCurrentProgress(0);
    setCompletedCount(0);

    try {
      for (let index = 0; index < pendingFiles.length; index += 1) {
        const file = pendingFiles[index];
        const allowed =
          file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg";

        if (!allowed) {
          setError(toUserMessage(new AppError({ code: "VALIDATION_ERROR", message: t("upload.onlyAllowed") })));
          return;
        }

        if (file.size > 20 * 1024 * 1024) {
          setError(toUserMessage(new AppError({ code: "VALIDATION_ERROR", message: t("upload.maxFileSize") })));
          return;
        }

        const uploadResult = await safeAction(
          () =>
            uploadFile({
              endpoint: uploadEndpoint,
              email,
              recordId,
              slot: slotName,
              file,
              onProgress: (pct) => setCurrentProgress(pct),
            }),
          { context: "MultiPhotoUpload.uploadFile" }
        );

        if (!uploadResult.ok) {
          setError(toUserMessage(uploadResult.error));
          return;
        }

        const persistResult = await safeAction(
          () => Promise.resolve(onUploaded(uploadResult.data)),
          { context: "MultiPhotoUpload.onUploaded" }
        );

        if (!persistResult.ok) {
          setError(toUserMessage(persistResult.error));
          return;
        }

        setCompletedCount(index + 1);
        setCurrentProgress(0);
      }

      setPendingFiles([]);
    } finally {
      setBusy(false);
      setCurrentProgress(0);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-glass-border)] p-4 space-y-3" aria-busy={busy || undefined}>
      <div className="text-sm font-semibold">{title}</div>

      {value.length > 0 ? (
        <div className="space-y-2">
          {value.map((meta) => (
            <div
              key={meta.storedPath}
              className="grid gap-2 rounded-lg border border-[var(--color-glass-border)] px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0 text-xs text-[var(--color-text-muted)]">
                <a className="underline" href={meta.url} target="_blank" rel="noreferrer">
                  {meta.fileName}
                </a>{" "}
                • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href={meta.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-lg border border-[var(--color-glass-border)] px-3 py-2 text-sm transition hover:bg-[var(--color-glass-hover)]"
                >
                  {t("entry.preview")}
                </a>
                {!viewOnly ? (
                  <button
                    type="button"
                    onClick={() =>
                      requestConfirmation({
                        title: t("upload.removeConfirmTitle"),
                        description: t("upload.removeConfirmDesc"),
                        confirmLabel: t("entry.remove"),
                        cancelLabel: t("entry.cancel"),
                        variant: "destructive",
                        onConfirm: () => deletePhoto(meta),
                      })
                    }
                    disabled={busy || disabled}
                    className={cx(
                      "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border px-3 text-sm",
                      busy || disabled
                        ? "pointer-events-none cursor-not-allowed border-[var(--color-glass-border)] bg-transparent text-[var(--color-text-muted)] opacity-60"
                        : "border-[var(--color-glass-border)] text-[var(--color-status-error)] transition hover:bg-[var(--color-status-error-bg)]"
                    )}
                  >
                    {t("common.delete")}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cx("text-xs", viewOnly ? "text-[var(--color-text-muted)]" : showRequiredError ? "text-[var(--color-status-error)]" : "text-[var(--color-text-muted)]")}>
          {viewOnly
            ? t("upload.notUploaded")
            : showRequiredError
              ? requiredErrorText || t("upload.mandatory")
              : t("upload.notUploaded")}
        </div>
      )}

      {!viewOnly ? (
        <div className="text-xs text-[var(--color-text-muted)]">
          {hasPending
            ? `${pendingFiles.length} ${pendingFiles.length === 1 ? t("upload.fileAccepted") : t("upload.filesAccepted")}`
            : value.length > 0
              ? t("upload.chooseMoreFiles")
              : t("upload.chooseFilesToEnable")}
        </div>
      ) : null}

      {!viewOnly && busy ? (
        <div className="space-y-2">
          <ProgressBar value={overallProgress} />
          <div className="text-xs text-[var(--color-text-muted)]">
            {overallProgress}% {t("upload.uploadingProgress")}
          </div>
        </div>
      ) : null}

      {!viewOnly && error ? <div className="text-xs text-[var(--color-status-error)]">{error}</div> : null}

      {!viewOnly ? (
        <div className="flex flex-wrap gap-2">
          <label
            className={cx(
              "min-h-[44px]",
              busy || disabled
                ? getButtonClass("context", { disabled: true })
                : `${getButtonClass("context")} cursor-pointer`
            )}
          >
            {t("upload.chooseFiles")}
            <input
              type="file"
              multiple
              className="hidden"
              aria-label="Upload file"
              accept={acceptedFileTypes.join(",")}
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                event.currentTarget.value = "";
                const maxBytes = maxFileSizeMB * 1024 * 1024;
                const valid: File[] = [];
                for (const file of selected) {
                  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
                  if (!acceptedFileTypes.includes(ext)) {
                    setError(t("upload.onlyAllowed"));
                    return;
                  }
                  if (file.size > maxBytes) {
                    setError(`${t("upload.fileExceedsLimit")} ${maxFileSizeMB}${t("upload.mbLimit")}`);
                    return;
                  }
                  valid.push(file);
                }
                setPendingFiles((current) => [...current, ...valid]);
                setError(null);
                setCompletedCount(0);
                setCurrentProgress(0);
              }}
            />
          </label>

          <RoleButton
            role="primary"
            onClick={() => void uploadSelected()}
            disabled={!hasPending || busy || disabled}
          >
            {t("upload.uploadSelected")}
          </RoleButton>
        </div>
      ) : null}
      {confirmationDialog}
    </div>
  );
}
