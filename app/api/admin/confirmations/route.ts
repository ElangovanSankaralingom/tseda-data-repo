import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";
import { CATEGORY_STORE_FILES } from "@/lib/categoryStore";
import { normalizeConfirmationStatus } from "@/lib/confirmation";
import { CATEGORY_KEYS } from "@/lib/categories";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { type CategoryKey } from "@/lib/entries/types";
import { getUserCategoryStoreFile } from "@/lib/userStore";

type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: CategoryKey;
  entryId: string;
  title: string;
  sentForConfirmationAtISO: string | null;
  status: string;
};

function categoryPath(category: string) {
  return `/data-entry/${category}`;
}

function getEntryTitle(categoryKey: CategoryKey, entry: Record<string, unknown>) {
  if (categoryKey === "fdp-attended") return String(entry.programName ?? "").trim() || "FDP Entry";
  if (categoryKey === "fdp-conducted") return String(entry.eventName ?? "").trim() || "FDP Entry";
  if (categoryKey === "case-studies") return String(entry.placeOfVisit ?? "").trim() || "Case Study";
  if (categoryKey === "guest-lectures") return String(entry.eventName ?? "").trim() || "Guest Lecture";
  return String(entry.eventName ?? "").trim() || "Workshop";
}

function toEmailFromDir(dirName: string) {
  return normalizeEmail(dirName);
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!isMasterAdmin(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const usersRoot = path.join(process.cwd(), ".data", "users");
  const rows: PendingConfirmationRow[] = [];

  try {
    const userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue;
      const ownerEmail = toEmailFromDir(userDir.name);
      if (!ownerEmail.endsWith("@tce.edu")) continue;

      for (const categoryKey of CATEGORY_KEYS) {
        const filePath = getUserCategoryStoreFile(ownerEmail, CATEGORY_STORE_FILES[categoryKey]);
        let list: Array<Record<string, unknown>> = [];
        try {
          const raw = await fs.readFile(filePath, "utf8");
          const parsed = JSON.parse(raw);
          list = Array.isArray(parsed) ? parsed : [];
        } catch {
          list = [];
        }

        for (const entry of list) {
          const confirmationStatus = normalizeConfirmationStatus(entry.requestEditStatus);
          if (confirmationStatus !== "pending") continue;
          rows.push({
            ownerEmail,
            categoryKey,
            entryId: String(entry.id ?? "").trim(),
            title: getEntryTitle(categoryKey, entry),
            sentForConfirmationAtISO:
              typeof entry.sentForConfirmationAtISO === "string"
                ? entry.sentForConfirmationAtISO
                : typeof entry.requestEditRequestedAtISO === "string"
                  ? entry.requestEditRequestedAtISO
                  : null,
            status: String(entry.status ?? "draft"),
          });
        }
      }
    }
  } catch {
    return NextResponse.json([], { status: 200 });
  }

  rows.sort((left, right) => {
    const leftTs = left.sentForConfirmationAtISO ? Date.parse(left.sentForConfirmationAtISO) : 0;
    const rightTs = right.sentForConfirmationAtISO ? Date.parse(right.sentForConfirmationAtISO) : 0;
    return rightTs - leftTs;
  });

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

    const filePath = getUserCategoryStoreFile(ownerEmail, CATEGORY_STORE_FILES[categoryKey as CategoryKey]);
    let list: Array<Record<string, unknown>> = [];
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      return NextResponse.json({ error: "Entry store not found." }, { status: 404 });
    }

    const index = list.findIndex((item) => String(item?.id ?? "").trim() === entryId);
    if (index < 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const entry = list[index];
    const now = new Date().toISOString();
    const updatedEntry = {
      ...entry,
      requestEditStatus: decision === "approve" ? "approved" : "rejected",
      confirmedAtISO: decision === "approve" ? now : null,
      confirmedBy: decision === "approve" ? adminEmail : null,
      confirmationRejectedReason: decision === "reject" ? String(body.rejectionReason ?? "").trim() : "",
      updatedAt: now,
    };

    list[index] = updatedEntry;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");

    const categoryRoute = categoryPath(categoryKey);
    revalidatePath("/dashboard");
    revalidatePath("/data-entry");
    revalidatePath(categoryRoute);
    revalidatePath(`${categoryRoute}/${entryId}`);

    return NextResponse.json(updatedEntry, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update confirmation.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
