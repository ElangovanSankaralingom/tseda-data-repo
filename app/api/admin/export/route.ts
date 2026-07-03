import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

async function GETHandler(request: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = session?.user?.email?.toLowerCase();
  if (!canExport(actorEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: actorEmail,
      action: "admin.export.get",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  return NextResponse.json(
    {
      error: "Deprecated endpoint. Use /api/admin/export/entries with explicit filters.",
    },
    { status: 410 }
  );
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
