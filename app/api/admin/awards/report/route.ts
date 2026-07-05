import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { apiUnauthorized, apiForbidden, apiError } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { NextResponse } from "next/server";
import { buildAppraisalDocx } from "@/lib/awards/report";

/**
 * Admin appraisal download: the award chair pulls ANY faculty member's
 * filled appraisal document — same builder as the self-service route, so
 * what the committee reads is exactly what the faculty member would
 * download themselves.
 */

async function GETHandler(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();
  if (!canAccessAdminConsole(email)) return apiForbidden();

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "awards.admin.report.get",
      // Document generation is heavier than a read — mutation-tier limit.
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const url = new URL(req.url);
  const target = normalizeEmail(url.searchParams.get("email") ?? "");
  if (!target) return apiError("email query param required", { status: 400 });
  const year = String(url.searchParams.get("year") ?? "").trim();
  if (!/^Academic Year \d{4}-\d{4}$/.test(year)) {
    return apiError("year must look like \"Academic Year 2025-2026\"", { status: 400 });
  }

  const { buffer, fileName } = await buildAppraisalDocx(target, year);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

// Demo-mode universe wrapper — an admin inside demo mode reads demo data
// (and the document itself is stamped DEMO — NOT A RECORD).
export const GET = demoAware(GETHandler);
