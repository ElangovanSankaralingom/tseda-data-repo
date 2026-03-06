import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canRunMaintenance } from "@/lib/admin/roles";
import { normalizeError, toUserMessage } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { runNightlyMaintenance } from "@/lib/jobs/nightly";
import { logger } from "@/lib/logger";
import { adminMaintenance, signin } from "@/lib/navigation";
import { enforceRateLimitForRequest } from "@/lib/security/rateLimit";

const MAINTENANCE_RATE_LIMIT = { windowMs: 60 * 60_000, max: 2 } as const;

function withStatusUrl(request: Request, status: "ok" | "warn" | "error", message: string) {
  const redirect = new URL(adminMaintenance(), request.url);
  redirect.searchParams.set("status", status);
  redirect.searchParams.set("message", message);
  return redirect;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");

  if (!actorEmail) {
    return NextResponse.redirect(new URL(signin(), request.url), { status: 302 });
  }
  if (!canRunMaintenance(actorEmail)) {
    return NextResponse.redirect(new URL(adminMaintenance(), request.url), { status: 302 });
  }

  const startedAt = Date.now();
  try {
    enforceRateLimitForRequest({
      request,
      action: "admin.maintenance.run",
      options: MAINTENANCE_RATE_LIMIT,
      userEmail: actorEmail,
    });

    const result = await runNightlyMaintenance();
    if (!result.ok) {
      logger.warn({
        event: "admin.maintenance.manual.failed",
        actorEmail,
        errorCode: result.error.code,
        durationMs: Date.now() - startedAt,
      });
      return NextResponse.redirect(
        withStatusUrl(request, "error", toUserMessage(result.error)),
        { status: 302 }
      );
    }

    logger.info({
      event: "admin.maintenance.manual.success",
      actorEmail,
      durationMs: Date.now() - startedAt,
      status: result.data.overallSuccess ? "success" : "partial_failure",
    });

    const message = result.data.overallSuccess
      ? "Maintenance completed successfully."
      : "Maintenance completed with partial failures. Review the summary below.";

    return NextResponse.redirect(
      withStatusUrl(request, result.data.overallSuccess ? "ok" : "warn", message),
      { status: 302 }
    );
  } catch (error) {
    const normalized = normalizeError(error);
    logger.warn({
      event: "admin.maintenance.manual.rejected",
      actorEmail,
      errorCode: normalized.code,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.redirect(
      withStatusUrl(request, "error", toUserMessage(normalized)),
      { status: 302 }
    );
  }
}
