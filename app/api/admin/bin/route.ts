import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { isDeleteApprover } from "@/lib/admin/coordinators";
import { listBinForViewer, restoreFromBin, permanentlyDeleteFromBin } from "@/lib/admin/bin";
import { logError, normalizeError } from "@/lib/errors";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { csrfGuard } from "@/lib/security/csrf";
import { adminBin, dashboard } from "@/lib/entryNavigation";

async function GETHandler() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!isDeleteApprover(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const entries = await listBinForViewer(email);
  return NextResponse.json({ entries });
}

type Body = { action: "restore" | "purge"; trashId: string };

async function POSTHandler(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!isDeleteApprover(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "admin.bin.post",
      options: RATE_LIMIT_PRESETS.adminOps,
    });

    const body = (await request.json()) as Body;
    assertActionPayload(body, "bin action", SECURITY_LIMITS.actionPayloadMaxBytes);
    const trashId = String(body.trashId ?? "").trim();
    if (!trashId) return NextResponse.json({ error: "trashId required" }, { status: 400 });

    // Per-category authorisation is enforced inside the bin operations.
    if (body.action === "restore") {
      await restoreFromBin(email, trashId);
    } else if (body.action === "purge") {
      await permanentlyDeleteFromBin(email, trashId);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    revalidatePath(adminBin());
    revalidatePath(dashboard());
    const entries = await listBinForViewer(email);
    return NextResponse.json({ entries });
  } catch (error) {
    const appError = normalizeError(error);
    logError(appError, "api.admin.bin.POST");
    const status = appError.code === "FORBIDDEN" ? 403 : appError.code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: appError.message || "Error" }, { status });
  }
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const POST = demoAware(POSTHandler);
