import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isCategoryKey } from "@/lib/categories";
import { logError, normalizeError } from "@/lib/errors";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { runGenerateEntryRequest } from "@/lib/server/generateEntry";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      categoryKey?: string;
      id?: string;
      draft?: unknown;
    };
    assertActionPayload(
      body,
      "generate request",
      SECURITY_LIMITS.entryPayloadMaxBytes + SECURITY_LIMITS.actionPayloadMaxBytes
    );

    const categoryKey = String(body?.categoryKey ?? "").trim();
    const id = String(body?.id ?? "").trim();

    if (!isCategoryKey(categoryKey)) {
      return NextResponse.json({ error: "Unsupported category" }, { status: 404 });
    }

    return runGenerateEntryRequest(request, {
      categoryKey,
      id,
      draft: body?.draft,
    });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.me.entry.generate.POST");
    if (appError.code === "RATE_LIMITED") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
    }
    if (appError.code === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
    }
    return NextResponse.json({ error: appError.message || "Invalid generate request." }, { status: 400 });
  }
}
