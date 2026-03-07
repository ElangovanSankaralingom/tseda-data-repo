import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers } from "@/lib/admin/integrity";
import { canExport } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  buildExportRows,
  parseExportCategory,
  parseExportStatuses,
} from "@/lib/export/exportService";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");
  if (!actorEmail || !canExport(actorEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.export.preview",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: actorEmail,
  });

  const url = new URL(request.url);
  const userEmail = normalizeEmail(url.searchParams.get("userEmail") ?? "");
  const allUsers = url.searchParams.get("allUsers") === "true";
  const categoryRaw = url.searchParams.get("category") ?? "all";
  const category = parseExportCategory(categoryRaw) ?? "all";
  const statuses = parseExportStatuses(url.searchParams.get("statuses") ?? "");
  const fromISO = url.searchParams.get("from") || undefined;
  const toISO = url.searchParams.get("to") || undefined;

  const userEmails: string[] = [];
  if (allUsers) {
    const result = await listUsers();
    if (result.ok) userEmails.push(...result.data);
  } else if (userEmail) {
    userEmails.push(userEmail);
  }

  let totalRecords = 0;
  const categoryBreakdown: Record<string, number> = {};
  const statusBreakdown: Record<string, number> = {};

  for (const email of userEmails) {
    const result = await buildExportRows(email, category, [], {
      statuses: statuses.length > 0 ? statuses : undefined,
      fromISO,
      toISO,
    });
    if (!result.ok) continue;

    totalRecords += result.data.rows.length;
    for (const key of result.data.categoryKeys) {
      categoryBreakdown[key] = (categoryBreakdown[key] ?? 0) +
        result.data.rows.length; // Approximate; per-user we get all
    }
    for (const [status, count] of Object.entries(result.data.countsByStatus)) {
      if (count > 0) {
        statusBreakdown[status] = (statusBreakdown[status] ?? 0) + count;
      }
    }
  }

  return NextResponse.json({
    data: {
      recordCount: totalRecords,
      userCount: userEmails.length,
      categoryBreakdown,
      statusBreakdown,
    },
  });
}
