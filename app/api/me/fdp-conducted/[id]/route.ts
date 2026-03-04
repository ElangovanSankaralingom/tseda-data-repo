import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import {
  isWithinRequestEditWindow,
  nowISTTimestampISO,
} from "@/lib/gamification";

type RequestEditStatus = "none" | "pending" | "approved" | "rejected";

type FdpConductedRecord = {
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

function safeEmailDir(email: string) {
  return normalizeEmail(email).replace(/[^a-z0-9@._-]/g, "_");
}

function normalizeRequestEditStatus(value: unknown): RequestEditStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : "none";
}

function canRequestEdit(entry: FdpConductedRecord) {
  return entry.status === "final";
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email?.toLowerCase() ?? "");

  if (!email.endsWith("@tce.edu")) {
    return null;
  }

  return email;
}

function getStoreFile(email: string) {
  return path.join(process.cwd(), ".data", "users", safeEmailDir(email), "fdp-conducted.json");
}

async function readList(email: string): Promise<FdpConductedRecord[]> {
  const filePath = getStoreFile(email);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FdpConductedRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeList(email: string, list: FdpConductedRecord[]) {
  const filePath = getStoreFile(email);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
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
    if (!canRequestEdit(current)) {
      return NextResponse.json({ error: "Request edit is allowed only for completed entries." }, { status: 400 });
    }

    if (action !== "request_edit" && action !== "cancel_request_edit") {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const currentStatus = normalizeRequestEditStatus(current.requestEditStatus);

    if (action === "request_edit") {
      if (currentStatus === "pending") {
        return NextResponse.json(current, { status: 200 });
      }

      const updated: FdpConductedRecord = {
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

    const updated: FdpConductedRecord = {
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
