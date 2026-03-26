import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getActionHistory } from "@/lib/admin/actionHistory";
import { apiSuccess, apiForbidden, apiUnauthorized } from "@/lib/api/apiResponse";
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();
  if (!canAccessAdminConsole(email)) return apiForbidden();

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20", 10) || 20));
  const actionTypeParam = url.searchParams.get("actionType");
  const category = url.searchParams.get("category") ?? undefined;

  const actionType =
    actionTypeParam && VALID_ACTION_TYPES.includes(actionTypeParam as ActionType)
      ? (actionTypeParam as ActionType)
      : undefined;

  const result = getActionHistory({ page, pageSize, actionType, category });
  return apiSuccess(result);
}
