import "server-only";

/**
 * Server-side file upload validation.
 *
 * Validates MIME type, file size, magic bytes, and sanitizes filenames
 * before storage.
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// MIME type → expected magic bytes (file signatures)
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  "application/pdf": [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  "image/png": [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  "image/jpeg": [{ bytes: [0xff, 0xd8, 0xff] }],
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(MAGIC_BYTES));

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validate file MIME type against allowlist.
 */
export function validateMimeType(mimeType: string): FileValidationResult {
  const normalized = mimeType.toLowerCase().trim();
  if (!ALLOWED_MIME_TYPES.has(normalized)) {
    return { valid: false, error: `File type "${mimeType}" is not allowed. Accepted: PDF, JPEG, PNG.` };
  }
  return { valid: true };
}

/**
 * Validate file size against maximum.
 */
export function validateFileSize(sizeBytes: number): FileValidationResult {
  if (sizeBytes > MAX_FILE_SIZE) {
    const maxMB = MAX_FILE_SIZE / (1024 * 1024);
    return { valid: false, error: `File exceeds ${maxMB}MB size limit.` };
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: "File is empty." };
  }
  return { valid: true };
}

/**
 * Validate file content by checking magic bytes match the claimed MIME type.
 */
export function validateMagicBytes(
  buffer: ArrayBuffer | Uint8Array,
  claimedMimeType: string,
): FileValidationResult {
  const normalized = claimedMimeType.toLowerCase().trim();
  const signatures = MAGIC_BYTES[normalized];
  if (!signatures) {
    return { valid: false, error: `No signature validation for type "${claimedMimeType}".` };
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  for (const sig of signatures) {
    const offset = sig.offset ?? 0;
    if (bytes.length < offset + sig.bytes.length) continue;
    const match = sig.bytes.every((b, i) => bytes[offset + i] === b);
    if (match) return { valid: true };
  }

  return {
    valid: false,
    error: "File content does not match its claimed type. The file may be corrupted or mislabeled.",
  };
}

/**
 * Sanitize a filename to prevent path traversal and other attacks.
 * Returns a safe filename (without path components).
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and traversal patterns
  let safe = filename
    .replace(/\.\./g, "")
    .replace(/[/\\~]/g, "")
    .replace(/\0/g, "")
    .trim();

  // Remove leading dots (hidden files)
  safe = safe.replace(/^\.+/, "");

  // If nothing remains, use a default
  if (!safe) safe = "file";

  // Truncate to reasonable length
  if (safe.length > 200) {
    const ext = safe.lastIndexOf(".");
    if (ext > 0) {
      safe = safe.slice(0, 190) + safe.slice(ext);
    } else {
      safe = safe.slice(0, 200);
    }
  }

  return safe;
}

/**
 * Run all file validations in sequence.
 * Returns the first error found, or { valid: true }.
 */
export function validateUploadedFile(
  file: { size: number; type: string; name: string },
  contentBuffer: ArrayBuffer | Uint8Array,
): FileValidationResult {
  const sizeCheck = validateFileSize(file.size);
  if (!sizeCheck.valid) return sizeCheck;

  const mimeCheck = validateMimeType(file.type);
  if (!mimeCheck.valid) return mimeCheck;

  const magicCheck = validateMagicBytes(contentBuffer, file.type);
  if (!magicCheck.valid) return magicCheck;

  return { valid: true };
}
