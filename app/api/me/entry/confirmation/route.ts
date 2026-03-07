import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCategoryKey } from "@/lib/categories";
import { requestEdit } from "@/lib/entries/lifecycle";
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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith("@tce.edu")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "entry.edit.request",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });

    const body = (await request.json()) as {
      categoryKey?: string;
      entryId?: string;
      id?: string;
      message?: string;
    };
    assertActionPayload(body, "edit request", SECURITY_LIMITS.actionPayloadMaxBytes);
    const categoryKey = String(body?.categoryKey ?? "").trim();
    const entryId = String(body?.entryId ?? body?.id ?? "").trim();
    const message = String(body?.message ?? "").trim();

    if (!isCategoryKey(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }

    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }

    const updatedEntry = await requestEdit(email, categoryKey, entryId, message || undefined);
    revalidatePath(dashboard());
    revalidatePath(dataEntryHome());
    revalidatePath(entryList(categoryKey));
    revalidatePath(entryDetail(categoryKey, entryId));
    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.me.entry.requestEdit.POST");

    if (appError.code === "NOT_FOUND" || appError.message === "Entry not found") {
      return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
    }
    if (appError.code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: appError.message }, { status: 400 });
    }
    if (appError.message.startsWith("Invalid status transition:")) {
      return NextResponse.json(
        { error: "Entry cannot request edit access in the current state." },
        { status: 400 }
      );
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
