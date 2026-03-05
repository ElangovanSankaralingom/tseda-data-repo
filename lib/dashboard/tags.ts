import { normalizeEmail } from "@/lib/facultyDirectory";

export function getDashboardTag(email: string) {
  return `dashboard:${normalizeEmail(email)}`;
}
