import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeError, toUserMessage } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest } from "@/lib/security/rateLimit";
import { trackEvent } from "@/lib/telemetry/telemetry";
import type { TelemetryEventInput } from "@/lib/telemetry/types";

const TELEMETRY_RATE_LIMIT = { windowMs: 60_000, max: 240 } as const;

type TelemetryBody = {
  event?: unknown;
  category?: unknown;
  entryId?: unknown;
  status?: unknown;
  success?: unknown;
  durationMs?: unknown;
  meta?: unknown;
};

function asOptionalString(value: unknown, maxLength = 256) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function asOptionalBoolean(value: unknown) {
  if (typeof value !== "boolean") return null;
  return value;
}

function asOptionalNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  return Math.round(num);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const actorEmail = normalizeEmail(session?.user?.email ?? "");
  if (!actorEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      action: "telemetry.ingest",
      options: TELEMETRY_RATE_LIMIT,
      userEmail: actorEmail,
    });

    const body = (await request.json()) as TelemetryBody;
    assertActionPayload(body, "telemetry event request", SECURITY_LIMITS.actionPayloadMaxBytes);

    const event = asOptionalString(body.event, 120);
    if (!event) {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    const payload: TelemetryEventInput = {
      event: event as TelemetryEventInput["event"],
      actorEmail,
      role: canAccessAdminConsole(actorEmail) ? "admin" : "user",
      category: asOptionalString(body.category, 80),
      entryId: asOptionalString(body.entryId, 160),
      status: asOptionalString(body.status, 80),
      success: asOptionalBoolean(body.success) ?? true,
      durationMs: asOptionalNumber(body.durationMs),
      meta:
        body.meta && typeof body.meta === "object" && !Array.isArray(body.meta)
          ? (body.meta as Record<string, string | number | boolean | null | undefined>)
          : {},
    };

    const tracked = await trackEvent(payload);
    if (!tracked.ok) {
      return NextResponse.json(
        { error: toUserMessage(tracked.error), code: tracked.error.code },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const normalized = normalizeError(error);
    const status =
      normalized.code === "RATE_LIMITED"
        ? 429
        : normalized.code === "PAYLOAD_TOO_LARGE"
          ? 413
          : normalized.code === "UNAUTHORIZED"
            ? 401
            : normalized.code === "FORBIDDEN"
              ? 403
              : 400;

    return NextResponse.json(
      { error: toUserMessage(normalized), code: normalized.code },
      { status }
    );
  }
}

