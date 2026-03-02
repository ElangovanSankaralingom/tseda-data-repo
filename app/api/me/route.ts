// app/api/me/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ensureDirs, PROFILES_DIR, safeEmailKey } from "@/lib/uploadStore";
import { findFacultyByEmail, normalizeEmail } from "@/lib/facultyDirectory";

type AnyObj = Record<string, unknown>;

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
      googleName: "",
      googlePhotoURL: "",
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
  const out: AnyObj = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(patch || {})) {
    const pv = patch[k];
    const bv = base?.[k];
    if (pv && typeof pv === "object" && !Array.isArray(pv) && bv && typeof bv === "object" && !Array.isArray(bv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email;
  const email = sessionEmail ? normalizeEmail(sessionEmail) : "";
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = readProfile(email);
  const canonical = findFacultyByEmail(email);
  const fallbackName = profile.userPreferredName || session?.user?.name || email.split("@")[0];
  const academicRecord =
    typeof profile.academic === "object" && profile.academic ? (profile.academic as AnyObj) : {};

  profile.email = email;
  profile.facultyId = email;
  profile.isFacultyListed = !!canonical;
  profile.officialName = canonical?.name ?? fallbackName;
  profile.googleName = session?.user?.name ?? profile.googleName ?? "";
  profile.googlePhotoURL = session?.user?.image ?? profile.googlePhotoURL ?? "";
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
  const current = readProfile(email);
  const canonical = findFacultyByEmail(email);
  const sanitizedPatch = { ...patch };

  delete sanitizedPatch.email;
  delete sanitizedPatch.facultyId;
  delete sanitizedPatch.officialName;
  delete sanitizedPatch.isFacultyListed;

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
    session?.user?.name ??
    email.split("@")[0];
  merged.googleName = session?.user?.name ?? merged.googleName ?? "";
  merged.googlePhotoURL = session?.user?.image ?? merged.googlePhotoURL ?? "";
  writeProfile(email, merged);

  return NextResponse.json(merged);
}
