import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { getBetaStatus, setBetaStatus } from "@/lib/admin/facultyRegistry";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";

async function authedEmail(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  return email && email.endsWith(ALLOWED_EMAIL_SUFFIX) ? email : null;
}

function rateLimited(request: Request, email: string, action: string, mutation: boolean) {
  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action,
      options: mutation ? RATE_LIMIT_PRESETS.entryMutations : RATE_LIMIT_PRESETS.entryReads,
    });
    return null;
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json({ error: appError.message, code: appError.code }, { status: httpStatusForCode(appError.code) });
  }
}

async function GETHandler(request: Request) {
  const email = await authedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimited(request, email, "me.beta.get", false);
  if (limited) return limited;
  return NextResponse.json({ data: { status: getBetaStatus(email) } });
}

/** Request to join the beta program (none → requested). Members stay members. */
async function POSTHandler(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;
  const email = await authedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimited(request, email, "me.beta.post", true);
  if (limited) return limited;

  // Users can only *request* — never self-promote to member. Admins approve.
  const next = getBetaStatus(email) === "member" ? "member" : "requested";
  setBetaStatus(email, next);
  return NextResponse.json({ data: { status: next } });
}

/** Withdraw: cancel a pending request or leave the program (→ none). */
async function DELETEHandler(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;
  const email = await authedEmail();
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimited(request, email, "me.beta.delete", true);
  if (limited) return limited;

  setBetaStatus(email, "none");
  return NextResponse.json({ data: { status: "none" } });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const POST = demoAware(POSTHandler);
export const DELETE = demoAware(DELETEHandler);
