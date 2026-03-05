import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCategoryKey } from "@/lib/categories";
import { sendForConfirmation } from "@/lib/entryEngine";
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
    const message = error instanceof Error ? error.message : "Failed to send for confirmation.";
    if (message === "Entry not found") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "Complete the entry with Done before confirmation.") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.startsWith("Invalid status transition:")) {
      return NextResponse.json(
        { error: "Entry cannot be sent for confirmation in the current state." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
