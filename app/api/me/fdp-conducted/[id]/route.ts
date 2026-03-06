import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  listEntriesForCategory,
  updateEntry,
} from "@/lib/entries/lifecycle";
import { isWithinRequestEditWindow } from "@/lib/entries/lock";
import { normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { nowISTTimestampISO } from "@/lib/gamification";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

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

async function readList(email: string): Promise<FdpConductedRecord[]> {
  return listEntriesForCategory(email, "fdp-conducted");
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
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "entry.request-edit.fdp-conducted",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });

    const body = (await request.json()) as {
      action?: string;
    };
    assertActionPayload(body, "request edit payload", SECURITY_LIMITS.actionPayloadMaxBytes);
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

      const persisted = await updateEntry<FdpConductedRecord>(
        email,
        "fdp-conducted",
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

    const updated: FdpConductedRecord = {
      ...current,
      requestEditStatus: "none",
      requestEditRequestedAtISO: null,
      updatedAt: new Date().toISOString(),
    };

    const persisted = await updateEntry<FdpConductedRecord>(
      email,
      "fdp-conducted",
      entryId,
      updated
    );
    return NextResponse.json(persisted, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    if (appError.code === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
    }
    if (appError.code === "VALIDATION_ERROR") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 400 });
    }
    return NextResponse.json({ error: appError.message || "Request failed" }, { status: 500 });
  }
}
