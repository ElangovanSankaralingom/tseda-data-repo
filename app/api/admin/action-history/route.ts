import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole, canViewAudit } from "@/lib/admin/roles";
import { getCoordinatorScope } from "@/lib/admin/coordinators";
import { cachedApiSuccess, apiError, apiForbidden, apiUnauthorized } from "@/lib/api/apiResponse";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getActionHistory } from "@/lib/admin/actionHistory";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import type { ActionType } from "@/lib/admin/actionHistory";

const VALID_ACTION_TYPES: ActionType[] = [
  "edit_granted",
  "edit_rejected",
  "delete_approved",
  "delete_rejected",
  "user_cancelled",
  "auto_finalised",
  "auto_deleted",
];

async function GETHandler(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();
  if (!canAccessAdminConsole(email)) return apiForbidden();

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "admin.action-history.get",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return apiError(appError.message, { status: httpStatusForCode(appError.code) });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
  const actionTypeParam = url.searchParams.get("actionType");
  const category = url.searchParams.get("category") ?? undefined;

  const actionType =
    actionTypeParam && VALID_ACTION_TYPES.includes(actionTypeParam as ActionType)
      ? (actionTypeParam as ActionType)
      : undefined;

  // Scoped trail: master/reviewer see all; a coordinator sees only their
  // assigned categories' history.
  const allowedCategories = canViewAudit(email) ? undefined : getCoordinatorScope(email).categories;

  const result = getActionHistory({ page, pageSize, actionType, category, allowedCategories });
  return cachedApiSuccess(result, 30);
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
