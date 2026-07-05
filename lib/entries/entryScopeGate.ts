import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCategoryEntryScope, isValidCategorySlug } from "@/data/categoryRegistry";
import { canCoordinatorEnterData } from "@/lib/admin/coordinators";
import { normalizeEmail } from "@/lib/facultyDirectory";

/**
 * Entry-scope page gate (B2): true when the current session may view a
 * category's pages. DLC-scoped categories are department records —
 * off-limits to everyone but coordinators holding the enterData power.
 * Faculty-scoped categories always pass.
 */
export async function sessionMayViewCategory(category: string): Promise<boolean> {
  if (!isValidCategorySlug(category)) return true; // router renders its own 404
  if (getCategoryEntryScope(category) !== "dlc") return true;
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  return !!email && canCoordinatorEnterData(email, category);
}
