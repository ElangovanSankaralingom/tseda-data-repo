import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canRunIntegrityTools } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { runFullScan } from "@/lib/integrity/report";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canRunIntegrityTools(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.integrity.scan",
    options: RATE_LIMIT_PRESETS.adminMaintenance,
    userEmail: email,
  });

  const result = await runFullScan();
  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data });
}
