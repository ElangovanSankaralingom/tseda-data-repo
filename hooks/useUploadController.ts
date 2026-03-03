"use client";

import { useCallback, useMemo, useState } from "react";

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
      setError("Only PDF/JPG/PNG allowed.");
      return null;
    }

    if (pendingFile.size > MAX_BYTES) {
      setError("Max file size is 20MB.");
      return null;
    }

    try {
      setBusy(true);
      setError(null);
      setProgress(0);
      const meta = await upload(pendingFile, (pct) => setProgress(pct));
      setPendingFile(null);
      setProgress(100);
      return meta;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, [pendingFile, upload]);

  const deleteFile = useCallback(
    async (meta: TMeta | null) => {
      if (!meta) return false;

      try {
        setBusy(true);
        setError(null);
        await remove(meta);
        setPendingFile(null);
        setProgress(0);
        return true;
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
        return false;
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
