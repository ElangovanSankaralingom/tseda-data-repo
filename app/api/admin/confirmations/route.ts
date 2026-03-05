import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isMasterAdmin } from "@/lib/admin";
import { CATEGORY_KEYS } from "@/lib/categories";
import {
  approveEntry,
  getEntryWorkflowStatus,
  listEntriesForCategory,
  rejectEntry,
} from "@/lib/entryEngine";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { type CategoryKey } from "@/lib/entries/types";
import { dashboard, dataEntryHome, entryDetail, entryList } from "@/lib/navigation";

type PendingConfirmationRow = {
  ownerEmail: string;
  categoryKey: CategoryKey;
  entryId: string;
  title: string;
  sentForConfirmationAtISO: string | null;
  status: string;
};

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
        const list = await listEntriesForCategory(ownerEmail, categoryKey);
        for (const entry of list) {
          if (getEntryWorkflowStatus(entry) !== "PENDING_CONFIRMATION") continue;
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
