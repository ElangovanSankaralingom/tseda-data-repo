import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { canAccessSettings } from "@/lib/admin/roles";
import { apiUnauthorized, apiForbidden, apiError, apiSuccess } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";
import { NextResponse } from "next/server";
import { listEffectiveAwardMetrics, setAwardPointsOverride } from "@/lib/awards/config";

/**
 * Admin-adjustable award points. The registry holds the document defaults;
 * this endpoint reads/writes the overrides (settings-gated, same access as
 * the settings page). The admin UI screen is roadmap item #2 — the API is
 * the contract it will consume.
 */

async function requireSettingsAdmin(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return null;
  if (!canAccessSettings(email)) return null;
  return email;
}

export async function GET(req: Request) {
  const email = await requireSettingsAdmin();
  if (!email) return apiForbidden();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "awards.points.get",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  return apiSuccess({ metrics: await listEffectiveAwardMetrics() });
}

export async function PUT(req: Request) {
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
      action: "awards.points.put",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: { metricId?: string; points?: number; tiers?: Record<string, number>; reset?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return apiError("Invalid JSON body", { status: 400 });
  }

  const metricId = String(body.metricId ?? "").trim();
  if (!metricId) return apiError("metricId required", { status: 400 });

  try {
    await setAwardPointsOverride(
      metricId,
      body.reset ? null : { points: body.points, tiers: body.tiers },
      email,
    );
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Invalid override", { status: 400 });
  }

  return apiSuccess({ metrics: await listEffectiveAwardMetrics() });
}
