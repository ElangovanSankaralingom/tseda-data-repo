import {
  computeExperienceTotals,
  durationInclusive,
  ensureNoOverlap,
  formatYMD,
  isISODate,
  rangeValid,
  rangesOverlap,
  todayISO,
  type Experience,
  type FileMeta,
} from "@/lib/experience";

export type { Experience, FileMeta } from "@/lib/experience";
export { uuid, todayISO, formatYMD, durationInclusive, rangeValid } from "@/lib/experience";

export type DocType = "appointmentLetter" | "joiningLetter" | "aadhar" | "panCard";

export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";
export type Designation = "Assistant" | "Senior Assistant" | "Associate" | "Professor";
export type PhdStatus = "Not Enrolled" | "Pursuing" | "Completed";
export type TabKey = "profile" | "personal" | "academic" | "experience" | "uploads";
export const TAB_KEYS: TabKey[] = ["profile", "personal", "academic", "experience", "uploads"];

export const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((value) => ({
  label: value,
  value,
}));
export const DESIGNATION_OPTIONS = ["Assistant", "Senior Assistant", "Associate", "Professor"].map((value) => ({
  label: value,
  value,
}));
export const PHD_STATUS_OPTIONS = ["Not Enrolled", "Pursuing", "Completed"].map((value) => ({
  label: value,
  value,
}));

export type Profile = {
  email: string;
  facultyId?: string;
  officialName?: string;
  isFacultyListed?: boolean;
  googleName?: string;
  googlePhotoURL?: string;
  userPreferredName?: string;

  personal?: {
    dob?: string;
    bloodGroup?: BloodGroup;
    aadharNumber?: string;
    panCardNumber?: string;
  };
  academic?: {
    employeeId?: string;
    dateOfJoiningTCE?: string;
    designation?: Designation;
    phdStatus?: PhdStatus;
  };

  experience?: Experience;

  uploads?: {
    appointmentLetter: FileMeta | null;
    joiningLetter: FileMeta | null;
    aadhar: FileMeta | null;
    panCard: FileMeta | null;
  };
};

export type SaveTabOptions = {
  tab: TabKey;
  draftOverride?: Profile;
};

export type ExperienceCategory = "academicOutsideTCE" | "industry";
export type ExperienceEntryByCategory = {
  academicOutsideTCE: Experience["academicOutsideTCE"][number];
  industry: Experience["industry"][number];
};

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function formatAadharNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

export function normalizePanCardNumber(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

export function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

export function createTabState() {
  return {
    profile: false,
    personal: false,
    academic: false,
    experience: false,
    uploads: false,
  } satisfies Record<TabKey, boolean>;
}

export function normalizePersonal(personal?: Profile["personal"]) {
  return {
    dob: personal?.dob ?? "",
    bloodGroup: personal?.bloodGroup,
    aadharNumber: personal?.aadharNumber ?? "",
    panCardNumber: personal?.panCardNumber ?? "",
  };
}

export function normalizeAcademic(academic?: Profile["academic"]) {
  return {
    employeeId: academic?.employeeId ?? "",
    dateOfJoiningTCE: academic?.dateOfJoiningTCE ?? "",
    designation: academic?.designation,
    phdStatus: academic?.phdStatus,
  };
}

export function normalizeExperienceState(experience?: Experience): Experience {
  return {
    lopPeriods: experience?.lopPeriods ?? [],
    academicOutsideTCE: experience?.academicOutsideTCE ?? [],
    industry: experience?.industry ?? [],
  };
}

export function normalizeUploads(uploads?: Profile["uploads"]) {
  return {
    appointmentLetter: uploads?.appointmentLetter ?? null,
    joiningLetter: uploads?.joiningLetter ?? null,
    aadhar: uploads?.aadhar ?? null,
    panCard: uploads?.panCard ?? null,
  };
}

export function normalizeProfileState(profile: Profile): Profile {
  return {
    ...profile,
    personal: normalizePersonal(profile.personal),
    academic: normalizeAcademic(profile.academic),
    experience: normalizeExperienceState(profile.experience),
    uploads: normalizeUploads(profile.uploads),
  };
}

export function getTabSnapshot(profile: Profile, tab: TabKey) {
  switch (tab) {
    case "profile":
      return {
        email: profile.email ?? "",
        officialName: profile.officialName ?? "",
        userPreferredName: profile.userPreferredName ?? "",
      };
    case "personal":
      return normalizePersonal(profile.personal);
    case "academic":
      return normalizeAcademic(profile.academic);
    case "experience":
      return normalizeExperienceState(profile.experience);
    case "uploads":
      return normalizeUploads(profile.uploads);
  }
}

export function applySavedTabToDraft(currentDraft: Profile, savedProfile: Profile, tab: TabKey): Profile {
  const nextDraft: Profile = {
    ...currentDraft,
    email: savedProfile.email,
    facultyId: savedProfile.facultyId,
    officialName: savedProfile.officialName,
    isFacultyListed: savedProfile.isFacultyListed,
    googleName: savedProfile.googleName,
    googlePhotoURL: savedProfile.googlePhotoURL,
  };

  switch (tab) {
    case "profile":
      nextDraft.userPreferredName = savedProfile.userPreferredName;
      return nextDraft;
    case "personal":
      nextDraft.personal = normalizePersonal(savedProfile.personal);
      return nextDraft;
    case "academic":
      nextDraft.academic = normalizeAcademic(savedProfile.academic);
      return nextDraft;
    case "experience":
      nextDraft.experience = normalizeExperienceState(savedProfile.experience);
      return nextDraft;
    case "uploads":
      nextDraft.uploads = normalizeUploads(savedProfile.uploads);
      return nextDraft;
  }
}

export function buildPatchForTab(tab: TabKey, draft: Profile) {
  switch (tab) {
    case "profile":
      return { userPreferredName: draft.userPreferredName ?? "" };
    case "personal":
      return { personal: normalizePersonal(draft.personal) };
    case "academic":
      return { academic: normalizeAcademic(draft.academic) };
    case "experience":
      return { experience: normalizeExperienceState(draft.experience) };
    case "uploads":
      return { uploads: normalizeUploads(draft.uploads) };
  }
}

export function findExperienceEntry<K extends ExperienceCategory>(
  experience: Experience,
  category: K,
  entryId: string
): ExperienceEntryByCategory[K] | undefined {
  return experience[category].find((entry) => entry.id === entryId) as ExperienceEntryByCategory[K] | undefined;
}

export function updateExperienceCategoryCertificate<K extends ExperienceCategory>(
  experience: Experience,
  category: K,
  entryId: string,
  certificate: FileMeta | null
): Experience {
  const updatedEntries = experience[category].map((entry) =>
    entry.id === entryId ? { ...entry, certificate } : entry
  ) as ExperienceEntryByCategory[K][];

  return {
    ...experience,
    [category]: updatedEntries,
  } as Experience;
}

export function getTabForErrorKey(key: string): TabKey | null {
  if (key === "email") return "profile";
  if (key === "dob" || key === "aadharNumber" || key === "panCardNumber") return "personal";
  if (key === "employeeId" || key === "doj") return "academic";
  if (key.startsWith("lop.") || key.startsWith("ao.") || key.startsWith("in.") || key.startsWith("cross.")) {
    return "experience";
  }
  return null;
}

export function getErrorsForTab(tab: TabKey, errorMap: Record<string, string>) {
  const entries = Object.entries(errorMap);

  switch (tab) {
    case "profile":
      return entries.filter(([key]) => key === "email");
    case "personal":
      return entries.filter(([key]) => key === "dob" || key === "aadharNumber" || key === "panCardNumber");
    case "academic":
      return entries.filter(([key]) => key === "employeeId" || key === "doj");
    case "experience":
      return entries.filter(
        ([key]) =>
          key.startsWith("lop.") ||
          key.startsWith("ao.") ||
          key.startsWith("in.") ||
          key.startsWith("cross.")
      );
    case "uploads":
      return [];
  }
}

export function buildErrors(profile: Profile) {
  const e: Record<string, string> = {};
  const today = todayISO();
  const tceOverlapMessage = "Overlaps TCE employment period (Joining Date .. Today).";
  const appendError = (key: string, message: string) => {
    if (!e[key]) {
      e[key] = message;
      return;
    }
    if (!e[key].includes(message)) {
      e[key] = `${e[key]} ${message}`;
    }
  };
  const currentExp = profile.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };

  const email = (profile.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Valid email is required.";

  const dob = profile.personal?.dob;
  if (dob && !isISODate(dob)) e.dob = "Invalid date.";

  const aadharDigits = (profile.personal?.aadharNumber ?? "").replace(/\D/g, "");
  if (profile.personal?.aadharNumber && aadharDigits.length !== 12) {
    e.aadharNumber = "Aadhar number must be 12 digits.";
  }

  const panCardNumber = (profile.personal?.panCardNumber ?? "").trim();
  if (panCardNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(panCardNumber)) {
    e.panCardNumber = "PAN card number format is invalid.";
  }

  const employeeId = (profile.academic?.employeeId ?? "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(employeeId)) {
    e.employeeId = "Employee ID must be exactly 6 digits.";
  }

  const doj = profile.academic?.dateOfJoiningTCE;
  if (doj && !isISODate(doj)) e.doj = "Invalid date.";

  for (const lop of currentExp.lopPeriods) {
    if (!rangeValid(lop.startDate, lop.endDate)) {
      e[`lop.${lop.id}`] = "Invalid LOP date range.";
      continue;
    }
    if (doj && isISODate(doj)) {
      if (lop.startDate < doj || lop.endDate > today) {
        e[`lop.${lop.id}`] = "LOP must be within Joining Date and Today.";
      }
    }
  }
  for (const lop of currentExp.lopPeriods) {
    const msg = ensureNoOverlap(currentExp.lopPeriods, lop);
    if (msg) e[`lop.${lop.id}`] = msg;
  }

  for (const a of currentExp.academicOutsideTCE) {
    if (!a.institution?.trim()) e[`ao.inst.${a.id}`] = "Institution is required.";
    if (!rangeValid(a.startDate, a.endDate)) e[`ao.range.${a.id}`] = "Invalid date range.";
    const msg = ensureNoOverlap(currentExp.academicOutsideTCE, a);
    if (msg) appendError(`ao.overlap.${a.id}`, msg);
    if (doj && isISODate(doj) && rangeValid(a.startDate, a.endDate) && rangesOverlap(a.startDate, a.endDate, doj, today)) {
      appendError(`ao.overlap.${a.id}`, tceOverlapMessage);
    }
    if (!a.certificate) e[`ao.cert.${a.id}`] = "Certificate is mandatory.";
  }

  for (const x of currentExp.industry) {
    if (!x.organization?.trim()) e[`in.org.${x.id}`] = "Organization is required.";
    if (!x.role?.trim()) e[`in.role.${x.id}`] = "Role is required.";
    if (!rangeValid(x.startDate, x.endDate)) e[`in.range.${x.id}`] = "Invalid date range.";
    const msg = ensureNoOverlap(currentExp.industry, x);
    if (msg) appendError(`in.overlap.${x.id}`, msg);
    if (doj && isISODate(doj) && rangeValid(x.startDate, x.endDate) && rangesOverlap(x.startDate, x.endDate, doj, today)) {
      appendError(`in.overlap.${x.id}`, tceOverlapMessage);
    }
    if (!x.certificate) e[`in.cert.${x.id}`] = "Certificate is mandatory.";
  }

  for (const a of currentExp.academicOutsideTCE) {
    if (!rangeValid(a.startDate, a.endDate)) continue;
    for (const x of currentExp.industry) {
      if (!rangeValid(x.startDate, x.endDate)) continue;
      if (rangesOverlap(a.startDate, a.endDate, x.startDate, x.endDate)) {
        e[`cross.${a.id}`] = "This Academic Outside TCE entry overlaps an Industry entry.";
        e[`cross.${x.id}`] = "This Industry entry overlaps an Academic Outside TCE entry.";
      }
    }
  }

  return e;
}

export function getSectionsForErrors(scopeErrors: Array<[string, string]>) {
  const sections = new Set<string>();

  for (const [key] of scopeErrors) {
    if (key === "email") sections.add("Profile");
    else if (key === "dob" || key === "aadharNumber" || key === "panCardNumber") sections.add("Personal");
    else if (key === "employeeId" || key === "doj") sections.add("Academic");
    else sections.add("Experience");
  }

  return Array.from(sections);
}

export function getTabErrorMessage(tab: TabKey, tabErrors: Array<[string, string]>) {
  if (tab === "experience") {
    return "Experience could not be saved. Fix overlap or validation issues in Experience.";
  }

  if (tab === "uploads") {
    return "Uploads could not be saved. Try the upload action again.";
  }

  const sectionLabel = getSectionsForErrors(tabErrors).join(", ");
  return `${sectionLabel} could not be saved. Fix the highlighted fields.`;
}
