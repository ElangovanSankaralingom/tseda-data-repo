import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { apiUnauthorized, apiForbidden, apiError, apiSuccess } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { NextResponse } from "next/server";
import {
  computeFacultyAwardScore,
  listFacultyAcademicYears,
} from "@/lib/awards/scoring";

/** Admin view: any faculty member's award score (needed to run the award). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();
  if (!canAccessAdminConsole(email)) return apiForbidden();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "awards.admin.get",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const url = new URL(req.url);
  const target = normalizeEmail(url.searchParams.get("email") ?? "");
  if (!target) return apiError("email query param required", { status: 400 });

  const years = await listFacultyAcademicYears(target);
  const year = url.searchParams.get("year")?.trim() || years[0] || "";
  if (!year) return apiSuccess({ years, score: null });

  const score = await computeFacultyAwardScore(target, year);
  return apiSuccess({ years, score });
}
