import { APP_CONFIG } from "@/lib/config/appConfig";
import { normalizeEmail } from "@/lib/facultyDirectory";

/** Permanent, non-removable root master (institutional anchor — the HOD post). */
export const ROOT_MASTER_EMAIL = normalizeEmail(APP_CONFIG.institution.rootMasterEmail);

/** Founding master seeded by default. A full master, but removable by the root. */
export const MASTER_ADMIN_EMAIL = normalizeEmail(APP_CONFIG.institution.masterAdminEmail);

/**
 * Statically-recognised master founders. Both are treated as master admins by the
 * cheap (client- and edge-safe) check below, independent of the dynamic role
 * config. Dynamically-added masters are recognised by the role-based checks in
 * `@/lib/admin/roles` (isMasterAdmin), which read the admin-users config.
 */
export const MASTER_ADMIN_EMAILS: readonly string[] = [
  ROOT_MASTER_EMAIL,
  MASTER_ADMIN_EMAIL,
];

export function isMasterAdmin(email: string | null | undefined) {
  return MASTER_ADMIN_EMAILS.includes(normalizeEmail(email ?? ""));
}

export function isRootMaster(email: string | null | undefined) {
  return normalizeEmail(email ?? "") === ROOT_MASTER_EMAIL;
}
