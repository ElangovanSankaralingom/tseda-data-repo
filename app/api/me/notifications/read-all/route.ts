import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { markAllAsRead } from "@/lib/confirmations/notificationStore";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";

async function PUTHandler(request: Request) {
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
      action: "me.notifications.read-all.put",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const count = await markAllAsRead(email);
  return NextResponse.json({ marked: count });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const PUT = demoAware(PUTHandler);
