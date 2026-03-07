import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers } from "@/lib/admin/integrity";
import { canExport } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  buildExportRows,
  generateCsvText,
  generateJsonText,
  generateXlsxBuffer,
  CSV_BOM,
} from "@/lib/export/exportService";
import { getTemplateById } from "@/lib/export/templates";
import { appendExportHistory } from "@/lib/export/history";
import { logger } from "@/lib/logger";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");
  if (!actorEmail || !canExport(actorEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.export.template",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: actorEmail,
  });

  const { templateId } = await params;
  const template = getTemplateById(templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  const { config } = template;

  // For all-users templates, iterate over all users
  const usersResult = config.allUsers ? await listUsers() : null;
  const userEmails = usersResult?.ok ? usersResult.data : [actorEmail];

  const allHeaders: string[] = [];
  const allRows: Array<Array<string | number | boolean>> = [];
  const countsByStatus: Record<string, number> = {};

  for (const userEmail of userEmails) {
    const result = await buildExportRows(userEmail, config.category, [], config.options);
    if (!result.ok) continue;

    if (allHeaders.length === 0) {
      allHeaders.push(...result.data.headers);
    }
    allRows.push(...result.data.rows);

    for (const [status, count] of Object.entries(result.data.countsByStatus)) {
      countsByStatus[status] = (countsByStatus[status] ?? 0) + count;
    }
  }

  const nowStamp = new Date().toISOString().slice(0, 10);
  const baseName = `tseda-${template.id}-${nowStamp}`;
  const durationMs = Date.now() - startedAt;

  let body: BodyInit;
  let contentType: string;
  let ext: string;

  if (config.format === "csv") {
    const csvResult = generateCsvText(allHeaders, allRows);
    if (!csvResult.ok) return NextResponse.json({ error: "CSV generation failed" }, { status: 500 });
    body = CSV_BOM + csvResult.data;
    contentType = "text/csv; charset=utf-8";
    ext = "csv";
  } else if (config.format === "json") {
    const jsonResult = generateJsonText(allHeaders, allRows, { category: String(config.category) });
    if (!jsonResult.ok) return NextResponse.json({ error: "JSON generation failed" }, { status: 500 });
    body = jsonResult.data;
    contentType = "application/json; charset=utf-8";
    ext = "json";
  } else {
    const xlsxResult = generateXlsxBuffer(allHeaders, allRows, template.name);
    if (!xlsxResult.ok) return NextResponse.json({ error: "XLSX generation failed" }, { status: 500 });
    body = new Uint8Array(xlsxResult.data);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  }

  const fileSize = typeof body === "string"
    ? Buffer.byteLength(body, "utf8")
    : (body as Uint8Array).byteLength;

  void appendExportHistory({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    format: ext,
    scope: config.allUsers ? "all-users" : "single-user",
    category: String(config.category),
    recordCount: allRows.length,
    fileSize,
    requestedBy: actorEmail,
    templateId: template.id,
    durationMs,
  });

  logger.info({
    event: "admin.export.template",
    actorEmail,
    templateId: template.id,
    format: ext,
    count: allRows.length,
    durationMs,
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${baseName}.${ext}"`,
    },
  });
}
