import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { apiUnauthorized, cachedApiSuccess, apiError } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { NextResponse } from "next/server";
import {
  computeFacultyAwardScore,
  listFacultyAcademicYears,
} from "@/lib/awards/scoring";

/**
 * Self-view award score: the faculty member's own points for one academic
 * year (?year=), plus the years available from their entries. Visibility is
 * SELF + ADMIN by design (admins use /api/admin/awards) — no peer access.
 */
async function GETHandler(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "awards.self.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const years = await listFacultyAcademicYears(email);
  const url = new URL(req.url);
  const requested = url.searchParams.get("year")?.trim();
  const year = requested || years[0] || "";

  if (!year) {
    return cachedApiSuccess({ years, score: null }, 30);
  }
  if (requested && !years.includes(requested)) {
    return apiError("Unknown academic year for this account.", { status: 400 });
  }

  const score = await computeFacultyAwardScore(email, year);
  return cachedApiSuccess({ years, score }, 30);
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
