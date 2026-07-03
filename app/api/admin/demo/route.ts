import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { isMasterAdmin } from "@/lib/admin/roles";
import { apiUnauthorized, apiForbidden, apiError, apiSuccess } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";
import { NextResponse } from "next/server";
import { getDemoState, setDemoRoster } from "@/lib/demo/state";

/**
 * Demo mode — roster administration (MASTER ADMIN only, per the feature
 * decision: "usable by the admin and faculty the admin assigns"). GET returns
 * roster + who is currently active; PUT replaces the roster. Removing a
 * faculty member who is mid-demo exits them and wipes their demo data.
 */

async function requireMasterAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !isMasterAdmin(email)) return null;
  return email;
}

async function GETHandler(req: Request) {
  const email = await requireMasterAdmin();
  if (!email) {
    const session = await getServerSession(authOptions);
    return session?.user?.email ? apiForbidden() : apiUnauthorized();
  }

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "demo.roster.get",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const state = await getDemoState();
  return apiSuccess({
    roster: state.roster,
    active: Object.entries(state.active).map(([activeEmail, meta]) => ({
      email: activeEmail,
      activatedAt: meta.activatedAt,
    })),
  });
}

async function PUTHandler(req: Request) {
  const csrfBlocked = csrfGuard(req);
  if (csrfBlocked) return csrfBlocked;

  const email = await requireMasterAdmin();
  if (!email) {
    const session = await getServerSession(authOptions);
    return session?.user?.email ? apiForbidden() : apiUnauthorized();
  }

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "demo.roster.put",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: { roster?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError("Invalid JSON body", { status: 400 });
  }

  if (!Array.isArray(body.roster) || body.roster.some((e) => typeof e !== "string")) {
    return apiError("roster must be an array of emails", { status: 400 });
  }

  const state = await setDemoRoster(body.roster as string[], email);
  return apiSuccess({
    roster: state.roster,
    active: Object.entries(state.active).map(([activeEmail, meta]) => ({
      email: activeEmail,
      activatedAt: meta.activatedAt,
    })),
  });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const PUT = demoAware(PUTHandler);
