import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { canManageAdminUsers } from "@/lib/admin/roles";
import { getProfileByEmail } from "@/lib/profileStore";
import { getFacultyRecord } from "@/lib/admin/facultyRegistry";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";

/** Master-only download of a faculty's full profile + registry record (JSON). */
async function GETHandler(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await getServerSession(authOptions);
  const adminEmail = normalizeEmail(session?.user?.email ?? "");
  if (!canManageAdminUsers(adminEmail)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    userEmail: adminEmail,
    action: "admin.faculty.profile.download",
    options: RATE_LIMIT_PRESETS.fileDownloads,
  });

  const { email } = await params;
  const target = normalizeEmail(decodeURIComponent(email));
  const record = getFacultyRecord(target);
  const profile = await getProfileByEmail(target);
  if (!record && !profile) {
    return NextResponse.json({ error: "Faculty not found" }, { status: 404 });
  }

  const payload = {
    email: target,
    registry: record,
    profile: profile ?? null,
    exportedAtISO: new Date().toISOString(),
    exportedBy: adminEmail,
  };
  const safe = target.replace(/[^a-z0-9._-]+/g, "-");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="faculty-${safe}.json"`,
    },
  });
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
