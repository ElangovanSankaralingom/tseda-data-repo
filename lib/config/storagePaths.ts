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

/** Gitignored private root. Resolved dynamically (NOT at module load) so the
 *  PRIVATE_DATA_ROOT env override — used by the test harness to sandbox
 *  trash/upload writes — takes effect. Load-time pinning previously let test
 *  runs write quarantine bundles and upload files into the LIVE `.data`
 *  (2026-07 audit follow-up). */
export function privateDataRoot(): string {
  const custom = process.env.PRIVATE_DATA_ROOT?.trim();
  return custom ? path.resolve(process.cwd(), custom) : path.join(process.cwd(), ".data");
}

/** Entry attachments + generated entry PDFs.
 *  Disk layout: .data/entry-uploads/<ownerEmail>/<category>/<entryId>/...
 *  Entries persist a `storedPath` of the form
 *  "uploads/<ownerEmail>/<category>/<entryId>/..." (kept stable for
 *  backwards compatibility); resolve via {@link resolveEntryUploadPath}. */
export function entryUploadsRoot(): string {
  return path.join(privateDataRoot(), "entry-uploads");
}

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
  const root = entryUploadsRoot();
  const rest = storedPath.slice(STORED_PATH_PREFIX.length);
  const resolved = path.resolve(root, rest);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) {
    throw new Error("Invalid stored path");
  }
  return resolved;
}

/** Public-facing URL for an entry file — always the authed API route. */
export function entryFileUrl(storedPath: string): string {
  return `/api/entry-file?path=${encodeURIComponent(storedPath)}`;
}
