import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dismissNotification } from "@/lib/confirmations/notificationStore";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function DELETEHandler(request: Request, context: RouteContext) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "me.notifications.id.delete",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const { id } = await context.params;
  const found = await dismissNotification(email, id);
  if (!found) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const DELETE = demoAware(DELETEHandler);
