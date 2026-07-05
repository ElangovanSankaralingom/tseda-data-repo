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
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import {
  listScholarsWhoTagged,
  readResearchProfile,
  writeResearchProfile,
} from "@/lib/research/researchProfile";
import { resolveFacultyName } from "@/lib/admin/facultyRegistry";

/**
 * Research profile (Ph.D. milestones) — self-managed profile section that
 * feeds the phd_awarded / phd_guided award metrics by viva-date year.
 * Universe-scoped store (demo-safe), sanitized on write.
 */

async function GETHandler(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "research.profile.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  // Profile + the derived network edge: scholars who tagged YOU as their
  // internal supervisor (helps supervisors keep their guided list complete).
  const [profile, taggedYou] = await Promise.all([
    readResearchProfile(email),
    listScholarsWhoTagged(email),
  ]);
  return apiSuccess({
    profile,
    network: {
      taggedYouAsSupervisor: taggedYou.map((tag) => ({
        ...tag,
        facultyName: resolveFacultyName(tag.facultyEmail) || tag.facultyEmail,
      })),
    },
  });
}

async function PUTHandler(req: Request) {
  const csrfBlocked = csrfGuard(req);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();
  if (!facultyCanMutate(email)) {
    return apiForbidden();
  }

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "research.profile.put",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
    assertActionPayload(body as Record<string, unknown>, "research profile", SECURITY_LIMITS.actionPayloadMaxBytes);
  } catch (error) {
    const appError = normalizeError(error);
    if (appError.code === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
    }
    return apiError("Invalid JSON body", { status: 400 });
  }

  const saved = await writeResearchProfile(email, body);
  return apiSuccess({ profile: saved });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const PUT = demoAware(PUTHandler);
