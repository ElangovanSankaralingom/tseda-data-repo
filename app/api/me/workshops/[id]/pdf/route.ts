import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { runGeneratePdfRequest } from "@/lib/pdf/pdfService";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";

async function POSTHandler(request: Request, context: { params: Promise<{ id: string }> }) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: session.user.email,
      action: "me.workshops.pdf.post",
      options: RATE_LIMIT_PRESETS.fileDownloads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const { id } = await context.params;
  return runGeneratePdfRequest(request, {
    category: "workshops",
    entryId: String(id ?? "").trim(),
  });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const POST = demoAware(POSTHandler);
