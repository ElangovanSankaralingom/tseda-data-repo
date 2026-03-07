import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessSettings } from "@/lib/admin/roles";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import {
  getAllSettingsWithMeta,
  setSetting,
  getNonDefaultCounts,
} from "@/lib/settings/store";
import { getSettingDefinition } from "@/lib/settings/registry";
import { validateSetting } from "@/lib/settings/validation";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessSettings(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.settings.read",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  const [settings, counts] = await Promise.all([
    getAllSettingsWithMeta(),
    getNonDefaultCounts(),
  ]);

  return NextResponse.json({ data: { settings, counts } });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email || !canAccessSettings(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  enforceRateLimitForRequest({
    request,
    action: "admin.settings.write",
    options: RATE_LIMIT_PRESETS.adminOps,
    userEmail: email,
  });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { key, value, confirmed } = body as { key?: string; value?: unknown; confirmed?: boolean };
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Missing key" }, { status: 400 });
  }

  const def = getSettingDefinition(key);
  if (!def) {
    return NextResponse.json({ error: `Unknown setting: ${key}` }, { status: 400 });
  }

  if (def.dangerous && !confirmed) {
    return NextResponse.json(
      { error: "Dangerous setting requires confirmation", requiresConfirmation: true },
      { status: 409 }
    );
  }

  const validation = validateSetting(key, value);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    await setSetting(key, value, email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
