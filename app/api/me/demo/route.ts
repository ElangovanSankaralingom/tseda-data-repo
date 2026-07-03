import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { apiUnauthorized, apiForbidden, apiError, apiSuccess } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";
import { NextResponse } from "next/server";
import {
  enterDemoMode,
  exitDemoMode,
  isDemoActive,
  isDemoParticipant,
} from "@/lib/demo/state";

/**
 * Demo mode — self toggle. GET reports whether the signed-in user may use
 * demo mode and whether they are in it; POST enters/exits. Exiting wipes the
 * user's demo data server-side (lib/demo/state.ts). Permission is enforced
 * HERE, server-side — a spoofed client flag can never enter the mode.
 */

async function GETHandler(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "demo.state.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  return apiSuccess({
    permitted: await isDemoParticipant(email),
    active: await isDemoActive(email),
  });
}

async function POSTHandler(req: Request) {
  const csrfBlocked = csrfGuard(req);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "demo.state.toggle",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: { action?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError("Invalid JSON body", { status: 400 });
  }

  const action = String(body.action ?? "").trim();
  if (action === "enter") {
    if (!(await isDemoParticipant(email))) return apiForbidden();
    await enterDemoMode(email);
    return apiSuccess({ active: true });
  }
  if (action === "exit") {
    await exitDemoMode(email);
    return apiSuccess({ active: false });
  }
  return apiError("action must be \"enter\" or \"exit\"", { status: 400 });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
// (Safe here: the demo state store is SHARED and wipe paths are computed
// from the real roots regardless of context.)
export const GET = demoAware(GETHandler);
export const POST = demoAware(POSTHandler);
