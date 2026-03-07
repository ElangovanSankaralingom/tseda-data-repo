import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canViewAudit } from "@/lib/admin/roles";
import { getRecentAuditEvents, getAuditStats } from "@/lib/admin/auditLog";
import type { AuditAction } from "@/lib/admin/auditLog";
import { isCategoryKey } from "@/lib/categories";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

function isWalAction(value: string): value is AuditAction {
  const valid = new Set([
    "CREATE", "UPDATE", "DELETE", "REQUEST_EDIT", "GRANT_EDIT",
    "UPLOAD_ADD", "UPLOAD_REMOVE", "UPLOAD_REPLACE",
  ]);
  return valid.has(value);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canViewAudit(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.audit",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode");

  if (mode === "stats") {
    const result = await getAuditStats();
    if (!result.ok) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ data: result.data });
  }

  const userEmail = url.searchParams.get("userEmail") || undefined;
  const actorEmail = url.searchParams.get("actorEmail") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const action = url.searchParams.get("action") || undefined;
  const entryId = url.searchParams.get("entryId") || undefined;
  const fromISO = url.searchParams.get("from") || undefined;
  const toISO = url.searchParams.get("to") || undefined;
  const limitStr = url.searchParams.get("limit");
  const limit = limitStr ? Math.max(1, Math.min(500, Number.parseInt(limitStr, 10) || 100)) : 200;

  const result = await getRecentAuditEvents({
    limit,
    userEmail,
    actorEmail,
    category: category && isCategoryKey(category) ? category : undefined,
    action: action && isWalAction(action) ? action : undefined,
    entryId,
    fromISO,
    toISO,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ data: result.data });
}
