import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { resetAllSettings } from "@/lib/settings/store";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessSettings(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.settings.resetAll",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // no body
  }

  if (!body.confirmed) {
    return NextResponse.json(
      { error: "Reset all requires confirmation", requiresConfirmation: true },
      { status: 409 }
    );
  }

  try {
    await resetAllSettings(email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
