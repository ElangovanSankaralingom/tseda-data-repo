import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { canAccessSettings } from "@/lib/admin/roles";
import { apiUnauthorized, apiForbidden, apiError, apiSuccess } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";
import { NextResponse } from "next/server";
import { readInterviewPointsForYear, setInterviewAward } from "@/lib/awards/interview";

/**
 * Committee-awarded points (roadmap #16). Same gate as the points-config
 * endpoint (settings-tier): entering committee scores changes award
 * outcomes exactly like changing point values does, so it takes the same
 * trust level — NOT the broader read-only console access.
 */

async function requireSettingsAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return null;
  if (!canAccessSettings(email)) return null;
  return email;
}

async function GETHandler(req: Request) {
  const email = await requireSettingsAdmin();
  if (!email) return apiForbidden();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "awards.interview.get",
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
  const year = String(url.searchParams.get("year") ?? "").trim();
  if (!year) return apiError("year query param required", { status: 400 });

  return apiSuccess({ awards: await readInterviewPointsForYear(target, year) });
}

async function PUTHandler(req: Request) {
  const csrfBlocked = csrfGuard(req);
  if (csrfBlocked) return csrfBlocked;

  const email = await requireSettingsAdmin();
  if (!email) {
    const session = await getServerSession(authOptions);
    return session?.user?.email ? apiForbidden() : apiUnauthorized();
  }

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "awards.interview.put",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: {
    email?: string;
    academicYear?: string;
    metricId?: string;
    points?: number;
    note?: string;
    reset?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError("Invalid JSON body", { status: 400 });
  }

  const target = normalizeEmail(body.email ?? "");
  if (!target) return apiError("email required", { status: 400 });
  const metricId = String(body.metricId ?? "").trim();
  if (!metricId) return apiError("metricId required", { status: 400 });

  try {
    const awards = await setInterviewAward(
      target,
      String(body.academicYear ?? ""),
      metricId,
      body.reset ? null : { points: Number(body.points), note: body.note },
      email,
    );
    return apiSuccess({ awards });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid award", { status: 400 });
  }
}

// Demo-mode universe wrapper — committee practice runs inside demo write to
// the demo universe and are wiped on exit.
export const GET = demoAware(GETHandler);
export const PUT = demoAware(PUTHandler);
