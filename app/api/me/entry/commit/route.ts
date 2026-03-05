import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCategoryKey } from "@/lib/categories";
import { commitDraft } from "@/lib/entryEngine";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { dashboard, dataEntryHome, entryDetail, entryList } from "@/lib/navigation";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const sessionEmail = normalizeEmail(session?.user?.email ?? "");

  if (!sessionEmail.endsWith("@tce.edu")) {
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

    const committedEntry = await commitDraft(sessionEmail, categoryKey, entryId);
    revalidatePath(dashboard());
    revalidatePath(dataEntryHome());
    revalidatePath(entryList(categoryKey));
    revalidatePath(entryDetail(categoryKey, entryId));
    return NextResponse.json(committedEntry, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.me.entry.commit.POST");

    if (appError.code === "NOT_FOUND" || appError.message === "Entry not found") {
      return NextResponse.json({ error: appError.message || "Entry not found" }, { status: 404 });
    }
    if (appError.code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: appError.message, details: appError.details }, { status: 400 });
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
