import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { exportSettings } from "@/lib/settings/store";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessSettings(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.settings.export",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  const data = await exportSettings();
  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    exportedBy: email,
    settings: data,
  });
}
