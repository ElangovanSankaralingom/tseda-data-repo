import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { validateCsrf } from "@/lib/security/csrf";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAnalytics } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getCachedAnalytics } from "@/lib/analytics/cache";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

async function GETHandler(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canViewAnalytics(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.analytics",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  const result = await getCachedAnalytics(false);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data });
}

async function POSTHandler(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) return NextResponse.json({ error: csrfError }, { status: 403 });
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canViewAnalytics(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.analytics.refresh",
    options: { windowMs: 300_000, max: 3 },
    userEmail: email,
  });

  const result = await getCachedAnalytics(true);
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const POST = demoAware(POSTHandler);
