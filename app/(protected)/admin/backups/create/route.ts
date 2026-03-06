import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageBackups } from "@/lib/admin/roles";
import { createBackupZip } from "@/lib/backup/backupService";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { logger } from "@/lib/logger";
import { enforceRateLimitForRequest } from "@/lib/security/rateLimit";
import { toUserMessage } from "@/lib/errors";
import { adminBackups, signin } from "@/lib/entryNavigation";

const BACKUP_RATE_LIMIT = { windowMs: 10 * 60_000, max: 3 } as const;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");
  if (!actorEmail) {
    return NextResponse.redirect(new URL(signin(), request.url), { status: 302 });
  }
  if (!canManageBackups(actorEmail)) {
    return NextResponse.redirect(new URL(adminBackups(), request.url), { status: 302 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.backups.create",
    options: BACKUP_RATE_LIMIT,
    userEmail: actorEmail,
  });

  const startedAt = Date.now();
  const result = await createBackupZip();
  if (!result.ok) {
    logger.warn({
      event: "backup.create.failed",
      actorEmail,
      durationMs: Date.now() - startedAt,
      errorCode: result.error.code,
    });
    const redirect = new URL(adminBackups(), request.url);
    redirect.searchParams.set("status", "error");
    redirect.searchParams.set("message", toUserMessage(result.error));
    return NextResponse.redirect(redirect, { status: 302 });
  }

  logger.info({
    event: "backup.create.success",
    actorEmail,
    filename: result.data.filename,
    sizeBytes: result.data.sizeBytes,
    durationMs: Date.now() - startedAt,
  });

  const redirect = new URL(adminBackups(), request.url);
  redirect.searchParams.set("status", "ok");
  redirect.searchParams.set("message", `Created ${result.data.filename}`);
  return NextResponse.redirect(redirect, { status: 302 });
}
