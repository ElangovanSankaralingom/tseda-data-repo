import "server-only";

// ---------------------------------------------------------------------------
// PII scrubbing for log output
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /([a-zA-Z0-9._+-])[a-zA-Z0-9._+-]*@([a-zA-Z0-9.-]+)/g;
const FILE_PATH_PATTERN = /\/(Users|home|var|tmp)\/[^\s"',}]+/g;
const SESSION_TOKEN_PATTERN = /[a-f0-9]{32,}/gi;

/** Mask an email: "john.doe@tce.edu" → "j***@tce.edu" */
function maskEmail(match: string, firstChar: string, domain: string): string {
  return `${firstChar}***@${domain}`;
}

/** Mask absolute file paths: "/Users/foo/bar" → "[path]" */
function maskFilePath(): string {
  return "[path]";
}

/** Scrub PII from a single string value. */
export function scrubString(value: string): string {
  return value
    .replace(EMAIL_PATTERN, maskEmail)
    .replace(FILE_PATH_PATTERN, maskFilePath);
}

/** Scrub PII from an object (shallow — only scrubs string values at top level). */
export function scrubRecord(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      // Don't scrub well-known safe fields
      if (key === "event" || key === "level" || key === "ts" || key === "requestId") {
        result[key] = value;
      } else {
        result[key] = scrubString(value);
      }
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Deep-scrub long session tokens from a string.
 * Only used for values that might contain raw tokens.
 */
export function scrubTokens(value: string): string {
  return value.replace(SESSION_TOKEN_PATTERN, (match) => {
    if (match.length >= 32) return "[token]";
    return match;
  });
}
