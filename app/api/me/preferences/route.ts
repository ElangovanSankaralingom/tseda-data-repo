import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getUserPreferences, setUserPreferences } from "@/lib/preferences/userPreferences";
import { apiSuccess, apiUnauthorized, apiError } from "@/lib/api/apiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { normalizeError, httpStatusForCode } from "@/lib/errors";
import { NextResponse } from "next/server";

const VALID_THEME_MODES = ["light", "dark", "color"] as const;
const VALID_PALETTES = ["midnight-lime", "deep-ocean", "carbon-violet", "obsidian-amber"] as const;
const VALID_LANGUAGES = ["en", "ta"] as const;

export async function GET(request: Request) {
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

export async function PUT(request: Request) {
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

  if (body.language !== undefined) {
    if (!VALID_LANGUAGES.includes(body.language as typeof VALID_LANGUAGES[number])) {
      return apiError("Invalid language", { status: 400 });
    }
    update.language = body.language;
  }

  const updated = setUserPreferences(email, update);
  return apiSuccess(updated);
}
