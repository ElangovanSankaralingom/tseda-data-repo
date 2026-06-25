import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/admin/roles";
import {
  getCoordinatorsConfig,
  upsertCoordinatorType,
  removeCoordinatorType,
  assignCoordinatorType,
  unassignCoordinatorType,
  type CoordinatorType,
} from "@/lib/admin/coordinators";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { csrfGuard } from "@/lib/security/csrf";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(getCoordinatorsConfig(), { status: 200 });
}

type Body =
  | { action: "upsertType"; type: Partial<CoordinatorType> }
  | { action: "removeType"; id: string }
  | { action: "assign"; email: string; typeId: string }
  | { action: "unassign"; email: string; typeId: string };

export async function POST(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const adminEmail = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(adminEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: adminEmail,
      action: "admin.coordinators.post",
      options: RATE_LIMIT_PRESETS.adminOps,
    });

    const body = (await request.json()) as Body;
    assertActionPayload(body, "coordinator config change", SECURITY_LIMITS.actionPayloadMaxBytes);

    switch (body.action) {
      case "upsertType": {
        const config = upsertCoordinatorType(body.type ?? {});
        if (!config) {
          return NextResponse.json(
            { error: "A coordinator type needs a name and at least one valid category." },
            { status: 400 }
          );
        }
        return NextResponse.json(config, { status: 200 });
      }
      case "removeType": {
        const id = String(body.id ?? "").trim();
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(removeCoordinatorType(id), { status: 200 });
      }
      case "assign":
      case "unassign": {
        const targetEmail = normalizeEmail(String(body.email ?? ""));
        const typeId = String(body.typeId ?? "").trim();
        if (!targetEmail || !targetEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
          return NextResponse.json({ error: "valid email required" }, { status: 400 });
        }
        if (!typeId) return NextResponse.json({ error: "typeId required" }, { status: 400 });
        const config =
          body.action === "assign"
            ? assignCoordinatorType(targetEmail, typeId)
            : unassignCoordinatorType(targetEmail, typeId);
        return NextResponse.json(config, { status: 200 });
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.admin.coordinators.POST");
    return NextResponse.json({ error: appError.message || "Error" }, { status: 500 });
  }
}
