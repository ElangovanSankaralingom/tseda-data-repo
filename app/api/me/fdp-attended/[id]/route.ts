import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  isEntryLockedByStreak,
  isFutureDatedEntry,
  isNonStreakEntryLocked,
  isWithinRequestEditWindow,
  normalizeStreakState,
  nowISTTimestampISO,
} from "@/lib/gamification";

type RequestEditStatus = "none" | "pending" | "approved" | "rejected";

type FdpAttendedRecord = {
  id: string;
  status?: "draft" | "final";
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  streak?: unknown;
  requestEditStatus?: RequestEditStatus;
  requestEditRequestedAtISO?: string | null;
  requestEditMessage?: string;
};

const STORE_ROOT = path.join(process.cwd(), "data", "fdp-attended");
function sanitizeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

function normalizeRequestEditStatus(value: unknown): RequestEditStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : "none";
}

function isLockedEntry(entry: FdpAttendedRecord) {
  const eligible = isFutureDatedEntry(entry.startDate ?? "", entry.endDate ?? "");

  if (eligible && entry.status === "final") {
    return isEntryLockedByStreak(normalizeStreakState(entry.streak));
  }

  return !eligible && !!entry.createdAt && isNonStreakEntryLocked(entry.createdAt);
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase().trim() ?? "";

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
}

async function readList(email: string): Promise<FdpAttendedRecord[]> {
  const filePath = path.join(STORE_ROOT, `${sanitizeSegment(email)}.json`);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FdpAttendedRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: FdpAttendedRecord[]) {
  await fs.mkdir(STORE_ROOT, { recursive: true });
  const filePath = path.join(STORE_ROOT, `${sanitizeSegment(email)}.json`);
  await fs.writeFile(filePath, JSON.stringify(list, null, 2), "utf8");
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const entryId = String(id ?? "").trim();
  if (!entryId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      action?: string;
    };
    const action = String(body?.action ?? "").trim();
    const list = await readList(email);
    const index = list.findIndex((item) => String(item?.id ?? "").trim() === entryId);

    if (index < 0) {
      return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    }

    const current = list[index];
    if (!isLockedEntry(current)) {
      return NextResponse.json({ error: "Request edit is allowed only for locked entries." }, { status: 400 });
    }

    if (action !== "request_edit" && action !== "cancel_request_edit") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const currentStatus = normalizeRequestEditStatus(current.requestEditStatus);

    if (action === "request_edit") {
      if (currentStatus === "pending") {
        return NextResponse.json(current, { status: 200 });
      }

      const updated: FdpAttendedRecord = {
        ...current,
        requestEditStatus: "pending",
        requestEditRequestedAtISO: nowISTTimestampISO(),
        updatedAt: new Date().toISOString(),
      };

      list[index] = updated;
      await writeList(email, list);
      return NextResponse.json(updated, { status: 200 });
    }

    if (currentStatus !== "pending") {
      return NextResponse.json(current, { status: 200 });
    }

    if (!isWithinRequestEditWindow(current.requestEditRequestedAtISO, 5)) {
      return NextResponse.json({ error: "Cancel request window has expired." }, { status: 400 });
    }

    const updated: FdpAttendedRecord = {
      ...current,
      requestEditStatus: "none",
      requestEditRequestedAtISO: null,
      updatedAt: new Date().toISOString(),
    };

    list[index] = updated;
    await writeList(email, list);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
