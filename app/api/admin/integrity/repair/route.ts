import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listUsers,
  repairUserCategoryStore,
  rebuildUserIndex,
} from "@/lib/admin/integrity";
import { canRunIntegrityTools } from "@/lib/admin/roles";
import { CATEGORY_KEYS } from "@/lib/categories";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { appendMaintenanceLog } from "@/lib/maintenance/log";
import { enforceRateLimitForRequest } from "@/lib/security/rateLimit";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canRunIntegrityTools(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.integrity.repair",
    options: { windowMs: 300_000, max: 2 },
    userEmail: email,
  });

  const startedAt = Date.now();
  const usersResult = await listUsers();
  if (!usersResult.ok) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }

  let totalFixes = 0;
  let totalFiles = 0;
  let totalBackups = 0;
  let indexRebuilds = 0;
  let failures = 0;

  for (const userEmail of usersResult.data) {
    for (const category of CATEGORY_KEYS) {
      const result = await repairUserCategoryStore(userEmail, category, { backup: true });
      if (result.ok) {
        totalFixes += result.data.fixedIssues.length;
        totalFiles += result.data.filesTouched.length;
        totalBackups += result.data.backupsCreated.length;
      } else {
        failures += 1;
      }
    }

    const rebuildResult = await rebuildUserIndex(userEmail);
    if (rebuildResult.ok) {
      indexRebuilds += 1;
    } else {
      failures += 1;
    }
  }

  const durationMs = Date.now() - startedAt;
  const data = {
    usersProcessed: usersResult.data.length,
    totalFixes,
    totalFiles,
    totalBackups,
    indexRebuilds,
    failures,
  };

  void appendMaintenanceLog({
    ts: new Date().toISOString(),
    action: "integrity-repair-all",
    actorEmail: email,
    durationMs,
    success: failures === 0,
    summary: data,
  });

  return NextResponse.json({ data });
}
