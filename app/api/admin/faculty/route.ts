import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/admin/roles";
import {
  getFacultyRegistry,
  addFaculty,
  addFacultyBulk,
  setFacultyStatus,
  setFacultyDepartments,
  setBetaStatus,
  upsertDepartment,
  removeDepartment,
  type FacultyStatus,
  type BetaStatus,
} from "@/lib/admin/facultyRegistry";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { csrfGuard } from "@/lib/security/csrf";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(getFacultyRegistry());
}

type Body =
  | { action: "add"; email: string; name?: string }
  | { action: "addBulk"; emails: string[] }
  | { action: "setStatus"; email: string; status: FacultyStatus }
  | { action: "setDepartments"; email: string; departmentIds: string[] }
  | { action: "setBeta"; email: string; betaStatus: BetaStatus }
  | { action: "upsertDept"; label: string; id?: string }
  | { action: "removeDept"; id: string };

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
      action: "admin.faculty.post",
      options: RATE_LIMIT_PRESETS.adminOps,
    });

    const body = (await request.json()) as Body;
    assertActionPayload(body, "faculty registry change", SECURITY_LIMITS.actionPayloadMaxBytes);

    switch (body.action) {
      case "add":
        return NextResponse.json(addFaculty(String(body.email ?? ""), body.name, adminEmail));
      case "addBulk": {
        const emails = Array.isArray(body.emails) ? body.emails.map(String) : [];
        const { config, added } = addFacultyBulk(emails, adminEmail);
        return NextResponse.json({ ...config, added });
      }
      case "setStatus":
        return NextResponse.json(setFacultyStatus(String(body.email ?? ""), body.status));
      case "setDepartments": {
        const ids = Array.isArray(body.departmentIds) ? body.departmentIds.map(String) : [];
        return NextResponse.json(setFacultyDepartments(String(body.email ?? ""), ids));
      }
      case "setBeta":
        return NextResponse.json(setBetaStatus(String(body.email ?? ""), body.betaStatus));
      case "upsertDept": {
        const label = String(body.label ?? "").trim();
        if (!label) return NextResponse.json({ error: "label required" }, { status: 400 });
        return NextResponse.json(upsertDepartment(label, body.id));
      }
      case "removeDept": {
        const id = String(body.id ?? "").trim();
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        return NextResponse.json(removeDepartment(id));
      }
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.admin.faculty.POST");
    return NextResponse.json({ error: appError.message || "Error" }, { status: 500 });
  }
}
