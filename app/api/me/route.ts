// app/api/me/route.ts
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { ensureDirs, PROFILES_DIR, safeEmailKey } from "@/lib/uploadStore";

type AnyObj = Record<string, any>;

function readProfile(email: string): AnyObj {
  ensureDirs();
  const key = safeEmailKey(email);
  const file = path.join(PROFILES_DIR, `${key}.json`);
  if (!fs.existsSync(file)) {
    const seed = {
      email,
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
  const session = await getServerSession();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = readProfile(email);

  // Sync google fields if available
  profile.googleName = session?.user?.name ?? profile.googleName ?? "";
  profile.googlePhotoURL = session?.user?.image ?? profile.googlePhotoURL ?? "";
  if (!profile.userPreferredName) profile.userPreferredName = profile.googleName || "";

  writeProfile(email, profile);
  return NextResponse.json(profile);
}

export async function PUT(req: Request) {
  const session = await getServerSession();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patch = (await req.json()) as AnyObj;
  const current = readProfile(email);

  // Always keep email keyed by auth
  patch.email = email;

  const merged = deepMerge(current, patch);
  writeProfile(email, merged);

  return NextResponse.json(merged);
}
