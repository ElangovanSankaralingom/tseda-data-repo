"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DateField from "@/components/controls/DateField";
import SelectDropdown from "@/components/controls/SelectDropdown";
import { RoleButton } from "@/components/ui/RoleButton";
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
  uuid,
} from "@/lib/experience";
import { INDIAN_INSTITUTIONS } from "@/lib/institutions-in";

type BloodGroup = "A+" | "A-" | "B+" | "B-" | "O+" | "O-" | "AB+" | "AB-";
type Designation = "Assistant" | "Senior Assistant" | "Associate" | "Professor";
type PhdStatus = "Not Enrolled" | "Pursuing" | "Completed";
type TabKey = "profile" | "personal" | "academic" | "experience" | "uploads";
const TAB_KEYS: TabKey[] = ["profile", "personal", "academic", "experience", "uploads"];

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((value) => ({
  label: value,
  value,
}));
const DESIGNATION_OPTIONS = ["Assistant", "Senior Assistant", "Associate", "Professor"].map((value) => ({
  label: value,
  value,
}));
const PHD_STATUS_OPTIONS = ["Not Enrolled", "Pursuing", "Completed"].map((value) => ({
  label: value,
  value,
}));

type Profile = {
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

type SaveTabOptions = {
  tab: TabKey;
  draftOverride?: Profile;
};

type ExperienceCategory = "academicOutsideTCE" | "industry";
type ExperienceEntryByCategory = {
  academicOutsideTCE: Experience["academicOutsideTCE"][number];
  industry: Experience["industry"][number];
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatAadharNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 12)
    .replace(/(\d{4})(?=\d)/g, "$1 ")
    .trim();
}

function normalizePanCardNumber(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function stableStringify(value: unknown): string {
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

function createTabState() {
  return {
    profile: false,
    personal: false,
    academic: false,
    experience: false,
    uploads: false,
  } satisfies Record<TabKey, boolean>;
}

function normalizePersonal(personal?: Profile["personal"]) {
  return {
    dob: personal?.dob ?? "",
    bloodGroup: personal?.bloodGroup,
    aadharNumber: personal?.aadharNumber ?? "",
    panCardNumber: personal?.panCardNumber ?? "",
  };
}

function normalizeAcademic(academic?: Profile["academic"]) {
  return {
    employeeId: academic?.employeeId ?? "",
    dateOfJoiningTCE: academic?.dateOfJoiningTCE ?? "",
    designation: academic?.designation,
    phdStatus: academic?.phdStatus,
  };
}

function normalizeExperienceState(experience?: Experience): Experience {
  return {
    lopPeriods: experience?.lopPeriods ?? [],
    academicOutsideTCE: experience?.academicOutsideTCE ?? [],
    industry: experience?.industry ?? [],
  };
}

function normalizeUploads(uploads?: Profile["uploads"]) {
  return {
    appointmentLetter: uploads?.appointmentLetter ?? null,
    joiningLetter: uploads?.joiningLetter ?? null,
    aadhar: uploads?.aadhar ?? null,
    panCard: uploads?.panCard ?? null,
  };
}

function normalizeProfileState(profile: Profile): Profile {
  return {
    ...profile,
    personal: normalizePersonal(profile.personal),
    academic: normalizeAcademic(profile.academic),
    experience: normalizeExperienceState(profile.experience),
    uploads: normalizeUploads(profile.uploads),
  };
}

function getTabSnapshot(profile: Profile, tab: TabKey) {
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

function applySavedTabToDraft(currentDraft: Profile, savedProfile: Profile, tab: TabKey): Profile {
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

function buildPatchForTab(tab: TabKey, draft: Profile) {
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

function findExperienceEntry<K extends ExperienceCategory>(
  experience: Experience,
  category: K,
  entryId: string
): ExperienceEntryByCategory[K] | undefined {
  return experience[category].find((entry) => entry.id === entryId) as ExperienceEntryByCategory[K] | undefined;
}

function updateExperienceCategoryCertificate<K extends ExperienceCategory>(
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

function getTabForErrorKey(key: string): TabKey | null {
  if (key === "email") return "profile";
  if (key === "dob" || key === "aadharNumber" || key === "panCardNumber") return "personal";
  if (key === "employeeId" || key === "doj") return "academic";
  if (key.startsWith("lop.") || key.startsWith("ao.") || key.startsWith("in.") || key.startsWith("cross.")) {
    return "experience";
  }
  return null;
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white/70 p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </div>
  );
}

function MiniButton({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const role =
    variant === "danger"
      ? "destructive"
      : variant === "ghost"
        ? "ghost"
        : "context";

  return (
    <RoleButton
      role={role}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </RoleButton>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden border border-border">
      <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Upload with progress using XHR (fetch doesn’t give upload progress).
 */
function uploadCertificateXHR(opts: {
  category: "academicOutsideTCE" | "industry";
  entryId: string;
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { category, entryId, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/file", true);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress(pct);
    };

    xhr.onerror = () => reject(new Error("Upload failed (network)."));

    xhr.onload = () => {
      try {
        const isJSON = (xhr.getResponseHeader("content-type") || "").includes("application/json");
        const data = isJSON ? JSON.parse(xhr.responseText || "{}") : {};
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as FileMeta);
        } else {
          reject(new Error(data?.error || `Upload failed (${xhr.status}).`));
        }
      } catch {
        reject(new Error("Upload failed (bad response)."));
      }
    };

    const form = new FormData();
    form.set("kind", "certificate");
    form.set("category", category);
    form.set("entryId", entryId);
    form.set("file", file);

    xhr.send(form);
  });
}

function uploadDocXHR(opts: {
  docType: "appointmentLetter" | "joiningLetter" | "aadhar" | "panCard";
  file: File;
  onProgress: (pct: number) => void;
}): Promise<FileMeta> {
  const { docType, file, onProgress } = opts;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/me/file", true);

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      onProgress(pct);
    };

    xhr.onerror = () => reject(new Error("Upload failed (network)."));

    xhr.onload = () => {
      try {
        const isJSON = (xhr.getResponseHeader("content-type") || "").includes("application/json");
        const data = isJSON ? JSON.parse(xhr.responseText || "{}") : {};
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as FileMeta);
        } else {
          reject(new Error(data?.error || `Upload failed (${xhr.status}).`));
        }
      } catch {
        reject(new Error("Upload failed (bad response)."));
      }
    };

    const form = new FormData();
    form.set("kind", "doc");
    form.set("docType", docType);
    form.set("file", file);

    xhr.send(form);
  });
}

export default function AccountPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  // certificate upload UI state
  const [pendingCertFile, setPendingCertFile] = useState<Record<string, File | null>>({});
  const [certProgress, setCertProgress] = useState<Record<string, number>>({});
  const [certBusy, setCertBusy] = useState<Record<string, boolean>>({});
  const [certError, setCertError] = useState<Record<string, string | null>>({});

  // uploads/doc progress state
  const [pendingDocFile, setPendingDocFile] = useState<
    Record<"appointmentLetter" | "joiningLetter" | "aadhar" | "panCard", File | null>
  >({
    appointmentLetter: null,
    joiningLetter: null,
    aadhar: null,
    panCard: null,
  });
  const [docProgress, setDocProgress] = useState<Record<string, number>>({});
  const [docBusy, setDocBusy] = useState<Record<string, boolean>>({});
  const [docError, setDocError] = useState<Record<string, string | null>>({});

  // prevent parallel saves from entry buttons
  const saveLockRef = useRef(false);

  const [profile, setProfile] = useState<Profile>({
    email: "",
    personal: {},
    academic: {},
    experience: { lopPeriods: [], academicOutsideTCE: [], industry: [] },
    uploads: { appointmentLetter: null, joiningLetter: null, aadhar: null, panCard: null },
  });

  const [draft, setDraft] = useState<Profile>(profile);
  const [saveAttemptedTabs, setSaveAttemptedTabs] = useState<Record<TabKey, boolean>>(createTabState());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/me", { cache: "no-store" });
        const p = normalizeProfileState((await r.json()) as Profile);
        setProfile(p);
        setDraft(p);
      } catch {
        setToast({ type: "err", msg: "Failed to load profile." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function setExp(updater: (e: Experience) => Experience) {
    setDraft((d) => {
      const e = d.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      return { ...d, experience: updater(e) };
    });
  }

  const exp = useMemo(
    () => draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] },
    [draft.experience]
  );

  function buildErrors(profile: Profile) {
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

    // Dates
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

    // LOP validation
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

    // Academic Outside
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

    // Industry
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

    // Cross-field overlap (Academic Outside ↔ Industry)
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

  const errors = useMemo(() => buildErrors(draft), [draft]);

  function shouldShowError(key: string) {
    const tab = getTabForErrorKey(key);
    return tab ? saveAttemptedTabs[tab] : false;
  }

  const dirtyByTab = useMemo(
    () =>
      TAB_KEYS.reduce(
        (acc, tab) => ({
          ...acc,
          [tab]: stableStringify(getTabSnapshot(profile, tab)) !== stableStringify(getTabSnapshot(draft, tab)),
        }),
        createTabState()
      ),
    [profile, draft]
  );

  const activeTabDirty = dirtyByTab[activeTab];
  const activeTabErrors = getErrorsForTab(activeTab, errors);
  const hasBlockingErrors = saveAttemptedTabs[activeTab] && activeTabErrors.length > 0;
  const hasVisibleErrors = hasBlockingErrors;
  const experienceDirty = dirtyByTab.experience;

  const totals = useMemo(() => {
    return computeExperienceTotals({
      dateOfJoiningTCE: draft.academic?.dateOfJoiningTCE,
      lopPeriods: exp.lopPeriods,
      academicOutsideTCE: exp.academicOutsideTCE,
      industry: exp.industry,
    });
  }, [draft, exp]);

  function getErrorsForTab(tab: TabKey, errorMap: Record<string, string> = errors) {
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

  function getSectionsForErrors(scopeErrors: Array<[string, string]>) {
    const sections = new Set<string>();

    for (const [key] of scopeErrors) {
      if (key === "email") sections.add("Profile");
      else if (key === "dob" || key === "aadharNumber" || key === "panCardNumber") sections.add("Personal");
      else if (key === "employeeId" || key === "doj") sections.add("Academic");
      else sections.add("Experience");
    }

    return Array.from(sections);
  }

  function getTabErrorMessage(tab: TabKey, tabErrors: Array<[string, string]>) {
    if (tab === "experience") {
      return "Experience could not be saved. Fix overlap or validation issues in Experience.";
    }

    if (tab === "uploads") {
      return "Uploads could not be saved. Try the upload action again.";
    }

    const sectionLabel = getSectionsForErrors(tabErrors).join(", ");
    return `${sectionLabel} could not be saved. Fix the highlighted fields.`;
  }

  async function saveCurrentTab(options: SaveTabOptions) {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      const { tab, draftOverride } = options;
      const draftToSave = options.draftOverride ?? draft;
      const draftErrors = buildErrors(draftToSave);
      const blockingErrors = getErrorsForTab(tab, draftErrors);
      setSaveAttemptedTabs((current) => ({ ...current, [tab]: true }));

      if (blockingErrors.length > 0) {
        setToast({ type: "err", msg: getTabErrorMessage(tab, blockingErrors) });
        return;
      }
      setSaving(true);
      const r = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPatchForTab(tab, draftToSave)),
      });
      const text = await r.text();
      let msg = `Save failed (${r.status})`;
      let payload: Profile | { error?: string } | null = null;

      try {
        payload = text ? (JSON.parse(text) as Profile | { error?: string }) : null;
        if (payload && "error" in payload && payload.error) {
          msg = payload.error;
        }
      } catch {
        payload = null;
      }

      if (!r.ok) throw new Error(msg);

      const updated = normalizeProfileState((payload ?? {}) as Profile);
      setProfile(updated);
      setDraft((current) => applySavedTabToDraft(draftOverride ?? current, updated, tab));
      setSaveAttemptedTabs((current) => ({ ...current, [tab]: false }));
      setToast({ type: "ok", msg: "Saved." });
    } catch (error: unknown) {
      setToast({ type: "err", msg: getErrorMessage(error, "Save failed. Try again.") });
    } finally {
      setSaving(false);
      saveLockRef.current = false;
      setTimeout(() => setToast(null), 2000);
    }
  }

  function cancel() {
    setDraft((current) => applySavedTabToDraft(current, profile, activeTab));
    setSaveAttemptedTabs((current) => ({ ...current, [activeTab]: false }));
    setToast({ type: "ok", msg: "Changes discarded." });
    setTimeout(() => setToast(null), 1200);
  }

  // ✅ FIXED: certificate delete now uses storedPath (required by backend)
  async function deleteCertificate(category: "academicOutsideTCE" | "industry", entryId: string) {
    try {
      const e = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const entry = findExperienceEntry(e, category, entryId);
      const meta: FileMeta | null | undefined = entry?.certificate;

      if (!meta?.storedPath) {
        setToast({ type: "err", msg: "File path missing. Re-upload the certificate once." });
        return;
      }

      const r = await fetch("/api/me/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Delete failed");

      const e2 = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const nextDraft = {
        ...draft,
        experience: updateExperienceCategoryCertificate(e2, category, entryId, null),
      };

      setDraft(nextDraft);

      // clear pending UI state
      const key = `cert:${category}:${entryId}`;
      setPendingCertFile((m) => ({ ...m, [key]: null }));
      setCertProgress((m) => ({ ...m, [key]: 0 }));
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertError((m) => ({ ...m, [key]: null }));

      await saveCurrentTab({ tab: "experience", draftOverride: nextDraft });
    } catch (error: unknown) {
      setToast({ type: "err", msg: getErrorMessage(error, "Delete failed.") });
    }
  }

  async function uploadAndSaveCertificate(category: "academicOutsideTCE" | "industry", entryId: string) {
    const key = `cert:${category}:${entryId}`;
    const file = pendingCertFile[key];

    if (!file) {
      setCertError((m) => ({ ...m, [key]: "Select a file first." }));
      return;
    }

    // local validations: 20MB + type
    const max = 20 * 1024 * 1024;
    const allowed =
      file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg";

    if (!allowed) {
      setCertError((m) => ({ ...m, [key]: "Only PDF/JPG/PNG allowed." }));
      return;
    }
    if (file.size > max) {
      setCertError((m) => ({ ...m, [key]: "Max file size is 20MB." }));
      return;
    }

    try {
      setCertError((m) => ({ ...m, [key]: null }));
      setCertBusy((m) => ({ ...m, [key]: true }));
      setCertProgress((m) => ({ ...m, [key]: 0 }));

      const meta = await uploadCertificateXHR({
        category,
        entryId,
        file,
        onProgress: (pct) => setCertProgress((m) => ({ ...m, [key]: pct })),
      });

      const e = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const nextDraft = {
        ...draft,
        experience: updateExperienceCategoryCertificate(e, category, entryId, meta),
      };

      setDraft(nextDraft);

      setPendingCertFile((m) => ({ ...m, [key]: null }));
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertProgress((m) => ({ ...m, [key]: 100 }));

      await saveCurrentTab({ tab: "experience", draftOverride: nextDraft });
    } catch (error: unknown) {
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertError((m) => ({ ...m, [key]: getErrorMessage(error, "Upload failed.") }));
    }
  }

  async function uploadAndSaveDoc(docType: "appointmentLetter" | "joiningLetter" | "aadhar" | "panCard") {
    const key = `doc:${docType}`;
    const file = pendingDocFile[docType];

    if (!file) {
      setDocError((m) => ({ ...m, [key]: "Select a file first." }));
      return;
    }

    const max = 20 * 1024 * 1024;
    const allowed =
      file.type === "application/pdf" || file.type === "image/png" || file.type === "image/jpeg";

    if (!allowed) {
      setDocError((m) => ({ ...m, [key]: "Only PDF/JPG/PNG allowed." }));
      return;
    }
    if (file.size > max) {
      setDocError((m) => ({ ...m, [key]: "Max file size is 20MB." }));
      return;
    }

    try {
      setDocError((m) => ({ ...m, [key]: null }));
      setDocBusy((m) => ({ ...m, [key]: true }));
      setDocProgress((m) => ({ ...m, [key]: 0 }));

      const meta = await uploadDocXHR({
        docType,
        file,
        onProgress: (pct) => setDocProgress((m) => ({ ...m, [key]: pct })),
      });

      const nextDraft = {
        ...draft,
        uploads: {
          ...(draft.uploads || { appointmentLetter: null, joiningLetter: null, aadhar: null, panCard: null }),
          [docType]: meta,
        },
      };

      setDraft(nextDraft);

      setPendingDocFile((m) => ({ ...m, [docType]: null }));
      setDocBusy((m) => ({ ...m, [key]: false }));
      setDocProgress((m) => ({ ...m, [key]: 100 }));

      await saveCurrentTab({ tab: "uploads", draftOverride: nextDraft });
    } catch (error: unknown) {
      setDocBusy((m) => ({ ...m, [key]: false }));
      setDocError((m) => ({ ...m, [key]: getErrorMessage(error, "Upload failed.") }));
    }
  }

  // ✅ FIXED: doc delete now uses storedPath (required by backend)
  async function deleteDoc(docType: "appointmentLetter" | "joiningLetter" | "aadhar" | "panCard") {
    const meta = draft.uploads?.[docType];
    if (!meta?.storedPath) {
      setToast({ type: "err", msg: "File path missing. Upload again once and Save." });
      return;
    }

    try {
      const r = await fetch("/api/me/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storedPath: meta.storedPath }),
      });

      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Delete failed");

      const nextDraft = {
        ...draft,
        uploads: {
          ...(draft.uploads || {
            appointmentLetter: null,
            joiningLetter: null,
            aadhar: null,
            panCard: null,
          }),
          [docType]: null,
        },
      };

      setDraft(nextDraft);

      await saveCurrentTab({ tab: "uploads", draftOverride: nextDraft });
    } catch (error: unknown) {
      setToast({ type: "err", msg: getErrorMessage(error, "Delete failed.") });
    }
  }

  // Display name for the Profile tab label
  const employeeLabel = useMemo(() => {
    const official = (draft.officialName || "").trim();
    if (official) return official;

    const preferred = (draft.userPreferredName || "").trim();
    if (preferred) return preferred;

    const email = (draft.email || "").trim();
    if (!email) return "Profile";
    return email.split("@")[0];
  }, [draft.officialName, draft.userPreferredName, draft.email]);

  const photo = draft.googlePhotoURL || "";
  const avatarFallback = getInitials(employeeLabel || draft.email || "");

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [photo]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Click Save once you complete your updates.</p>
        </div>

        {activeTabDirty ? (
          <div className="flex items-center gap-2">
            <MiniButton variant="ghost" onClick={cancel} disabled={saving || loading}>
              Cancel
            </MiniButton>
            <MiniButton
              onClick={() => void saveCurrentTab({ tab: activeTab })}
              disabled={saving || loading || hasBlockingErrors || !activeTabDirty}
            >
              {saving ? "Saving..." : "Save"}
            </MiniButton>
          </div>
        ) : null}
      </div>

      {toast ? (
        <div
          className={cx(
            "mt-4 rounded-lg border px-3 py-2 text-sm",
            toast.type === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {toast.msg}
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap gap-2 border-b border-border pb-2">
          {(
            [
              ["profile", employeeLabel],
              ["personal", "Personal"],
              ["academic", "Academic"],
              ["experience", "Experience"],
              ["uploads", "Uploads"],
            ] as Array<[TabKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cx(
                "rounded-full px-4 py-2 text-sm transition border",
                activeTab === key
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent border-border hover:bg-muted"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Loading...</div>
        ) : null}

        {/* PROFILE (Google photo only) */}
        {!loading && activeTab === "profile" ? (
          <SectionCard title="Profile">
            <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-[220px_1fr]">
              <div className="self-stretch">
                <div className="flex h-full min-h-[280px] flex-col items-center justify-start text-center md:-translate-y-6 md:justify-center">
                  <div className="flex items-center justify-center">
                    <div className="h-28 w-28 overflow-hidden rounded-full border border-border bg-muted shadow-sm">
                      {photo && !avatarLoadFailed ? (
                        <img
                          src={photo}
                          alt="Profile"
                          className="h-full w-full object-cover"
                          onError={() => setAvatarLoadFailed(true)}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-muted-foreground">
                          {avatarFallback}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 text-base font-semibold text-center">{employeeLabel}</div>
                  <div className="text-xs text-muted-foreground">
                    Debug: photoURL: {photo ? "present" : "missing"}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <Field label="Email (keyed by email)" error={shouldShowError("email") ? errors.email : undefined} hint="Read-only">
                  <input
                    value={draft.email || ""}
                    readOnly
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Official Name" hint="From faculty directory">
                  <input
                    value={draft.officialName ?? ""}
                    readOnly
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Preferred Name (optional)">
                  <input
                    value={draft.userPreferredName ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, userPreferredName: e.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            </div>
          </SectionCard>
        ) : null}

        {/* PERSONAL */}
        {!loading && activeTab === "personal" ? (
          <SectionCard title="Personal Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of Birth" error={shouldShowError("dob") ? errors.dob : undefined}>
                <DateField
                  value={draft.personal?.dob ?? ""}
                  onChange={(value) =>
                    setDraft((d) => ({ ...d, personal: { ...(d.personal || {}), dob: value } }))
                  }
                  error={shouldShowError("dob") && !!errors.dob}
                />
              </Field>

              <Field label="Blood Group">
                <SelectDropdown
                  value={draft.personal?.bloodGroup ?? ""}
                  onChange={(value) =>
                    setDraft((d) => ({
                      ...d,
                      personal: { ...(d.personal || {}), bloodGroup: (value || undefined) as BloodGroup | undefined },
                    }))
                  }
                  options={BLOOD_GROUP_OPTIONS}
                  placeholder="Select blood group"
                />
              </Field>

              <Field
                label="Aadhar Number"
                error={shouldShowError("aadharNumber") ? errors.aadharNumber : undefined}
                hint="12-digit format"
              >
                <input
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="1234 5678 9012"
                  value={draft.personal?.aadharNumber ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      personal: {
                        ...(d.personal || {}),
                        aadharNumber: formatAadharNumber(e.target.value),
                      },
                    }))
                  }
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    shouldShowError("aadharNumber") && errors.aadharNumber ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field
                label="PAN Card Number"
                error={shouldShowError("panCardNumber") ? errors.panCardNumber : undefined}
                hint="ABCDE1234F"
              >
                <input
                  autoCapitalize="characters"
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={draft.personal?.panCardNumber ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      personal: {
                        ...(d.personal || {}),
                        panCardNumber: normalizePanCardNumber(e.target.value),
                      },
                    }))
                  }
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    shouldShowError("panCardNumber") && errors.panCardNumber ? "border-red-300" : "border-border"
                  )}
                />
              </Field>
            </div>
          </SectionCard>
        ) : null}

        {/* ACADEMIC */}
        {!loading && activeTab === "academic" ? (
          <SectionCard title="Academic Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Employee ID (6 digits)"
                error={shouldShowError("employeeId") ? errors.employeeId : undefined}
                hint="Exactly 6 digits"
              >
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={6}
                  value={draft.academic?.employeeId ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      academic: {
                        ...(d.academic || {}),
                        employeeId: e.target.value.replace(/\D/g, "").slice(0, 6),
                      },
                    }))
                  }
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    shouldShowError("employeeId") && errors.employeeId ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="Date of Joining TCE" error={shouldShowError("doj") ? errors.doj : undefined}>
                <DateField
                  value={draft.academic?.dateOfJoiningTCE ?? ""}
                  onChange={(value) =>
                    setDraft((d) => ({
                      ...d,
                      academic: { ...(d.academic || {}), dateOfJoiningTCE: value },
                    }))
                  }
                  error={shouldShowError("doj") && !!errors.doj}
                />
              </Field>

              <Field label="Current Designation">
                <SelectDropdown
                  value={draft.academic?.designation ?? ""}
                  onChange={(value) =>
                    setDraft((d) => ({
                      ...d,
                      academic: {
                        ...(d.academic || {}),
                        designation: (value || undefined) as Designation | undefined,
                      },
                    }))
                  }
                  options={DESIGNATION_OPTIONS}
                  placeholder="Select designation"
                />
              </Field>

              <Field label="Ph.D. Status">
                <SelectDropdown
                  value={draft.academic?.phdStatus ?? ""}
                  onChange={(value) =>
                    setDraft((d) => ({
                      ...d,
                      academic: {
                        ...(d.academic || {}),
                        phdStatus: (value || undefined) as PhdStatus | undefined,
                      },
                    }))
                  }
                  options={PHD_STATUS_OPTIONS}
                  placeholder="Select Ph.D. status"
                />
              </Field>
            </div>
          </SectionCard>
        ) : null}

        {/* EXPERIENCE */}
        {!loading && activeTab === "experience" ? (
          <div className="space-y-4">
            <SectionCard
              title="Current TCE Experience (Auto)"
              subtitle="Calculated from joining date minus LOP. Updates automatically."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">TCE Experience (after LOP)</div>
                  <div className="mt-1 text-lg font-semibold">{formatYMD(totals.tce)}</div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">Academic Total</div>
                  <div className="mt-1 text-lg font-semibold">{formatYMD(totals.academicTotal)}</div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">Overall Total</div>
                  <div className="mt-1 text-lg font-semibold">{formatYMD(totals.overallTotal)}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Leave on Loss of Pay (LOP)" subtitle="LOP periods must not overlap and must be within Joining Date..Today.">
              <div className="flex justify-end">
                <MiniButton
                  onClick={() =>
                    setExp((e) => ({
                      ...e,
                      lopPeriods: [...e.lopPeriods, { id: uuid(), startDate: todayISO(), endDate: todayISO() }],
                    }))
                  }
                >
                  + Add LOP
                </MiniButton>
              </div>

              <div className="mt-4 space-y-3">
                {exp.lopPeriods.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No LOP periods added.</div>
                ) : null}

                {exp.lopPeriods.map((lop) => {
                  const duration =
                    rangeValid(lop.startDate, lop.endDate) ? formatYMD(durationInclusive(lop.startDate, lop.endDate)) : "";
                  return (
                    <div key={lop.id} className="rounded-xl border border-border p-3">
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                        <Field
                          label="Start date"
                          error={shouldShowError(`lop.${lop.id}`) ? errors[`lop.${lop.id}`] : undefined}
                          hint={duration ? `Duration: ${duration}` : undefined}
                        >
                          <DateField
                            value={lop.startDate}
                            onChange={(value) =>
                              setExp((e) => ({
                                ...e,
                                lopPeriods: e.lopPeriods.map((x) => (x.id === lop.id ? { ...x, startDate: value } : x)),
                              }))
                            }
                            error={shouldShowError(`lop.${lop.id}`) && !!errors[`lop.${lop.id}`]}
                          />
                        </Field>

                        <Field label="End date">
                          <DateField
                            value={lop.endDate}
                            onChange={(value) =>
                              setExp((e) => ({
                                ...e,
                                lopPeriods: e.lopPeriods.map((x) => (x.id === lop.id ? { ...x, endDate: value } : x)),
                              }))
                            }
                          />
                        </Field>

                        <MiniButton
                          variant="danger"
                          onClick={() => setExp((e) => ({ ...e, lopPeriods: e.lopPeriods.filter((x) => x.id !== lop.id) }))}
                        >
                          Delete
                        </MiniButton>
                      </div>
                      {shouldShowError(`lop.${lop.id}`) && errors[`lop.${lop.id}`] ? (
                        <div className="mt-2 text-xs text-red-600">{errors[`lop.${lop.id}`]}</div>
                      ) : null}
                      <div className="mt-3 flex justify-end">
                        {experienceDirty ? (
                          <MiniButton
                            onClick={() => void saveCurrentTab({ tab: "experience" })}
                            disabled={saving || loading || (saveAttemptedTabs.experience && getErrorsForTab("experience").length > 0) || !experienceDirty}
                          >
                            Save this section
                          </MiniButton>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Academic Experience Outside TCE" subtitle="No overlaps within list and no overlaps with Industry. Certificate mandatory.">
              <div className="flex justify-end">
                <MiniButton
                  onClick={() =>
                    setExp((e) => ({
                      ...e,
                      academicOutsideTCE: [
                        ...e.academicOutsideTCE,
                        { id: uuid(), institution: "", startDate: todayISO(), endDate: todayISO(), certificate: null },
                      ],
                    }))
                  }
                >
                  + Add Outside Academic
                </MiniButton>
              </div>

              <datalist id="indian-institutions">
                {INDIAN_INSTITUTIONS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>

              <div className="mt-4 space-y-3">
                {exp.academicOutsideTCE.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No entries.</div>
                ) : null}

                {exp.academicOutsideTCE.map((a) => {
                  const duration =
                    rangeValid(a.startDate, a.endDate) ? formatYMD(durationInclusive(a.startDate, a.endDate)) : "";
                  const key = `cert:academicOutsideTCE:${a.id}`;
                  const pending = pendingCertFile[key];
                  const busy = !!certBusy[key];
                  const pct = certProgress[key] ?? 0;
                  const localErr = certError[key];

                  const canUploadAndSave = !busy && !!pending;

                  return (
                    <div key={a.id} className="rounded-xl border border-border p-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                          label="Institution"
                          error={shouldShowError(`ao.inst.${a.id}`) ? errors[`ao.inst.${a.id}`] : undefined}
                          hint="Type to search; custom allowed"
                        >
                          <input
                            list="indian-institutions"
                            value={a.institution}
                            onChange={(ev) =>
                              setExp((e) => ({
                                ...e,
                                academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                                  x.id === a.id ? { ...x, institution: ev.target.value } : x
                                ),
                              }))
                            }
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                          />
                        </Field>

                        <div className="grid gap-3 grid-cols-2">
                          <Field
                            label="Start"
                            error={
                              shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)
                                ? errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`]
                                : undefined
                            }
                            hint={duration ? `Duration: ${duration}` : undefined}
                          >
                            <DateField
                              value={a.startDate}
                              onChange={(value) =>
                                setExp((e) => ({
                                  ...e,
                                  academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                                    x.id === a.id ? { ...x, startDate: value } : x
                                  ),
                                }))
                              }
                              error={!!(
                                (shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)) &&
                                (errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`])
                              )}
                            />
                          </Field>

                          <Field
                            label="End"
                            error={
                              shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)
                                ? errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`]
                                : undefined
                            }
                          >
                            <DateField
                              value={a.endDate}
                              onChange={(value) =>
                                setExp((e) => ({
                                  ...e,
                                  academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                                    x.id === a.id ? { ...x, endDate: value } : x
                                  ),
                                }))
                              }
                              error={!!(
                                (shouldShowError(`ao.range.${a.id}`) || shouldShowError(`ao.overlap.${a.id}`) || shouldShowError(`cross.${a.id}`)) &&
                                (errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`])
                              )}
                            />
                          </Field>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">Certificate (mandatory)</div>

                            {a.certificate ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                <a className="underline" href={a.certificate.url} target="_blank">
                                  {a.certificate.fileName}
                                </a>{" "}
                                • {new Date(a.certificate.uploadedAt).toLocaleString()}
                              </div>
                            ) : shouldShowError(`ao.cert.${a.id}`) ? (
                              <div className="mt-1 text-xs text-red-600">{errors[`ao.cert.${a.id}`] || "Certificate is mandatory."}</div>
                            ) : null}

                            <div className="mt-2 text-xs text-muted-foreground">
                              {pending ? `Selected: ${pending.name}` : "Select a file to enable Upload & Save."}
                            </div>

                            {busy ? (
                              <div className="mt-2 space-y-2">
                                <ProgressBar value={pct} />
                                <div className="text-xs text-muted-foreground">{pct}% uploading…</div>
                              </div>
                            ) : null}

                            {localErr ? <div className="mt-2 text-xs text-red-600">{localErr}</div> : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {a.certificate ? (
                              <MiniButton variant="danger" onClick={() => void deleteCertificate("academicOutsideTCE", a.id)} disabled={busy}>
                                Delete Certificate
                              </MiniButton>
                            ) : null}

                            <label
                              className={cx(
                                "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                                busy
                                  ? "pointer-events-none cursor-not-allowed opacity-60"
                                  : "cursor-pointer transition hover:bg-muted"
                              )}
                            >
                              Choose file
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  e.currentTarget.value = "";
                                  setPendingCertFile((m) => ({ ...m, [key]: f }));
                                  setCertError((m) => ({ ...m, [key]: null }));
                                  setCertProgress((m) => ({ ...m, [key]: 0 }));
                                }}
                              />
                            </label>

                            <MiniButton
                              onClick={() => void uploadAndSaveCertificate("academicOutsideTCE", a.id)}
                              disabled={!canUploadAndSave}
                            >
                              Upload & Save
                            </MiniButton>

                            <MiniButton
                              variant="danger"
                              onClick={() =>
                                setExp((e) => ({ ...e, academicOutsideTCE: e.academicOutsideTCE.filter((x) => x.id !== a.id) }))
                              }
                              disabled={busy}
                            >
                              Delete entry
                            </MiniButton>
                          </div>
                        </div>
                      </div>

                      {shouldShowError(`cross.${a.id}`) && errors[`cross.${a.id}`] ? <div className="text-xs text-red-600">{errors[`cross.${a.id}`]}</div> : null}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Industry Experience" subtitle="Role + certificate mandatory. No overlaps within list and no overlaps with Academic Outside TCE.">
              <div className="flex justify-end">
                <MiniButton
                  onClick={() =>
                    setExp((e) => ({
                      ...e,
                      industry: [
                        ...e.industry,
                        { id: uuid(), organization: "", role: "", startDate: todayISO(), endDate: todayISO(), certificate: null },
                      ],
                    }))
                  }
                >
                  + Add Industry
                </MiniButton>
              </div>

              <div className="mt-4 space-y-3">
                {exp.industry.length === 0 ? <div className="text-sm text-muted-foreground">No entries.</div> : null}

                {exp.industry.map((x) => {
                  const duration =
                    rangeValid(x.startDate, x.endDate) ? formatYMD(durationInclusive(x.startDate, x.endDate)) : "";
                  const key = `cert:industry:${x.id}`;
                  const pending = pendingCertFile[key];
                  const busy = !!certBusy[key];
                  const pct = certProgress[key] ?? 0;
                  const localErr = certError[key];

                  const canUploadAndSave = !busy && !!pending;

                  return (
                    <div key={x.id} className="rounded-xl border border-border p-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Company / Organization" error={shouldShowError(`in.org.${x.id}`) ? errors[`in.org.${x.id}`] : undefined}>
                          <input
                            value={x.organization}
                            onChange={(ev) =>
                              setExp((e) => ({
                                ...e,
                                industry: e.industry.map((it) => (it.id === x.id ? { ...it, organization: ev.target.value } : it)),
                              }))
                            }
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                          />
                        </Field>

                        <Field label="Role (mandatory)" error={shouldShowError(`in.role.${x.id}`) ? errors[`in.role.${x.id}`] : undefined}>
                          <input
                            value={x.role}
                            onChange={(ev) =>
                              setExp((e) => ({
                                ...e,
                                industry: e.industry.map((it) => (it.id === x.id ? { ...it, role: ev.target.value } : it)),
                              }))
                            }
                            className={cx(
                              "w-full rounded-lg border px-3 py-2 text-sm",
                              shouldShowError(`in.role.${x.id}`) && errors[`in.role.${x.id}`] ? "border-red-300" : "border-border"
                            )}
                          />
                        </Field>

                        <div className="grid gap-3 grid-cols-2 sm:col-span-2">
                          <Field
                            label="Start"
                            error={
                              shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)
                                ? errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`]
                                : undefined
                            }
                            hint={duration ? `Duration: ${duration}` : undefined}
                          >
                            <DateField
                              value={x.startDate}
                              onChange={(value) =>
                                setExp((e) => ({
                                  ...e,
                                  industry: e.industry.map((it) => (it.id === x.id ? { ...it, startDate: value } : it)),
                                }))
                              }
                              error={!!(
                                (shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)) &&
                                (errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`])
                              )}
                            />
                          </Field>

                          <Field
                            label="End"
                            error={
                              shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)
                                ? errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`]
                                : undefined
                            }
                          >
                            <DateField
                              value={x.endDate}
                              onChange={(value) =>
                                setExp((e) => ({
                                  ...e,
                                  industry: e.industry.map((it) => (it.id === x.id ? { ...it, endDate: value } : it)),
                                }))
                              }
                              error={!!(
                                (shouldShowError(`in.range.${x.id}`) || shouldShowError(`in.overlap.${x.id}`) || shouldShowError(`cross.${x.id}`)) &&
                                (errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`])
                              )}
                            />
                          </Field>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">Certificate (mandatory)</div>

                            {x.certificate ? (
                              <div className="mt-1 text-xs text-muted-foreground">
                                <a className="underline" href={x.certificate.url} target="_blank">
                                  {x.certificate.fileName}
                                </a>{" "}
                                • {new Date(x.certificate.uploadedAt).toLocaleString()}
                              </div>
                            ) : shouldShowError(`in.cert.${x.id}`) ? (
                              <div className="mt-1 text-xs text-red-600">{errors[`in.cert.${x.id}`] || "Certificate is mandatory."}</div>
                            ) : null}

                            <div className="mt-2 text-xs text-muted-foreground">
                              {pending ? `Selected: ${pending.name}` : "Select a file to enable Upload & Save."}
                            </div>

                            {busy ? (
                              <div className="mt-2 space-y-2">
                                <ProgressBar value={pct} />
                                <div className="text-xs text-muted-foreground">{pct}% uploading…</div>
                              </div>
                            ) : null}

                            {localErr ? <div className="mt-2 text-xs text-red-600">{localErr}</div> : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {x.certificate ? (
                              <MiniButton variant="danger" onClick={() => void deleteCertificate("industry", x.id)} disabled={busy}>
                                Delete Certificate
                              </MiniButton>
                            ) : null}

                            <label
                              className={cx(
                                "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                                busy
                                  ? "pointer-events-none cursor-not-allowed opacity-60"
                                  : "cursor-pointer transition hover:bg-muted"
                              )}
                            >
                              Choose file
                              <input
                                type="file"
                                className="hidden"
                                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  e.currentTarget.value = "";
                                  setPendingCertFile((m) => ({ ...m, [key]: f }));
                                  setCertError((m) => ({ ...m, [key]: null }));
                                  setCertProgress((m) => ({ ...m, [key]: 0 }));
                                }}
                              />
                            </label>

                            <MiniButton onClick={() => void uploadAndSaveCertificate("industry", x.id)} disabled={!canUploadAndSave}>
                              Upload & Save
                            </MiniButton>

                            <MiniButton
                              variant="danger"
                              onClick={() => setExp((e) => ({ ...e, industry: e.industry.filter((it) => it.id !== x.id) }))}
                              disabled={busy}
                            >
                              Delete entry
                            </MiniButton>
                          </div>
                        </div>
                      </div>

                      {shouldShowError(`cross.${x.id}`) && errors[`cross.${x.id}`] ? <div className="text-xs text-red-600">{errors[`cross.${x.id}`]}</div> : null}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Totals" subtitle="Totals update automatically.">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">Academic Outside TCE</div>
                  <div className="mt-1 text-lg font-semibold">{formatYMD(totals.academicOutside)}</div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">Industry Total</div>
                  <div className="mt-1 text-lg font-semibold">{formatYMD(totals.industryTotal)}</div>
                </div>
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">Overall Total</div>
                  <div className="mt-1 text-lg font-semibold">{formatYMD(totals.overallTotal)}</div>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {/* UPLOADS */}
        {!loading && activeTab === "uploads" ? (
          <SectionCard title="Uploads" subtitle="Single file each. Max 20MB. Choose file → Upload & Save → Preview.">
            <div className="space-y-4">
              {(
                [
                  ["appointmentLetter", "Appointment Letter"],
                  ["joiningLetter", "Joining Letter"],
                  ["aadhar", "Aadhar"],
                  ["panCard", "PAN Card"],
                ] as const
              ).map(([docType, label]) => {
                const key = `doc:${docType}`;
                const meta = draft.uploads?.[docType] ?? null;
                const pending = pendingDocFile[docType];
                const busy = !!docBusy[key];
                const pct = docProgress[key] ?? 0;
                const err = docError[key];

                const canUploadAndSave = !!pending && !busy;

                return (
                  <div key={docType} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{label}</div>

                        {meta ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <a className="underline" href={meta.url} target="_blank">
                              {meta.fileName}
                            </a>{" "}
                            • {(meta.size / (1024 * 1024)).toFixed(2)} MB • {new Date(meta.uploadedAt).toLocaleString()}
                          </div>
                        ) : (
                          <div className="mt-1 text-xs text-muted-foreground">No file uploaded.</div>
                        )}

                        <div className="mt-2 text-xs text-muted-foreground">
                          {pending ? `Selected: ${pending.name}` : "Select a file to enable Upload & Save."}
                        </div>

                        {busy ? (
                          <div className="mt-2 space-y-2">
                            <ProgressBar value={pct} />
                            <div className="text-xs text-muted-foreground">{pct}% uploading…</div>
                          </div>
                        ) : null}

                        {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {meta ? (
                          <>
                            <a
                              href={meta.url}
                              target="_blank"
                              className="px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted transition"
                            >
                              Preview
                            </a>
                            <MiniButton variant="danger" onClick={() => void deleteDoc(docType)} disabled={busy}>
                              Delete
                            </MiniButton>
                          </>
                        ) : null}

                        <label
                          className={cx(
                            "inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-sm",
                            busy
                              ? "pointer-events-none cursor-not-allowed opacity-60"
                              : "cursor-pointer transition hover:bg-muted"
                          )}
                        >
                          Choose file
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              e.currentTarget.value = "";
                              setPendingDocFile((m) => ({ ...m, [docType]: f }));
                              setDocError((m) => ({ ...m, [key]: null }));
                              setDocProgress((m) => ({ ...m, [key]: 0 }));
                            }}
                          />
                        </label>

                        <MiniButton onClick={() => void uploadAndSaveDoc(docType)} disabled={!canUploadAndSave}>
                          Upload & Save
                        </MiniButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        ) : null}

        {hasVisibleErrors && !loading ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            There are validation issues. Fix them before saving.
          </div>
        ) : null}
      </div>
    </div>
  );
}
