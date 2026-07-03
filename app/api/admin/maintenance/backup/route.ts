import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { validateCsrf } from "@/lib/security/csrf";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canRunMaintenance } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { runNightlyBackup } from "@/lib/jobs/nightly";
import { appendMaintenanceLog } from "@/lib/maintenance/log";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

async function POSTHandler(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) return NextResponse.json({ error: csrfError }, { status: 403 });
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canRunMaintenance(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.maintenance.backup",
    options: RATE_LIMIT_PRESETS.adminMaintenance,
    userEmail: email,
  });

  const startedAt = Date.now();
  const result = await runNightlyBackup();
  const durationMs = Date.now() - startedAt;

  void appendMaintenanceLog({
    ts: new Date().toISOString(),
    action: "backup",
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

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const POST = demoAware(POSTHandler);
