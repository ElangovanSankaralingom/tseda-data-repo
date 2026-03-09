// app/api/me/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureDirs, PROFILES_DIR, safeEmailKey } from "@/lib/uploadStore";
import { findFacultyByEmail, normalizeEmail } from "@/lib/facultyDirectory";
import { assertActionPayload } from "@/lib/security/limits";

type AnyObj = Record<string, unknown>;

function isAnyObj(value: unknown): value is AnyObj {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readProfile(email: string): AnyObj {
  ensureDirs();
  const key = safeEmailKey(email);
  const file = path.join(PROFILES_DIR, `${key}.json`);
  if (!fs.existsSync(file)) {
    const seed = {
      email,
      facultyId: normalizeEmail(email),
      officialName: "",
      isFacultyListed: false,
      googleName: null,
      googlePhotoURL: null,
      userPreferredName: "",
      customPhotoURL: null,
      personal: {},
      academic: {},
      experience: {
        lopPeriods: [],
        academicOutsideTCE: [],
        industry: [],
      },
      uploads: {
        appointmentLetter: null,
        joiningLetter: null,
        aadhar: null,
        panCard: null,
      },
      settings: {
        theme: "light",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(file, JSON.stringify(seed, null, 2), "utf-8");
    return seed;
  }
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeProfile(email: string, profile: AnyObj) {
  ensureDirs();
  const key = safeEmailKey(email);
  const file = path.join(PROFILES_DIR, `${key}.json`);
  profile.updatedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), "utf-8");
}

function deepMerge(base: AnyObj, patch: AnyObj): AnyObj {
  const out: AnyObj = { ...base };
  for (const k of Object.keys(patch || {})) {
    const pv = patch[k];
    const bv = base?.[k];
    if (isAnyObj(pv) && isAnyObj(bv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

function getSessionGoogleName(session: unknown) {
  const user =
    session && typeof session === "object" && "user" in session
      ? (session as { user?: { name?: unknown } }).user
      : undefined;
  return typeof user?.name === "string" ? user.name.trim() : "";
}

function getSessionGooglePhotoURL(session: unknown) {
  const user =
    session && typeof session === "object" && "user" in session
      ? (session as { user?: { image?: unknown } }).user
      : undefined;
  return typeof user?.image === "string" ? user.image.trim() : "";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email;
  const email = sessionEmail ? normalizeEmail(sessionEmail) : "";
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = readProfile(email);
  const canonical = findFacultyByEmail(email);
  const sessionGoogleName = getSessionGoogleName(session);
  const sessionGooglePhotoURL = getSessionGooglePhotoURL(session);
  const fallbackName = profile.userPreferredName || sessionGoogleName || email.split("@")[0];
  const academicRecord =
    typeof profile.academic === "object" && profile.academic ? (profile.academic as AnyObj) : {};

  profile.email = email;
  profile.facultyId = email;
  profile.isFacultyListed = !!canonical;
  profile.officialName = canonical?.name ?? fallbackName;
  profile.googleName = sessionGoogleName || String(profile.googleName ?? "").trim() || null;
  profile.googlePhotoURL =
    sessionGooglePhotoURL || String(profile.googlePhotoURL ?? "").trim() || null;
  profile.academic = {
    ...academicRecord,
    employeeId: typeof academicRecord.employeeId === "string" ? academicRecord.employeeId.replace(/\D/g, "").slice(0, 6) : "",
  };

  writeProfile(email, profile);
  return NextResponse.json(profile);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email;
  const email = sessionEmail ? normalizeEmail(sessionEmail) : "";
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let patch: AnyObj;
  try {
    patch = (await req.json()) as AnyObj;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    assertActionPayload(patch, "profile update");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payload validation failed";
    return NextResponse.json({ error: message }, { status: 413 });
  }
  const current = readProfile(email);
  const canonical = findFacultyByEmail(email);
  const sessionGoogleName = getSessionGoogleName(session);
  const sessionGooglePhotoURL = getSessionGooglePhotoURL(session);
  const sanitizedPatch = { ...patch };

  delete sanitizedPatch.email;
  delete sanitizedPatch.facultyId;
  delete sanitizedPatch.officialName;
  delete sanitizedPatch.isFacultyListed;
  delete sanitizedPatch.googleName;
  delete sanitizedPatch.googlePhotoURL;

  const merged = deepMerge(current, sanitizedPatch);
  const patchAcademic =
    typeof sanitizedPatch.academic === "object" && sanitizedPatch.academic ? (sanitizedPatch.academic as AnyObj) : null;
  const mergedAcademic = typeof merged.academic === "object" && merged.academic ? (merged.academic as AnyObj) : {};

  if (patchAcademic && Object.prototype.hasOwnProperty.call(patchAcademic, "employeeId")) {
    const rawEmployeeId = patchAcademic.employeeId;
    const normalizedEmployeeId =
      typeof rawEmployeeId === "string" ? rawEmployeeId.replace(/\D/g, "").slice(0, 6) : "";

    if (!/^\d{6}$/.test(normalizedEmployeeId)) {
      return NextResponse.json({ error: "Employee ID must be exactly 6 digits." }, { status: 400 });
    }

    merged.academic = {
      ...mergedAcademic,
      employeeId: normalizedEmployeeId,
    };
  } else if (!merged.academic || typeof merged.academic !== "object") {
    merged.academic = {};
  }

  merged.email = email;
  merged.facultyId = email;
  merged.isFacultyListed = !!canonical;
  merged.officialName =
    canonical?.name ??
    merged.userPreferredName ??
    sessionGoogleName ??
    email.split("@")[0];
  merged.googleName =
    sessionGoogleName || String(current.googleName ?? merged.googleName ?? "").trim() || null;
  merged.googlePhotoURL =
    sessionGooglePhotoURL ||
    String(current.googlePhotoURL ?? merged.googlePhotoURL ?? "").trim() ||
    null;
  writeProfile(email, merged);

  return NextResponse.json(merged);
}
