import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import { normalizeConfirmationStatus } from "@/lib/confirmation";
import { isCategoryKey } from "@/lib/categories";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getUserCategoryStoreFile } from "@/lib/userStore";

function categoryPath(category: string) {
  return `/data-entry/${category}`;
}

async function readEntries(email: string, fileName: string) {
  const filePath = getUserCategoryStoreFile(email, fileName);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      filePath,
      list: Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [],
    };
  } catch {
    return {
      filePath,
      list: [] as Array<Record<string, unknown>>,
    };
  }
}

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

    const fileName = CATEGORY_STORE_FILES[categoryKey];
    const { filePath, list } = await readEntries(email, fileName);
    const index = list.findIndex((item) => String(item?.id ?? "").trim() === entryId);

    if (index < 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const entry = list[index];
    if (String(entry.status ?? "draft") !== "final") {
      return NextResponse.json({ error: "Complete the entry with Done before confirmation." }, { status: 400 });
    }

    const confirmationStatus = normalizeConfirmationStatus(entry.requestEditStatus);
    if (confirmationStatus === "approved") {
      return NextResponse.json(entry, { status: 200 });
    }

    const now = new Date().toISOString();
    const updatedEntry = {
      ...entry,
      requestEditStatus: "pending",
      requestEditRequestedAtISO: entry.requestEditRequestedAtISO ?? now,
      sentForConfirmationAtISO: entry.sentForConfirmationAtISO ?? now,
      updatedAt: now,
    };

    list[index] = updatedEntry;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");

    revalidatePath("/dashboard");
    revalidatePath("/data-entry");
    revalidatePath(categoryPath(categoryKey));
    revalidatePath(`${categoryPath(categoryKey)}/${entryId}`);

    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send for confirmation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
