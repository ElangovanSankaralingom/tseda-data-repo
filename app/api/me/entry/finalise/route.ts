import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCategoryKey } from "@/lib/categories";
import { finalizeEntry } from "@/lib/entries/lifecycle";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  dashboard,
  dataEntryHome,
  entryDetail,
  entryList,
} from "@/lib/entryNavigation";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "entry.finalize",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });

    const body = (await request.json()) as {
      categoryKey?: string;
      entryId?: string;
    };
    assertActionPayload(body, "finalize entry", SECURITY_LIMITS.actionPayloadMaxBytes);
    const categoryKey = String(body?.categoryKey ?? "").trim();
    const entryId = String(body?.entryId ?? "").trim();

    if (!isCategoryKey(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }

    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }

    const updatedEntry = await finalizeEntry(email, categoryKey, entryId);
    revalidatePath(dashboard());
    revalidatePath(dataEntryHome());
    revalidatePath(entryList(categoryKey));
    revalidatePath(entryDetail(categoryKey, entryId));
    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.me.entry.finalise.POST");

    if (appError.code === "NOT_FOUND" || appError.message === "Entry not found") {
      return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
    }
    if (appError.code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: appError.message }, { status: 400 });
    }
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    if (appError.code === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
    }
    if (appError.code === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (appError.code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ error: appError.message }, { status: 500 });
  }
}
