import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { atomicWriteTextFile } from "@/lib/data/fileAtomic";
import { getUserStoreDir, getUsersRootDir } from "@/lib/userStore";
import { normalizeEmail } from "@/lib/facultyDirectory";

/**
 * RESEARCH PROFILE — Ph.D. milestones live on the PROFILE, not in an entry
 * category (Elan's S7 ruling, 2026-07). Feeds the phd_awarded (15) and
 * phd_guided (12/scholar) award metrics, bucketed by each viva date's
 * academic year.
 *
 * THE NETWORK (Elan, 2026-07): supervisors and scholars are TAGGED as
 * Internal (a TCE faculty, picked from the registry → email link) or
 * External (free text). Internal tags create real edges between profiles:
 * if faculty A tags B as their supervisor, B's Research tab shows A under
 * "scholars who tagged you" (derived at read time — no denormalised writes,
 * so the data can never drift).
 *
 * Storage: `<users>/<email>/research-profile.json` — INSIDE the user store
 * dir, so it is universe-scoped automatically (demo mode writes fork under
 * /demo and are wiped on exit) and it travels with every per-user data flow.
 */

export type PersonType = "Internal" | "External";

export type OwnPhd = {
  status: "None" | "Pursuing" | "Awarded";
  university: string;
  thesisTitle: string;
  /** Internal = TCE faculty (email links the network); External = free text. */
  supervisorType: PersonType;
  supervisorName: string;
  supervisorEmail: string;
  /** THE date that counts for the award year (T'SEDA rule). */
  vivaDate: string;
};

export type GuidedScholar = {
  id: string;
  /** Internal = TCE faculty pursuing their Ph.D.; External = outside scholar. */
  scholarType: PersonType;
  scholarName: string;
  scholarEmail: string;
  thesisTitle: string;
  university: string;
  vivaDate: string;
};

export type ResearchProfile = {
  version: number;
  ownPhd: OwnPhd;
  guidedScholars: GuidedScholar[];
};

/** A derived network edge: someone tagged this faculty as their supervisor. */
export type SupervisionTag = {
  facultyEmail: string;
  phdStatus: OwnPhd["status"];
  thesisTitle: string;
  vivaDate: string;
};

const VERSION = 1;
const MAX_SCHOLARS = 30;
const MAX_TEXT = 300;

function filePath(email: string): string {
  return path.join(getUserStoreDir(email), "research-profile.json");
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, MAX_TEXT);
}

function cleanDate(value: unknown): string {
  const raw = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function cleanPersonType(value: unknown): PersonType {
  return String(value ?? "") === "Internal" ? "Internal" : "External";
}

export function emptyResearchProfile(): ResearchProfile {
  return {
    version: VERSION,
    ownPhd: {
      status: "None",
      university: "",
      thesisTitle: "",
      supervisorType: "External",
      supervisorName: "",
      supervisorEmail: "",
      vivaDate: "",
    },
    guidedScholars: [],
  };
}

/** Sanitize an untrusted payload into a valid profile (never throws).
 *  Internal tags without a usable email are downgraded to External so the
 *  network never carries dangling edges. */
export function sanitizeResearchProfile(payload: unknown): ResearchProfile {
  const raw = (payload ?? {}) as Record<string, unknown>;
  const ownRaw = (raw.ownPhd ?? {}) as Record<string, unknown>;
  const statusRaw = String(ownRaw.status ?? "None");
  const status: OwnPhd["status"] =
    statusRaw === "Awarded" ? "Awarded" : statusRaw === "Pursuing" ? "Pursuing" : "None";

  let supervisorType = cleanPersonType(ownRaw.supervisorType);
  const supervisorEmail = normalizeEmail(cleanText(ownRaw.supervisorEmail));
  if (supervisorType === "Internal" && !supervisorEmail) supervisorType = "External";

  const scholarsRaw = Array.isArray(raw.guidedScholars) ? raw.guidedScholars : [];
  const guidedScholars: GuidedScholar[] = scholarsRaw
    .slice(0, MAX_SCHOLARS)
    .map((item, index) => {
      const s = (item ?? {}) as Record<string, unknown>;
      let scholarType = cleanPersonType(s.scholarType);
      const scholarEmail = normalizeEmail(cleanText(s.scholarEmail));
      if (scholarType === "Internal" && !scholarEmail) scholarType = "External";
      return {
        id: cleanText(s.id) || `scholar-${index + 1}`,
        scholarType,
        scholarName: cleanText(s.scholarName),
        scholarEmail: scholarType === "Internal" ? scholarEmail : "",
        thesisTitle: cleanText(s.thesisTitle),
        university: cleanText(s.university),
        vivaDate: cleanDate(s.vivaDate),
      };
    })
    .filter((s) => s.scholarName.length > 0);

  return {
    version: VERSION,
    ownPhd: {
      status,
      university: cleanText(ownRaw.university),
      thesisTitle: cleanText(ownRaw.thesisTitle),
      supervisorType,
      supervisorName: cleanText(ownRaw.supervisorName),
      supervisorEmail: supervisorType === "Internal" ? supervisorEmail : "",
      vivaDate: cleanDate(ownRaw.vivaDate),
    },
    guidedScholars,
  };
}

export async function readResearchProfile(email: string): Promise<ResearchProfile> {
  try {
    const raw = await fs.readFile(filePath(normalizeEmail(email)), "utf8");
    return sanitizeResearchProfile(JSON.parse(raw));
  } catch {
    return emptyResearchProfile();
  }
}

export async function writeResearchProfile(
  email: string,
  payload: unknown,
): Promise<ResearchProfile> {
  const profile = sanitizeResearchProfile(payload);
  const target = filePath(normalizeEmail(email));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await atomicWriteTextFile(target, JSON.stringify(profile, null, 2));
  return profile;
}

/** NETWORK EDGE (derived, read-time): every faculty whose own Ph.D. tags
 *  `supervisorEmail` as the internal supervisor. Universe-aware via the
 *  users-root scan — demo profiles resolve inside the demo universe. */
export async function listScholarsWhoTagged(supervisorEmail: string): Promise<SupervisionTag[]> {
  const target = normalizeEmail(supervisorEmail);
  const tags: SupervisionTag[] = [];
  let dirs: string[] = [];
  try {
    const entries = await fs.readdir(getUsersRootDir(), { withFileTypes: true });
    dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return tags;
  }
  for (const dir of dirs) {
    try {
      const raw = await fs.readFile(path.join(getUsersRootDir(), dir, "research-profile.json"), "utf8");
      const profile = sanitizeResearchProfile(JSON.parse(raw));
      if (
        profile.ownPhd.supervisorType === "Internal" &&
        profile.ownPhd.supervisorEmail === target &&
        profile.ownPhd.status !== "None"
      ) {
        tags.push({
          facultyEmail: dir,
          phdStatus: profile.ownPhd.status,
          thesisTitle: profile.ownPhd.thesisTitle,
          vivaDate: profile.ownPhd.vivaDate,
        });
      }
    } catch {
      // No research profile for this user — skip.
    }
  }
  return tags.sort((a, b) => a.facultyEmail.localeCompare(b.facultyEmail));
}
