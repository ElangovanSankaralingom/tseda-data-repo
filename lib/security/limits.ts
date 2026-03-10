import "server-only";

import { AppError } from "@/lib/errors";

import { APP_CONFIG } from "@/lib/config/appConfig";

export const SECURITY_LIMITS = APP_CONFIG.security;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function byteLengthUtf8(value: string) {
  return new TextEncoder().encode(value).length;
}

function assertStringLength(value: string, maxLength: number, fieldPath: string) {
  if (value.length <= maxLength) return;
  throw new AppError({
    code: "PAYLOAD_TOO_LARGE",
    message: `${fieldPath} exceeds ${maxLength} characters.`,
    details: { fieldPath, maxLength, actualLength: value.length },
  });
}

function walkAndAssertStringLengths(
  value: unknown,
  maxLength: number,
  path: string,
  seen: WeakSet<object>
) {
  if (typeof value === "string") {
    assertStringLength(value, maxLength, path);
    return;
  }

  if (!value || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      walkAndAssertStringLengths(value[index], maxLength, `${path}[${index}]`, seen);
    }
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    walkAndAssertStringLengths(nested, maxLength, `${path}.${key}`, seen);
  }
}

function countAttachmentArrayLength(entry: unknown) {
  if (!isObjectRecord(entry)) return 0;

  const rootAttachments = Array.isArray(entry.attachments) ? entry.attachments.length : 0;
  const rootPhotos = Array.isArray(entry.geotaggedPhotos) ? entry.geotaggedPhotos.length : 0;
  const uploadsRecord = isObjectRecord(entry.uploads) ? entry.uploads : null;
  const uploadPhotos =
    uploadsRecord && Array.isArray(uploadsRecord.geotaggedPhotos)
      ? uploadsRecord.geotaggedPhotos.length
      : 0;

  return Math.max(rootAttachments, rootPhotos, uploadPhotos);
}

export function assertPayloadSize(payload: unknown, maxBytes: number, contextName = "payload") {
  let serialized = "";
  try {
    serialized = JSON.stringify(payload);
  } catch (error) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: `Invalid ${contextName} format.`,
      details: { contextName },
      cause: error,
    });
  }

  const bytes = byteLengthUtf8(serialized);
  if (bytes <= maxBytes) return;

  throw new AppError({
    code: "PAYLOAD_TOO_LARGE",
    message: `${contextName} exceeds the ${Math.round(maxBytes / 1024)}KB size limit.`,
    details: { contextName, maxBytes, bytes },
  });
}

export function assertActionPayload(payload: unknown, contextName: string, maxBytes?: number) {
  assertPayloadSize(payload, maxBytes ?? SECURITY_LIMITS.actionPayloadMaxBytes, contextName);
  walkAndAssertStringLengths(payload, SECURITY_LIMITS.entryMaxStringLength, contextName, new WeakSet());
}

export function assertEntryMutationInput(entryPayload: unknown, contextName = "entry payload") {
  assertPayloadSize(entryPayload, SECURITY_LIMITS.entryPayloadMaxBytes, contextName);
  walkAndAssertStringLengths(
    entryPayload,
    SECURITY_LIMITS.entryMaxStringLength,
    contextName,
    new WeakSet()
  );

  const attachmentCount = countAttachmentArrayLength(entryPayload);
  if (attachmentCount <= SECURITY_LIMITS.maxAttachmentsPerEntry) return;

  throw new AppError({
    code: "PAYLOAD_TOO_LARGE",
    message: `Attachment limit exceeded. Maximum ${SECURITY_LIMITS.maxAttachmentsPerEntry} files allowed.`,
    details: {
      contextName,
      maxAttachments: SECURITY_LIMITS.maxAttachmentsPerEntry,
      attachmentCount,
    },
  });
}

export function assertUploadMetadataInput(
  metadata: Record<string, unknown>,
  contextName = "upload metadata"
) {
  assertPayloadSize(metadata, SECURITY_LIMITS.uploadMetadataMaxBytes, contextName);
  walkAndAssertStringLengths(
    metadata,
    SECURITY_LIMITS.uploadFieldMaxLength,
    contextName,
    new WeakSet()
  );
}
