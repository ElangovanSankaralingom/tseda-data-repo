import "server-only";
import path from "node:path";

/**
 * Central storage roots for user-generated/sensitive content.
 *
 * SECURITY INVARIANTS (S0 audit remediation, 2026-06):
 * - Nothing user-generated lives under `public/` — everything there is
 *   statically served by Next with NO authentication.
 * - Nothing containing PII lives under `data/` — that tree is git-tracked.
 * - All content below `.data/` is gitignored and must be served exclusively
 *   through session-checked API routes (`/api/file`, `/api/entry-file`).
 */

/** Gitignored private root. */
export const PRIVATE_DATA_ROOT = path.join(process.cwd(), ".data");

/** Entry attachments + generated entry PDFs.
 *  Disk layout: .data/entry-uploads/<ownerEmail>/<category>/<entryId>/...
 *  Entries persist a `storedPath` of the form
 *  "uploads/<ownerEmail>/<category>/<entryId>/..." (kept stable for
 *  backwards compatibility); resolve via {@link resolveEntryUploadPath}. */
export const ENTRY_UPLOADS_ROOT = path.join(PRIVATE_DATA_ROOT, "entry-uploads");

/** Profile-scoped uploads (avatars, experience certificates):
 *  .data/uploads/<email>/... — served via /api/file (owner-checked). */
export const PROFILE_UPLOADS_ROOT = path.join(PRIVATE_DATA_ROOT, "uploads");

/** Per-user profile documents (contain PII): .data/profiles/<email>.json */
export const PROFILES_DIR = path.join(PRIVATE_DATA_ROOT, "profiles");

const STORED_PATH_PREFIX = "uploads/";

/** True if a persisted storedPath has the canonical shape. */
export function isValidStoredPath(storedPath: string): boolean {
  if (!storedPath.startsWith(STORED_PATH_PREFIX)) return false;
  const rest = storedPath.slice(STORED_PATH_PREFIX.length);
  if (!rest || rest.includes("..") || rest.includes("\\") || path.isAbsolute(rest)) return false;
  return true;
}

/** Owner email segment of a canonical storedPath ("uploads/<owner>/..."). */
export function ownerOfStoredPath(storedPath: string): string | null {
  if (!isValidStoredPath(storedPath)) return null;
  const segments = storedPath.slice(STORED_PATH_PREFIX.length).split("/");
  return segments[0] || null;
}

/** Resolve a persisted storedPath to its absolute on-disk location under the
 *  private entry-uploads root. Throws on traversal/absolute-path attempts and
 *  guarantees the result stays inside ENTRY_UPLOADS_ROOT. */
export function resolveEntryUploadPath(storedPath: string): string {
  if (!isValidStoredPath(storedPath)) {
    throw new Error("Invalid stored path");
  }
  const rest = storedPath.slice(STORED_PATH_PREFIX.length);
  const resolved = path.resolve(ENTRY_UPLOADS_ROOT, rest);
  if (!resolved.startsWith(path.resolve(ENTRY_UPLOADS_ROOT) + path.sep)) {
    throw new Error("Invalid stored path");
  }
  return resolved;
}

/** Public-facing URL for an entry file — always the authed API route. */
export function entryFileUrl(storedPath: string): string {
  return `/api/entry-file?path=${encodeURIComponent(storedPath)}`;
}
