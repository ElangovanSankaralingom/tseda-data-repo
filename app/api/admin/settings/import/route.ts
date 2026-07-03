import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { validateCsrf } from "@/lib/security/csrf";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { importSettings } from "@/lib/settings/store";

async function POSTHandler(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) return NextResponse.json({ error: csrfError }, { status: 403 });
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessSettings(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.settings.import",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const settings = body.settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return NextResponse.json({ error: "Missing 'settings' object" }, { status: 400 });
  }

  const result = await importSettings(settings as Record<string, unknown>, email);
  return NextResponse.json({ data: result });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const POST = demoAware(POSTHandler);
