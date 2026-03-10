import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import { canManageEditRequests } from "@/lib/admin/roles";
import { getPendingRequests } from "@/lib/admin/pendingConfirmations";
import {
  approveDelete,
  grantEditAccess,
  rejectDeleteRequest,
  rejectEditRequest,
} from "@/lib/entries/lifecycle";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { type CategoryKey } from "@/lib/entries/types";
import {
  adminAnalytics,
  adminAudit,
  adminConfirmations,
  adminExport,
  adminHome,
  dashboard,
  dataEntryHome,
  entryDetail,
  entryList,
} from "@/lib/entryNavigation";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canManageEditRequests(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getPendingRequests();
  return NextResponse.json(rows, { status: 200 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const adminEmail = normalizeEmail(session?.user?.email ?? "");
  if (!canManageEditRequests(adminEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: adminEmail,
      action: "admin.editRequests.patch",
      options: RATE_LIMIT_PRESETS.adminOps,
    });

    const body = (await request.json()) as {
      ownerEmail?: string;
      categoryKey?: string;
      entryId?: string;
      decision?: "grant" | "reject" | "reject_delete" | "approve_delete";
      reason?: string;
    };
    assertActionPayload(body, "admin request decision", SECURITY_LIMITS.actionPayloadMaxBytes);
    const ownerEmail = normalizeEmail(String(body.ownerEmail ?? ""));
    const categoryKey = String(body.categoryKey ?? "").trim();
    const entryId = String(body.entryId ?? "").trim();
    const decision = body.decision;
    const reason = String(body.reason ?? "").trim();

    if (!ownerEmail || !ownerEmail.endsWith(ALLOWED_EMAIL_SUFFIX)) {
      return NextResponse.json({ error: "ownerEmail required" }, { status: 400 });
    }
    if (!isValidCategorySlug(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }
    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }
    if (decision !== "grant" && decision !== "reject" && decision !== "reject_delete" && decision !== "approve_delete") {
      return NextResponse.json({ error: "decision must be 'grant', 'reject', 'reject_delete', or 'approve_delete'" }, { status: 400 });
    }

    let updatedEntry;
    if (decision === "reject") {
      updatedEntry = await rejectEditRequest(adminEmail, categoryKey as CategoryKey, ownerEmail, entryId, reason || undefined);
    } else if (decision === "reject_delete") {
      updatedEntry = await rejectDeleteRequest(adminEmail, categoryKey as CategoryKey, ownerEmail, entryId);
    } else if (decision === "approve_delete") {
      updatedEntry = await approveDelete(adminEmail, categoryKey as CategoryKey, ownerEmail, entryId);
    } else {
      updatedEntry = await grantEditAccess(adminEmail, categoryKey as CategoryKey, ownerEmail, entryId);
    }

    const categoryRoute = entryList(categoryKey as CategoryKey);
    revalidatePath(dashboard());
    revalidatePath(dataEntryHome());
    revalidatePath(categoryRoute);
    revalidatePath(entryDetail(categoryKey as CategoryKey, entryId));
    revalidatePath(adminHome());
    revalidatePath(adminConfirmations());
    revalidatePath(adminAudit());
    revalidatePath(adminAnalytics());
    revalidatePath(adminExport());

    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.admin.editRequests.PATCH");

    if (appError.code === "NOT_FOUND" || appError.message === "Entry not found") {
      return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
    }
    if (appError.code === "FORBIDDEN" || appError.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (appError.message.startsWith("Invalid status transition:")) {
      return NextResponse.json({ error: "Invalid edit request state transition." }, { status: 400 });
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

    return NextResponse.json({ error: appError.message || "Failed to process edit request." }, { status: 500 });
  }
}
