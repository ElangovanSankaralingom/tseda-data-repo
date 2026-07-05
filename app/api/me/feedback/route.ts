import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { facultyCanMutate } from "@/lib/admin/facultyRegistry";
import { apiUnauthorized, apiForbidden, apiError, apiSuccess } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";
import { NextResponse } from "next/server";
import { readFeedbackClaims, setFeedbackClaim } from "@/lib/awards/feedback";

/**
 * Student-feedback claim (Elan's S3 ruling): the faculty member selects
 * academic year + semester and enters the feedback percentage. Odd + even
 * average drives the student_feedback award tier. Auditable vs CAMU —
 * every claim stores who entered it and when.
 */

async function GETHandler(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "feedback.claim.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const store = await readFeedbackClaims(email);
  return apiSuccess({ years: store.years });
}

async function PUTHandler(req: Request) {
  const csrfBlocked = csrfGuard(req);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();
  if (!facultyCanMutate(email)) return apiForbidden();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "feedback.claim.put",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: { academicYear?: string; odd?: number | null; even?: number | null };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError("Invalid JSON body", { status: 400 });
  }

  try {
    const store = await setFeedbackClaim(
      email,
      String(body.academicYear ?? ""),
      { odd: body.odd, even: body.even },
      email,
    );
    return apiSuccess({ years: store.years });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid claim", { status: 400 });
  }
}

// Demo-mode universe wrapper — demo claims live in the demo universe and
// are wiped on exit.
export const GET = demoAware(GETHandler);
export const PUT = demoAware(PUTHandler);
