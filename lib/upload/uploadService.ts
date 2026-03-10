"use client";

import { AppError } from "@/lib/errors";
import { safeAction } from "@/lib/safeAction";
import { trackClientTelemetryEvent } from "@/lib/telemetry/client";
import type { Result } from "@/lib/result";

export type UploadedFile = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  url: string;
  storedPath: string;
  name: string;
  type: string;
  path: string;
};

type UploadFileOptions = {
  endpoint: string;
  recordId: string;
  slot: string;
  file: File;
  email?: string;
  onProgress?: (pct: number) => void;
};

type DeleteFileOptions = {
  endpoint: string;
  storedPath: string;
};

type RawUploadedFile = {
  fileName?: unknown;
  mimeType?: unknown;
  size?: unknown;
  uploadedAt?: unknown;
  url?: unknown;
  storedPath?: unknown;
  id?: unknown;
};

function asNonEmptyString(value: unknown) {
  const next = typeof value === "string" ? value.trim() : "";
  return next;
}

function inferCategoryFromEndpoint(endpoint: string) {
  const normalized = endpoint.trim().toLowerCase();
  // Match new unified pattern: /api/me/<category>/file
  const match = normalized.match(/\/api\/me\/([\w-]+)\/file/);
  if (match) return match[1];
  // Legacy patterns: /api/me/<category>-file
  if (normalized.includes("fdp-conducted")) return "fdp-conducted";
  if (normalized.includes("fdp-attended")) return "fdp-attended";
  if (normalized.includes("case-studies")) return "case-studies";
  if (normalized.includes("guest-lectures")) return "guest-lectures";
  if (normalized.includes("workshops")) return "workshops";
  return null;
}

export function normalizeUploadedFile(result: unknown): UploadedFile {
  const raw = result && typeof result === "object" ? (result as RawUploadedFile) : {};
  const fileName = asNonEmptyString(raw.fileName);
  const mimeType = asNonEmptyString(raw.mimeType);
  const url = asNonEmptyString(raw.url);
  const storedPath = asNonEmptyString(raw.storedPath);
  const uploadedAt = asNonEmptyString(raw.uploadedAt) || new Date().toISOString();
  const sizeValue = typeof raw.size === "number" ? raw.size : Number(raw.size ?? 0);
  const size = Number.isFinite(sizeValue) && sizeValue >= 0 ? sizeValue : 0;
  const id = asNonEmptyString(raw.id) || storedPath || `${uploadedAt}:${fileName}`;

  if (!fileName || !mimeType || !url || !storedPath) {
    throw new AppError({ code: "UPLOAD_FAILED", message: "Upload failed (bad response)." });
  }

  return {
    id,
    fileName,
    mimeType,
    size,
    uploadedAt,
    url,
    storedPath,
    name: fileName,
    type: mimeType,
    path: storedPath,
  };
}

export function uploadFile({
  endpoint,
  recordId,
  slot,
  file,
  email,
  onProgress,
}: UploadFileOptions): Promise<UploadedFile> {
  const startedAt = Date.now();
  const category = inferCategoryFromEndpoint(endpoint);
  void trackClientTelemetryEvent({
    event: "upload.start",
    category,
    entryId: recordId || null,
    success: true,
    meta: {
      action: "upload.start",
      slot,
      source: "upload",
    },
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      onProgress?.(pct);
    };

    xhr.onerror = () => {
      void trackClientTelemetryEvent({
        event: "upload.failure",
        category,
        entryId: recordId || null,
        success: false,
        durationMs: Date.now() - startedAt,
        meta: {
          action: "upload.failure",
          slot,
          source: "upload",
          errorCode: "NETWORK_ERROR",
        },
      });
      reject(new AppError({ code: "NETWORK_ERROR", message: "Upload failed (network)." }));
    };
    xhr.onabort = () => {
      void trackClientTelemetryEvent({
        event: "upload.failure",
        category,
        entryId: recordId || null,
        success: false,
        durationMs: Date.now() - startedAt,
        meta: {
          action: "upload.failure",
          slot,
          source: "upload",
          errorCode: "UPLOAD_FAILED",
        },
      });
      reject(new AppError({ code: "UPLOAD_FAILED", message: "Upload cancelled." }));
    };

    xhr.onload = () => {
      try {
        const isJSON = (xhr.getResponseHeader("content-type") || "").includes("application/json");
        const payload = isJSON ? JSON.parse(xhr.responseText || "{}") : null;

        if (xhr.status >= 200 && xhr.status < 300) {
          void trackClientTelemetryEvent({
            event: "upload.success",
            category,
            entryId: recordId || null,
            success: true,
            durationMs: Date.now() - startedAt,
            meta: {
              action: "upload.success",
              slot,
              source: "upload",
            },
          });
          resolve(normalizeUploadedFile(payload));
          return;
        }

        const message =
          payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : `Upload failed (${xhr.status}).`;
        void trackClientTelemetryEvent({
          event: "upload.failure",
          category,
          entryId: recordId || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            action: "upload.failure",
            slot,
            source: "upload",
            errorCode: "UPLOAD_FAILED",
          },
        });
        reject(new AppError({ code: "UPLOAD_FAILED", message }));
      } catch {
        void trackClientTelemetryEvent({
          event: "upload.failure",
          category,
          entryId: recordId || null,
          success: false,
          durationMs: Date.now() - startedAt,
          meta: {
            action: "upload.failure",
            slot,
            source: "upload",
            errorCode: "UPLOAD_FAILED",
          },
        });
        reject(new AppError({ code: "UPLOAD_FAILED", message: "Upload failed (bad response)." }));
      }
    };

    const body = new FormData();
    if (email) {
      body.set("email", email);
    }
    body.set("recordId", recordId);
    body.set("slot", slot);
    body.set("file", file);
    xhr.send(body);
  });
}

export async function deleteFile({ endpoint, storedPath }: DeleteFileOptions): Promise<void> {
  const startedAt = Date.now();
  const category = inferCategoryFromEndpoint(endpoint);
  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storedPath }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "Delete failed.";
    void trackClientTelemetryEvent({
      event: "upload.failure",
      category,
      success: false,
      durationMs: Date.now() - startedAt,
      meta: {
        action: "upload.remove",
        source: "upload",
        errorCode: "IO_ERROR",
      },
    });
    throw new AppError({ code: "IO_ERROR", message });
  }

  void trackClientTelemetryEvent({
    event: "upload.remove",
    category,
    success: true,
    durationMs: Date.now() - startedAt,
    meta: {
      action: "upload.remove",
      source: "upload",
      storedPath: storedPath.slice(0, 120),
    },
  });
}

export async function uploadFileSafe(options: UploadFileOptions): Promise<Result<UploadedFile>> {
  return safeAction(() => uploadFile(options), {
    context: "uploadService.uploadFile",
  });
}

export async function deleteFileSafe(options: DeleteFileOptions): Promise<Result<void>> {
  return safeAction(() => deleteFile(options), {
    context: "uploadService.deleteFile",
  });
}
