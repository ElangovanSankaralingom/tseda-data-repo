import "server-only";

// ---------------------------------------------------------------------------
// PII scrubbing for log output
// ---------------------------------------------------------------------------

const EMAIL_PATTERN = /([a-zA-Z0-9._+-])[a-zA-Z0-9._+-]*@([a-zA-Z0-9.-]+)/g;
const FILE_PATH_PATTERN = /\/(Users|home|var|tmp)\/[^\s"',}]+/g;
/** Indian identity numbers must never reach logs (S0 audit). */
const AADHAAR_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;
const PAN_PATTERN = /\b[A-Z]{5}\d{4}[A-Z]\b/g;

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
    .replace(FILE_PATH_PATTERN, maskFilePath)
    .replace(AADHAAR_PATTERN, "[aadhaar]")
    .replace(PAN_PATTERN, "[pan]");
}
