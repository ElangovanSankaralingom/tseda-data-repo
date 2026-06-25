import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers } from "@/lib/admin/integrity";
import { canExport } from "@/lib/admin/roles";
import { getCoordinatorScope } from "@/lib/admin/coordinators";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  buildExportRows,
  generateCsvText,
  generateXlsxBuffer,
  CSV_BOM,
} from "@/lib/export/exportService";
import {
  getFormatTemplateById,
  listTemplatesForViewer,
} from "@/lib/export/formatTemplates";
import { logger } from "@/lib/logger";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

/**
 * Download all faculty's data for a saved format's category, in that format's
 * column order. Scope: master/export-admin or a coordinator the format is visible
 * to (their own / assigned). Always exports all faculty in the format's category.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ formatId: string }> }
) {
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !(canExport(email) || getCoordinatorScope(email).export)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { formatId } = await params;
  const template = getFormatTemplateById(formatId);
  // The viewer must actually be allowed to see/use this format.
  if (!template || !listTemplatesForViewer(email).some((t) => t.id === formatId)) {
    return NextResponse.json({ error: "Format not found" }, { status: 404 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.export.format",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  const url = new URL(request.url);
  const fmt = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

  const usersResult = await listUsers();
  const userEmails = usersResult.ok ? usersResult.data : [];

  const headers: string[] = [];
  const rows: Array<Array<string | number | boolean>> = [];
  for (const userEmail of userEmails) {
    const result = await buildExportRows(userEmail, template.category, template.columns, {});
    if (!result.ok) continue;
    if (headers.length === 0) headers.push(...result.data.headers);
    rows.push(...result.data.rows);
  }

  const nowStamp = new Date().toISOString().slice(0, 10);
  const baseName = `tseda-${template.id}-${nowStamp}`;

  logger.info({
    event: "admin.export.format",
    actorEmail: email,
    formatId: template.id,
    category: template.category,
    format: fmt,
    count: rows.length,
    durationMs: Date.now() - startedAt,
  });

  if (fmt === "csv") {
    const csv = generateCsvText(headers, rows);
    if (!csv.ok) return NextResponse.json({ error: "CSV generation failed" }, { status: 500 });
    return new NextResponse(CSV_BOM + csv.data, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.csv"`,
      },
    });
  }

  const xlsx = generateXlsxBuffer(headers, rows, template.label);
  if (!xlsx.ok) return NextResponse.json({ error: "XLSX generation failed" }, { status: 500 });
  return new NextResponse(new Uint8Array(xlsx.data), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
    },
  });
}
