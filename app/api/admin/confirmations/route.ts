import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import { canApproveConfirmations } from "@/lib/admin/roles";
import { getPendingConfirmations } from "@/lib/admin/pendingConfirmations";
import {
  approveEntry,
  rejectEntry,
} from "@/lib/entries/lifecycle";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { type CategoryKey } from "@/lib/entries/types";
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

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!canApproveConfirmations(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getPendingConfirmations();
  return NextResponse.json(rows, { status: 200 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const adminEmail = normalizeEmail(session?.user?.email ?? "");
  if (!canApproveConfirmations(adminEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: adminEmail,
      action: "admin.confirmations.patch",
      options: RATE_LIMIT_PRESETS.adminOps,
    });

    const body = (await request.json()) as {
      ownerEmail?: string;
      categoryKey?: string;
      entryId?: string;
      decision?: "approve" | "reject";
      rejectionReason?: string;
    };
    assertActionPayload(body, "admin confirmation request", SECURITY_LIMITS.actionPayloadMaxBytes);
    const ownerEmail = normalizeEmail(String(body.ownerEmail ?? ""));
    const categoryKey = String(body.categoryKey ?? "").trim();
    const entryId = String(body.entryId ?? "").trim();
    const decision = body.decision;

    if (!ownerEmail || !ownerEmail.endsWith("@tce.edu")) {
      return NextResponse.json({ error: "ownerEmail required" }, { status: 400 });
    }
    if (!isValidCategorySlug(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }
    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }
    if (decision !== "approve" && decision !== "reject") {
      return NextResponse.json({ error: "decision required" }, { status: 400 });
    }

    const updatedEntry =
      decision === "approve"
        ? await approveEntry(adminEmail, categoryKey as CategoryKey, ownerEmail, entryId)
        : await rejectEntry(
            adminEmail,
            categoryKey as CategoryKey,
            ownerEmail,
            entryId,
            String(body.rejectionReason ?? "")
          );

    const categoryRoute = entryList(categoryKey as CategoryKey);
    revalidatePath(dashboard());
    revalidatePath(dataEntryHome());
    revalidatePath(categoryRoute);
    revalidatePath(entryDetail(categoryKey as CategoryKey, entryId));
    revalidatePath(adminHome());
    revalidatePath(adminConfirmations());

    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.admin.confirmations.PATCH");

    if (appError.code === "NOT_FOUND" || appError.message === "Entry not found") {
      return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
    }
    if (appError.code === "FORBIDDEN" || appError.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (appError.message.startsWith("Invalid status transition:")) {
      return NextResponse.json({ error: "Invalid confirmation state transition." }, { status: 400 });
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

    return NextResponse.json({ error: appError.message || "Failed to update confirmation." }, { status: 500 });
  }
}
