import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  listEntriesForCategory,
  updateEntry,
} from "@/lib/entryEngine";
import {
  isWithinRequestEditWindow,
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

function normalizeRequestEditStatus(value: unknown): RequestEditStatus {
  return value === "pending" || value === "approved" || value === "rejected" || value === "none"
    ? value
    : "none";
}

function canRequestEdit(entry: FdpAttendedRecord) {
  return entry.status === "final";
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
  return listEntriesForCategory(email, "fdp-attended");
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

      const updated: FdpAttendedRecord = {
        ...current,
        requestEditStatus: "pending",
        requestEditRequestedAtISO: nowISTTimestampISO(),
        updatedAt: new Date().toISOString(),
      };

      const persisted = await updateEntry<FdpAttendedRecord>(
        email,
        "fdp-attended",
        entryId,
        updated
      );
      return NextResponse.json(persisted, { status: 200 });
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

    const persisted = await updateEntry<FdpAttendedRecord>(
      email,
      "fdp-attended",
      entryId,
      updated
    );
    return NextResponse.json(persisted, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
