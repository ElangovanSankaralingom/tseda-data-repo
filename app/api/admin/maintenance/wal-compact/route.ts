import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canRunMaintenance } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { compactAllWals } from "@/lib/maintenance/walCompact";
import { appendMaintenanceLog } from "@/lib/maintenance/log";
import { enforceRateLimitForRequest } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canRunMaintenance(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.maintenance.wal-compact",
    options: { windowMs: 60_000, max: 3 },
    userEmail: email,
  });

  const startedAt = Date.now();
  const result = await compactAllWals();
  const durationMs = Date.now() - startedAt;

  void appendMaintenanceLog({
    ts: new Date().toISOString(),
    action: "wal-compact",
    actorEmail: email,
    durationMs,
    success: result.ok,
    summary: result.ok ? result.data : { error: result.error.code },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }
  return NextResponse.json({ data: result.data });
}
