import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canManageBackups } from "@/lib/admin/roles";
import { readBackupFile, streamBackupZip } from "@/lib/backup/backupService";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { logger } from "@/lib/logger";
import { enforceRateLimitForRequest } from "@/lib/security/rateLimit";
import { toUserMessage } from "@/lib/errors";

const BACKUP_RATE_LIMIT = { windowMs: 10 * 60_000, max: 3 } as const;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");
  if (!canManageBackups(actorEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.backups.download",
    options: BACKUP_RATE_LIMIT,
    userEmail: actorEmail,
  });

  const startedAt = Date.now();
  const url = new URL(request.url);
  const filename = url.searchParams.get("filename");

  const result = filename
    ? await readBackupFile(filename)
    : await streamBackupZip();

  if (!result.ok) {
    logger.warn({
      event: "backup.download.failed",
      actorEmail,
      durationMs: Date.now() - startedAt,
      errorCode: result.error.code,
    });
    const status =
      result.error.code === "NOT_FOUND"
        ? 404
        : result.error.code === "FORBIDDEN"
          ? 403
          : result.error.code === "RATE_LIMITED"
            ? 429
            : 400;
    return NextResponse.json({ error: toUserMessage(result.error) }, { status });
  }

  logger.info({
    event: "backup.download",
    actorEmail,
    filename: result.data.filename,
    sizeBytes: result.data.sizeBytes,
    durationMs: Date.now() - startedAt,
  });

  return new NextResponse(new Uint8Array(result.data.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${result.data.filename}"`,
      "Content-Length": String(result.data.sizeBytes),
    },
  });
}
