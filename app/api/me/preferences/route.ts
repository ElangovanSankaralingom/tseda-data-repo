import { demoAware } from "@/lib/demo/demoAware";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getUserPreferences, setUserPreferences } from "@/lib/preferences/userPreferences";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { NextResponse } from "next/server";
import { csrfGuard } from "@/lib/security/csrf";
import { normaliseAccent } from "@/lib/theme/accent";
import { isBetaTester } from "@/lib/admin/facultyRegistry";

const VALID_THEME_MODES = ["light", "dark"] as const;
const VALID_PALETTES = ["midnight-lime", "deep-ocean", "carbon-violet", "obsidian-amber"] as const;
const VALID_LANGUAGES = ["en", "ta"] as const;

async function GETHandler(request: Request) {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "me.preferences.get",
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  const prefs = getUserPreferences(email);
  return apiSuccess(prefs);
}

async function PUTHandler(request: Request) {
  const csrfBlocked = csrfGuard(request);
  if (csrfBlocked) return csrfBlocked;

  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email) return apiUnauthorized();

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: "me.preferences.put",
      options: RATE_LIMIT_PRESETS.entryMutations,
    });
  } catch (error) {
    const appError = normalizeError(error);
    return NextResponse.json(
      { error: appError.message, code: appError.code },
      { status: httpStatusForCode(appError.code) },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("Invalid JSON body", { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.themeMode !== undefined) {
    if (!VALID_THEME_MODES.includes(body.themeMode as typeof VALID_THEME_MODES[number])) {
      return apiError("Invalid themeMode", { status: 400 });
    }
    update.themeMode = body.themeMode;
  }

  if (body.colorPalette !== undefined) {
    if (!VALID_PALETTES.includes(body.colorPalette as typeof VALID_PALETTES[number])) {
      return apiError("Invalid colorPalette", { status: 400 });
    }
    update.colorPalette = body.colorPalette;
  }

  if (body.accentHex !== undefined) {
    // Accept a 6-digit hex (with/without #) or an "h,s,l" triple; store normalised.
    const v = typeof body.accentHex === "string" ? body.accentHex.trim() : "";
    if (!/^#?[0-9a-fA-F]{6}$/.test(v) && !/^\d+(?:\.\d+)?,\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(v)) {
      return apiError("Invalid accentHex", { status: 400 });
    }
    update.accentHex = normaliseAccent(v);
  }

  if (body.language !== undefined) {
    if (!VALID_LANGUAGES.includes(body.language as typeof VALID_LANGUAGES[number])) {
      return apiError("Invalid language", { status: 400 });
    }
    update.language = body.language;
  }

  // Beta-only options (dark mode, Tamil) may only be persisted by beta members.
  if ((update.themeMode === "dark" || update.language === "ta") && !isBetaTester(email)) {
    return apiError("Beta features require beta membership", { status: 403 });
  }

  const updated = setUserPreferences(email, update);
  return apiSuccess(updated);
}

// Demo-mode universe wrapper — every handler runs in the caller's universe.
export const GET = demoAware(GETHandler);
export const PUT = demoAware(PUTHandler);
