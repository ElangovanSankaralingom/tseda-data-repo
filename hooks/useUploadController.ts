"use client";

import { useCallback, useMemo, useState } from "react";
import { AppError, toUserMessage } from "@/lib/errors";
import { safeAction } from "@/lib/safeAction";

type UploadFileMeta = {
  fileName?: string;
  storedPath?: string;
};

type UseUploadControllerOptions<TMeta extends UploadFileMeta> = {
  locked: boolean;
  upload: (file: File, onProgress: (pct: number) => void) => Promise<TMeta>;
  remove: (meta: TMeta) => Promise<void>;
};

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

export function useUploadController<TMeta extends UploadFileMeta>({
  locked,
  upload,
  remove,
}: UseUploadControllerOptions<TMeta>) {
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFile = useCallback((file: File | null) => {
    setPendingFile(file);
    setError(null);
    setProgress(0);
  }, []);

  const uploadAndSave = useCallback(async () => {
    if (!pendingFile) {
      setError("Select a file first.");
      return null;
    }

    if (!ALLOWED_MIME_TYPES.has(pendingFile.type)) {
      setError(toUserMessage(new AppError({ code: "VALIDATION_ERROR", message: "Only PDF/JPG/PNG allowed." })));
      return null;
    }

    if (pendingFile.size > MAX_BYTES) {
      setError(toUserMessage(new AppError({ code: "VALIDATION_ERROR", message: "Max file size is 20MB." })));
      return null;
    }

    setBusy(true);
    setError(null);
    setProgress(0);

    try {
      const result = await safeAction(
        () => upload(pendingFile, (pct) => setProgress(pct)),
        { context: "useUploadController.uploadAndSave" }
      );

      if (!result.ok) {
        setError(toUserMessage(result.error));
        return null;
      }

      setPendingFile(null);
      setProgress(100);
      return result.data;
    } finally {
      setBusy(false);
    }
  }, [pendingFile, upload]);

  const deleteFile = useCallback(
    async (meta: TMeta | null) => {
      if (!meta) return false;

      setBusy(true);
      setError(null);

      try {
        const result = await safeAction(() => remove(meta), {
          context: "useUploadController.deleteFile",
        });

        if (!result.ok) {
          setError(toUserMessage(result.error));
          return false;
        }

        setPendingFile(null);
        setProgress(0);
        return true;
      } finally {
        setBusy(false);
      }
    },
    [remove]
  );

  const reset = useCallback(() => {
    setPendingFile(null);
    setProgress(0);
    setBusy(false);
    setError(null);
  }, []);

  return useMemo(
    () => ({
      pendingFile,
      progress,
      busy,
      error,
      selectFile,
      uploadAndSave,
      deleteFile,
      reset,
      canChoose: !locked && !busy,
      canUpload: !!pendingFile && !locked && !busy,
      canDelete: !locked && !busy,
    }),
    [busy, deleteFile, error, locked, pendingFile, progress, reset, selectFile, uploadAndSave]
  );
}
