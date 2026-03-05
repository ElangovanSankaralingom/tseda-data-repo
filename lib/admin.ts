import { normalizeEmail } from "@/lib/facultyDirectory";

export const MASTER_ADMIN_EMAIL = "senarch@tce.edu";

export function isMasterAdmin(email: string | null | undefined) {
  return normalizeEmail(email ?? "") === MASTER_ADMIN_EMAIL;
}
