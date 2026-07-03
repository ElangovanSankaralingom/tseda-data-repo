import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import { authOptions } from "@/lib/auth";
import { runGeneratePdfRequest } from "@/lib/pdf/pdfService";
import { NextResponse } from "next/server";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { csrfGuard } from "@/lib/security/csrf";

async function POSTHandler(request: Request, context: { params: Promise<{ category: string; id: string }> }) {
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
      action: "me.entries.category.id.generate.post",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const { category, id } = await context.params;
  const normalizedCategory = String(category ?? "").trim();
  if (!isValidCategorySlug(normalizedCategory)) {
    return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
  }

  return runGeneratePdfRequest(request, {
    category: normalizedCategory,
    entryId: String(id ?? "").trim(),
  });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const POST = demoAware(POSTHandler);
