import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canAccessAdminConsole } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getFacultyRegistry, type FacultyRecord } from "@/lib/admin/facultyRegistry";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Faculty picker/search endpoint — REGISTRY-BACKED (2026-07 correlation fix).
 *
 * This route previously served a separate `faculty.json` directory that the
 * admin-managed faculty registry never touched: faculty added in Faculty
 * admin were unselectable in pickers, and deactivated faculty stayed
 * selectable. The registry (`lib/admin/facultyRegistry.ts`) is THE single
 * source of who exists — the same source used by sign-in, collaboration
 * fan-out, beta membership, and name resolution.
 *
 * Only ACTIVE faculty are selectable (llp/inactive are excluded — matching
 * the fan-out guard in engineShare). The unused legacy CRUD (POST/PUT/DELETE
 * over faculty.json) is removed; faculty management lives in Faculty admin.
 *
 * S0 privacy behavior preserved: non-admin callers must supply a search query
 * (min 2 chars) and receive name + email only, capped at 20 — enough for
 * pickers, useless for bulk enumeration.
 */

function displayName(record: FacultyRecord): string {
  const name = (record.name ?? "").trim();
  return name || record.email.split("@")[0] || record.email;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    enforceRateLimitForRequest({
      request: req,
      userEmail: email,
      action: "faculty.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    if (appError.code !== "RATE_LIMITED") {
      logger.error({ event: "faculty.rateLimit.unexpected", code: appError.code, msg: appError.message });
    }
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const registry = getFacultyRegistry();
  const active = registry.faculty.filter((f) => f.status === "active");

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.toLowerCase().trim();
  const isAdmin = canAccessAdminConsole(email);

  if (isAdmin && !query) {
    return NextResponse.json(
      active.map((f) => ({
        fullName: displayName(f),
        email: f.email,
        departments: f.departments ?? [],
      })),
    );
  }

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Provide a search query of at least 2 characters." },
      { status: 400 },
    );
  }

  const filtered = active.filter(
    (f) =>
      displayName(f).toLowerCase().includes(query) ||
      f.email.toLowerCase().includes(query),
  );
  const limited = filtered.slice(0, 20);
  return NextResponse.json(
    limited.map((f) => ({ fullName: displayName(f), email: f.email })),
  );
}
