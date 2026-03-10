import "server-only";

/**
 * Input sanitization for entry fields.
 *
 * Strips HTML tags, null bytes, and trims whitespace from all string values
 * in an entry before persistence. Called on every write path.
 */

const MAX_STRING_LENGTH = 5_000;

/**
 * Sanitize a single string value:
 * - Trim whitespace
 * - Strip HTML tags
 * - Remove null bytes
 * - Truncate to max length
 */
function sanitizeString(value: string): string {
  let s = value.trim();
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/\0/g, "");
  if (s.length > MAX_STRING_LENGTH) {
    s = s.slice(0, MAX_STRING_LENGTH);
  }
  return s;
}

// Keys that should never be sanitized (contain URLs, paths, timestamps, etc.)
const SKIP_KEYS = new Set([
  "id",
  "ownerEmail",
  "category",
  "createdAt",
  "updatedAt",
  "committedAtISO",
  "editWindowExpiresAt",
  "requestEditRequestedAtISO",
  "sentForConfirmationAtISO",
  "confirmedAtISO",
  "pdfGeneratedAt",
  "pdfSnapshotHash",
  "pdfSourceHash",
  "storedPath",
  "url",
  "streakActivatedAt",
  "streakCompletedAt",
  "activatedAtISO",
  "dueAtISO",
  "completedAtISO",
  "expiresAtISO",
]);

function sanitizeValue(value: unknown, key: string): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    if (SKIP_KEYS.has(key)) return value;
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item, i) => sanitizeValue(item, `${key}[${i}]`));
  }

  if (typeof value === "object") {
    return sanitizeRecord(value as Record<string, unknown>);
  }

  return value;
}

function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = sanitizeValue(value, key);
  }
  return result;
}

/**
 * Sanitize all string fields in an entry payload.
 * Returns a new object with sanitized values.
 */
export function sanitizeEntryFields(entry: Record<string, unknown>): Record<string, unknown> {
  return sanitizeRecord(entry);
}
