import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCategoryKey } from "@/lib/categories";
import { sendForConfirmation } from "@/lib/entryEngine";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dashboard, dataEntryHome, entryDetail, entryList } from "@/lib/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");

  if (!email.endsWith("@tce.edu")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      categoryKey?: string;
      entryId?: string;
      id?: string;
    };
    const categoryKey = String(body?.categoryKey ?? "").trim();
    const entryId = String(body?.entryId ?? body?.id ?? "").trim();

    if (!isCategoryKey(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }

    if (!entryId) {
      return NextResponse.json({ error: "entryId required" }, { status: 400 });
    }

    const updatedEntry = await sendForConfirmation(email, categoryKey, entryId);
    revalidatePath(dashboard());
    revalidatePath(dataEntryHome());
    revalidatePath(entryList(categoryKey));
    revalidatePath(entryDetail(categoryKey, entryId));
    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.me.entry.confirmation.POST");

    if (appError.code === "NOT_FOUND" || appError.message === "Entry not found") {
      return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
    }
    if (
      appError.code === "VALIDATION_ERROR" ||
      appError.message === "Complete the entry with Done before confirmation."
    ) {
      return NextResponse.json({ error: appError.message }, { status: 400 });
    }
    if (appError.message.startsWith("Invalid status transition:")) {
      return NextResponse.json(
        { error: "Entry cannot be sent for confirmation in the current state." },
        { status: 400 }
      );
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
