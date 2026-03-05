import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  buildExportRows,
  generateCsvText,
  generateXlsxBuffer,
  parseExportCategory,
  parseExportFieldKeys,
  parseExportStatuses,
  type ExportFormat,
} from "@/lib/export/exportService";
import { AppError, normalizeError, toUserMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

function parseDateStart(value: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(`${trimmed}T00:00:00.000Z`);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function parseDateEnd(value: string | null) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(`${trimmed}T23:59:59.999Z`);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function parseFormat(value: string | null): ExportFormat {
  return String(value ?? "").trim().toLowerCase() === "csv" ? "csv" : "xlsx";
}

function safeFileName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFieldQuery(searchParams: URLSearchParams) {
  const all = new Array<string>();
  for (const raw of searchParams.getAll("fields")) {
    if (!raw.trim()) continue;
    all.push(...parseExportFieldKeys(raw));
  }
  return Array.from(new Set(all));
}

export async function GET(request: Request) {
  const startedAt = Date.now();
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");
  if (!isMasterAdmin(actorEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      action: "admin.export.entries",
      options: RATE_LIMIT_PRESETS.adminOps,
      userEmail: actorEmail,
    });

    const url = new URL(request.url);
    const targetEmail = normalizeEmail(url.searchParams.get("userEmail") ?? "");
    if (!targetEmail) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "userEmail is required.",
      });
    }

    const categoryRaw = url.searchParams.get("category") ?? "";
    const category = parseExportCategory(categoryRaw);
    if (!category) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid category.",
      });
    }

    const fields = parseFieldQuery(url.searchParams);
    const format = parseFormat(url.searchParams.get("format"));
    const statuses = parseExportStatuses(url.searchParams.get("statuses") ?? "");
    const fromISO = parseDateStart(url.searchParams.get("from"));
    const toISO = parseDateEnd(url.searchParams.get("to"));

    const rowsResult = await buildExportRows(targetEmail, category, fields, {
      statuses,
      fromISO,
      toISO,
    });
    if (!rowsResult.ok) {
      throw rowsResult.error;
    }

    const nowStamp = new Date().toISOString().slice(0, 10);
    const safeEmail = safeFileName(targetEmail) || "user";
    const categorySlug = category === "all" ? "all-categories" : category;
    const baseName = `entries-${safeEmail}-${categorySlug}-${nowStamp}`;

    if (format === "csv") {
      const csvResult = generateCsvText(rowsResult.data.headers, rowsResult.data.rows);
      if (!csvResult.ok) {
        throw csvResult.error;
      }
      logger.info({
        event: "admin.export.download",
        actorEmail,
        userEmail: targetEmail,
        category: categorySlug,
        format: "csv",
        count: rowsResult.data.rows.length,
        durationMs: Date.now() - startedAt,
      });
      return new NextResponse(csvResult.data, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${baseName}.csv"`,
        },
      });
    }

    const xlsxResult = generateXlsxBuffer(
      rowsResult.data.headers,
      rowsResult.data.rows,
      `Entries ${categorySlug}`
    );
    if (!xlsxResult.ok) {
      throw xlsxResult.error;
    }
    logger.info({
      event: "admin.export.download",
      actorEmail,
      userEmail: targetEmail,
      category: categorySlug,
      format: "xlsx",
      count: rowsResult.data.rows.length,
      durationMs: Date.now() - startedAt,
    });
    return new NextResponse(new Uint8Array(xlsxResult.data), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${baseName}.xlsx"`,
      },
    });
  } catch (error) {
    const normalized = normalizeError(error);
    logger.warn({
      event: "admin.export.failed",
      actorEmail,
      errorCode: normalized.code,
      durationMs: Date.now() - startedAt,
    });
    const status =
      normalized.code === "UNAUTHORIZED" || normalized.code === "FORBIDDEN"
        ? 403
        : normalized.code === "NOT_FOUND"
          ? 404
          : normalized.code === "RATE_LIMITED"
            ? 429
            : normalized.code === "PAYLOAD_TOO_LARGE"
              ? 413
              : 400;
    return NextResponse.json(
      { error: toUserMessage(normalized), code: normalized.code },
      { status }
    );
  }
}
