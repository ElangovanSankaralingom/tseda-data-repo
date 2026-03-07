import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers, migrateUserData } from "@/lib/admin/integrity";
import { canRunMaintenance } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
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
    action: "admin.maintenance.migrate",
    options: { windowMs: 300_000, max: 2 },
    userEmail: email,
  });

  const startedAt = Date.now();
  const usersResult = await listUsers();
  if (!usersResult.ok) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }

  let succeeded = 0;
  let failed = 0;
  let totalFilesTouched = 0;
  for (const userEmail of usersResult.data) {
    const result = await migrateUserData(userEmail);
    if (result.ok) {
      succeeded += 1;
      totalFilesTouched += result.data.filesTouched.length;
    } else {
      failed += 1;
    }
  }

  const durationMs = Date.now() - startedAt;
  const data = {
    usersProcessed: usersResult.data.length,
    succeeded,
    failed,
    totalFilesTouched,
  };

  void appendMaintenanceLog({
    ts: new Date().toISOString(),
    action: "migrate",
    actorEmail: email,
    durationMs,
    success: failed === 0,
    summary: data,
  });

  return NextResponse.json({ data });
}
