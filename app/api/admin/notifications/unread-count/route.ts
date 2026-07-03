import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getAdminNotifications } from "@/lib/confirmations/adminNotificationStore";
import { filterVisibleAdminNotifications } from "@/lib/confirmations/adminNotificationHelpers";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

async function GETHandler(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessAdminConsole(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "admin.notifications.unread-count.get",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  // Scope to what this viewer can see (pure coordinators → only their categories'
  // edit requests), then count the unread ones for this viewer.
  const visible = filterVisibleAdminNotifications(await getAdminNotifications(), email);
  const count = visible.filter((n) => !n.readBy.includes(email)).length;
  return NextResponse.json({ count });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
