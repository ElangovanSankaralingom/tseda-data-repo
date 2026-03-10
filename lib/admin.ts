import { APP_CONFIG } from "@/lib/config/appConfig";
import { normalizeEmail } from "@/lib/facultyDirectory";

export const MASTER_ADMIN_EMAIL = APP_CONFIG.institution.masterAdminEmail;

export function isMasterAdmin(email: string | null | undefined) {
  return normalizeEmail(email ?? "") === MASTER_ADMIN_EMAIL;
}
