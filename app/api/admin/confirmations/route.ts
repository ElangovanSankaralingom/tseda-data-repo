import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";
import { getPendingConfirmations } from "@/lib/admin/pendingConfirmations";
import { CATEGORY_KEYS } from "@/lib/categories";
import {
  approveEntry,
  rejectEntry,
} from "@/lib/entryEngine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { type CategoryKey } from "@/lib/entries/types";
import { dashboard, dataEntryHome, entryDetail, entryList } from "@/lib/navigation";

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!isMasterAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await getPendingConfirmations();
  return NextResponse.json(rows, { status: 200 });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  const adminEmail = normalizeEmail(session?.user?.email ?? "");
  if (!isMasterAdmin(adminEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      ownerEmail?: string;
      categoryKey?: string;
      entryId?: string;
      decision?: "approve" | "reject";
      rejectionReason?: string;
    };
    const ownerEmail = normalizeEmail(String(body.ownerEmail ?? ""));
    const categoryKey = String(body.categoryKey ?? "").trim();
    const entryId = String(body.entryId ?? "").trim();
    const decision = body.decision;

    if (!ownerEmail || !ownerEmail.endsWith("@tce.edu")) {
      return NextResponse.json({ error: "ownerEmail required" }, { status: 400 });
    }
    if (!CATEGORY_KEYS.includes(categoryKey as CategoryKey)) {
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

    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update confirmation.";
    if (message === "Entry not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.startsWith("Invalid status transition:")) {
      return NextResponse.json({ error: "Invalid confirmation state transition." }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
