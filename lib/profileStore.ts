import { readJson, writeJson, newId } from "@/lib/storage";

export type BloodGroup = "A+"|"A-"|"B+"|"B-"|"O+"|"O-"|"AB+"|"AB-";
export type Designation =
  | "Assistant Professor"
  | "Senior Assistant Professor"
  | "Associate Professor"
  | "Professor";
export type PhdStatus = "Not Enrolled" | "Pursuing" | "Completed";

export type StoredFile = {
  path: string;        // absolute path on disk
  fileName: string;
  contentType: string;
  uploadedAt: string;  // ISO
};

export type LopPeriod = {
  id: string;
  startDate: string;    // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD (optional, means today)
};

export type OutsideAcademic = {
  id: string;
  institution: string;
  startDate: string;
  endDate: string;
  certificate?: StoredFile;
};

export type IndustryExp = {
  id: string;
  company: string;
  role: string;          // mandatory
  startDate: string;
  endDate: string;
  certificate?: StoredFile;
};

export type ThemeMode = "light" | "dark";

export type Profile = {
  email: string;

  googleDisplayName: string;
  googlePhotoURL?: string;

  userPreferredName: string;

  settings: {
    theme: ThemeMode;
  };

  avatar: {
    mode: "google" | "custom";
    custom?: StoredFile;
  };

  personal: {
    dob?: string;
    bloodGroup?: BloodGroup;
  };

  academic: {
    dateOfJoiningTce?: string;
    designation?: Designation;
    phdStatus?: PhdStatus;
  };

  experience: {
    lop: LopPeriod[];
    academicOutside: OutsideAcademic[];
    industry: IndustryExp[];
  };

  createdAt: string;
  updatedAt: string;
};

const FILE = "profiles.json";

export async function getAllProfiles(): Promise<Record<string, Profile>> {
  return await readJson<Record<string, Profile>>(FILE, {});
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const all = await getAllProfiles();
  return all[email.toLowerCase()] ?? null;
}

export async function upsertProfile(email: string, patch: Partial<Profile>): Promise<Profile> {
  const key = email.toLowerCase();
  const all = await getAllProfiles();
  const now = new Date().toISOString();

  const existing = all[key];

  const base: Profile =
    existing ??
    {
      email: key,
      googleDisplayName: patch.googleDisplayName ?? key.split("@")[0],
      googlePhotoURL: patch.googlePhotoURL,
      userPreferredName: patch.userPreferredName ?? (patch.googleDisplayName ?? key.split("@")[0]),
      settings: patch.settings ?? { theme: "light" },
      avatar: patch.avatar ?? { mode: "google" },
      personal: patch.personal ?? {},
      academic: patch.academic ?? {},
      experience: patch.experience ?? { lop: [], academicOutside: [], industry: [] },
      createdAt: now,
      updatedAt: now,
    };

  const next: Profile = {
    ...base,
    ...patch,
    settings: patch.settings ? { ...base.settings, ...patch.settings } : base.settings,
    avatar: patch.avatar ?? base.avatar,
    personal: patch.personal ? { ...base.personal, ...patch.personal } : base.personal,
    academic: patch.academic ? { ...base.academic, ...patch.academic } : base.academic,
    experience: patch.experience ? { ...base.experience, ...patch.experience } : base.experience,
    updatedAt: now,
  };

  all[key] = next;
  await writeJson(FILE, all);
  return next;
}

export function makeId() {
  return newId();
}
