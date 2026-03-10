import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import { canManageEditRequests } from "@/lib/admin/roles";
import { restoreEntry } from "@/lib/entries/lifecycle";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import type { CategoryKey } from "@/lib/entries/types";
import {
  adminConfirmations,
  adminHome,
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
  const adminEmail = normalizeEmail(session?.user?.email ?? "");
  if (!canManageEditRequests(adminEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: adminEmail,
      action: "admin.entries.restore",
      options: RATE_LIMIT_PRESETS.adminOps,
    });

    const body = (await request.json()) as {
      ownerEmail?: string;
      categoryKey?: string;
      entryId?: string;
    };
    assertActionPayload(body, "admin restore entry", SECURITY_LIMITS.actionPayloadMaxBytes);
    const ownerEmail = normalizeEmail(String(body.ownerEmail ?? ""));
    const categoryKey = String(body.categoryKey ?? "").trim();
    const entryId = String(body.entryId ?? "").trim();

    if (!ownerEmail || !ownerEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
      return NextResponse.json({ error: "ownerEmail required" }, { status: 400 });
    }
    if (!isValidCategorySlug(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }
    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }

    const updatedEntry = await restoreEntry(adminEmail, categoryKey as CategoryKey, ownerEmail, entryId);
    revalidatePath(dashboard());
    revalidatePath(dataEntryHome());
    revalidatePath(entryList(categoryKey as CategoryKey));
    revalidatePath(entryDetail(categoryKey as CategoryKey, entryId));
    revalidatePath(adminHome());
    revalidatePath(adminConfirmations());

    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.admin.entries.restore.POST");

    if (appError.code === "NOT_FOUND") {
      return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
    }
    if (appError.code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (appError.code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: appError.message }, { status: 400 });
    }
    if (appError.message.startsWith("Invalid status transition:")) {
      return NextResponse.json({ error: "Only archived entries can be restored." }, { status: 400 });
    }
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    if (appError.code === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
    }

    return NextResponse.json({ error: appError.message || "Failed to restore entry." }, { status: 500 });
  }
}
