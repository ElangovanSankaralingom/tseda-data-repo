import { demoAware } from "@/lib/demo/demoAware";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canExport } from "@/lib/admin/roles";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getExportableFields, parseExportCategory } from "@/lib/export/exportService";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

async function GETHandler(
  request: Request,
  { params }: { params: Promise<{ category: string }> }
) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canExport(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "admin.export.fields.get",
      options: RATE_LIMIT_PRESETS.adminOps,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const { category } = await params;
  const parsed = parseExportCategory(category);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  return NextResponse.json({ data: getExportableFields(parsed) });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
