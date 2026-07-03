import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { markAdminAsRead } from "@/lib/confirmations/adminNotificationStore";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { csrfGuard } from "@/lib/security/csrf";

async function PUTHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessAdminConsole(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "admin.notifications.id.read.put",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const { id } = await params;
  const ok = await markAdminAsRead(email, id);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const PUT = demoAware(PUTHandler);
