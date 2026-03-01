"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type Profile = {
  email: string;
  googleName?: string;
  googlePhotoURL?: string;
  userPreferredName?: string;

  personal?: {
    dob?: string;
    bloodGroup?: BloodGroup;
    aadharNumber?: string;
    panCardNumber?: string;
  };
  academic?: { dateOfJoiningTCE?: string; designation?: Designation; phdStatus?: PhdStatus };

  experience?: Experience;

  uploads?: {
    appointmentLetter: FileMeta | null;
    joiningLetter: FileMeta | null;
    aadhar: FileMeta | null;
    panCard: FileMeta | null;
  };
};

type SaveScope = "all" | "uploads" | "experience";

type SaveAllOptions = {
  scope?: SaveScope;
  draftOverride?: Profile;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
    <div className="rounded-2xl border border-border bg-white/70 dark:bg-black/20 p-5">
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
  const base = "px-3 py-2 rounded-lg text-sm border";
  const activeCls =
    variant === "danger"
      ? "border-border text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
      : variant === "ghost"
      ? "border-border transition hover:bg-muted"
      : "border-foreground bg-foreground text-background transition hover:opacity-90";
  const disabledCls =
    variant === "default"
      ? "border-border bg-muted text-muted-foreground pointer-events-none cursor-not-allowed opacity-60"
      : "border-border text-muted-foreground bg-transparent pointer-events-none cursor-not-allowed opacity-60";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(base, disabled ? disabledCls : activeCls)}
    >
      {children}
    </button>
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

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const r = await fetch("/api/me", { cache: "no-store" });
        const p = (await r.json()) as Profile;
        p.experience = p.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
        p.uploads = p.uploads ?? { appointmentLetter: null, joiningLetter: null, aadhar: null, panCard: null };
        p.uploads.panCard = p.uploads.panCard ?? null;
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

  const exp = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };

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

    // Mandatory overall save
    if ((profile.userPreferredName ?? "").trim().length === 0) e.userPreferredName = "Name is required.";

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

  const hasErrors = Object.keys(errors).length > 0;
  const experienceErrorKeys = Object.keys(errors).filter(
    (key) =>
      key.startsWith("lop.") ||
      key.startsWith("ao.") ||
      key.startsWith("in.") ||
      key.startsWith("cross.")
  );
  const hasExperienceErrors = experienceErrorKeys.length > 0;

  const totals = useMemo(() => {
    return computeExperienceTotals({
      dateOfJoiningTCE: draft.academic?.dateOfJoiningTCE,
      lopPeriods: exp.lopPeriods,
      academicOutsideTCE: exp.academicOutsideTCE,
      industry: exp.industry,
    });
  }, [draft, exp]);

  function getErrorsForScope(scope: SaveScope, errorMap: Record<string, string> = errors) {
    const entries = Object.entries(errorMap);

    if (scope === "all") return entries;
    if (scope === "uploads") {
      return entries.filter(([key]) => key === "userPreferredName" || key === "email");
    }

    return entries.filter(
      ([key]) =>
        key.startsWith("lop.") ||
        key.startsWith("ao.") ||
        key.startsWith("in.") ||
        key.startsWith("cross.")
    );
  }

  function getSectionsForErrors(scopeErrors: Array<[string, string]>) {
    const sections = new Set<string>();

    for (const [key] of scopeErrors) {
      if (key === "userPreferredName" || key === "email") sections.add("Profile");
      else if (key === "dob" || key === "aadharNumber" || key === "panCardNumber") sections.add("Personal");
      else if (key === "doj") sections.add("Academic");
      else sections.add("Experience");
    }

    return Array.from(sections);
  }

  function getScopeErrorMessage(scope: SaveScope, scopeErrors: Array<[string, string]>) {
    const sections = getSectionsForErrors(scopeErrors);
    const sectionLabel = sections.join(", ");

    if (scope === "uploads") {
      return `Uploads could not be saved. Fix issues in ${sectionLabel}.`;
    }

    if (scope === "experience") {
      return "Experience could not be saved. Fix overlap or validation issues in Experience.";
    }

    return `Save blocked. Fix issues in ${sectionLabel}.`;
  }

  async function saveAll(options: SaveAllOptions = {}) {
    if (saveLockRef.current) return;
    saveLockRef.current = true;

    try {
      const scope = options.scope ?? "all";
      const draftToSave = options.draftOverride ?? draft;
      const draftErrors = buildErrors(draftToSave);
      const blockingErrors = getErrorsForScope(scope, draftErrors);

      if (blockingErrors.length > 0) {
        setToast({ type: "err", msg: getScopeErrorMessage(scope, blockingErrors) });
        return;
      }
      setSaving(true);
      const r = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftToSave),
      });
      if (!r.ok) throw new Error("Save failed");
      const updated = (await r.json()) as Profile;
      updated.experience = updated.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      updated.uploads = updated.uploads ?? { appointmentLetter: null, joiningLetter: null, aadhar: null, panCard: null };
      updated.uploads.panCard = updated.uploads.panCard ?? null;
      setProfile(updated);
      setDraft(updated);
      setToast({ type: "ok", msg: "Saved." });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "Save failed. Try again." });
    } finally {
      setSaving(false);
      saveLockRef.current = false;
      setTimeout(() => setToast(null), 2000);
    }
  }

  function cancel() {
    setDraft(profile);
    setToast({ type: "ok", msg: "Changes discarded." });
    setTimeout(() => setToast(null), 1200);
  }

  // ✅ FIXED: certificate delete now uses storedPath (required by backend)
  async function deleteCertificate(category: "academicOutsideTCE" | "industry", entryId: string) {
    try {
      const e = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };
      const entry = (e[category] as any[]).find((x) => x.id === entryId);
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
      const list = (e2[category] as any[]).map((x) => (x.id === entryId ? { ...x, certificate: null } : x));
      const nextDraft = { ...draft, experience: { ...e2, [category]: list } as any };

      setDraft(nextDraft);

      // clear pending UI state
      const key = `cert:${category}:${entryId}`;
      setPendingCertFile((m) => ({ ...m, [key]: null }));
      setCertProgress((m) => ({ ...m, [key]: 0 }));
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertError((m) => ({ ...m, [key]: null }));

      await saveAll({ scope: "experience", draftOverride: nextDraft });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "Delete failed." });
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
      const list = (e[category] as any[]).map((x) => (x.id === entryId ? { ...x, certificate: meta } : x));
      const nextDraft = { ...draft, experience: { ...e, [category]: list } as any };

      setDraft(nextDraft);

      setPendingCertFile((m) => ({ ...m, [key]: null }));
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertProgress((m) => ({ ...m, [key]: 100 }));

      await saveAll({ scope: "experience", draftOverride: nextDraft });
    } catch (e: any) {
      setCertBusy((m) => ({ ...m, [key]: false }));
      setCertError((m) => ({ ...m, [key]: e?.message || "Upload failed." }));
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

      await saveAll({ scope: "uploads", draftOverride: nextDraft });
    } catch (e: any) {
      setDocBusy((m) => ({ ...m, [key]: false }));
      setDocError((m) => ({ ...m, [key]: e?.message || "Upload failed." }));
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

      await saveAll({ scope: "uploads", draftOverride: nextDraft });
    } catch (e: any) {
      setToast({ type: "err", msg: e?.message || "Delete failed." });
    }
  }

  // Display name for the Profile tab label
  const employeeLabel = useMemo(() => {
    const preferred = (draft.userPreferredName || "").trim();
    if (preferred) return preferred;

    const g = (draft.googleName || "").trim();
    if (g) return g;

    const email = (draft.email || "").trim();
    if (!email) return "Profile";
    return email.split("@")[0];
  }, [draft.userPreferredName, draft.googleName, draft.email]);

  const photo = draft.googlePhotoURL || "";

  // Experience feedback mechanics
  const expFeedback = useMemo(() => {
    const exp = draft.experience ?? { lopPeriods: [], academicOutsideTCE: [], industry: [] };

    const academicMissingCert = exp.academicOutsideTCE.filter((x) => !x.certificate).length;
    const industryMissingCert = exp.industry.filter((x) => !x.certificate).length;

    const industryMissingRole = exp.industry.filter((x) => !(x.role || "").trim()).length;
    const industryMissingOrg = exp.industry.filter((x) => !(x.organization || "").trim()).length;

    const lopIssues = exp.lopPeriods.filter((lop) => !!errors[`lop.${lop.id}`]).length;

    const overlapIssues =
      exp.academicOutsideTCE.filter((x) => !!errors[`ao.overlap.${x.id}`] || !!errors[`cross.${x.id}`]).length +
      exp.industry.filter((x) => !!errors[`in.overlap.${x.id}`] || !!errors[`cross.${x.id}`]).length;

    // Completion score (simple but effective)
    const totalEntries = exp.academicOutsideTCE.length + exp.industry.length;
    const totalCertMissing = academicMissingCert + industryMissingCert;

    const certScore = totalEntries === 0 ? 40 : Math.max(0, 40 - Math.round((totalCertMissing / totalEntries) * 40));
    const rangeScore = Math.max(0, 30 - Math.min(30, overlapIssues * 10));
    const reqScore = Math.max(0, 30 - Math.min(30, (industryMissingRole + industryMissingOrg + lopIssues) * 5));
    const score = Math.max(0, Math.min(100, certScore + rangeScore + reqScore));

    let nextAction = "Add an entry and upload certificates to compute totals accurately.";
    if (totalEntries > 0) {
      if (totalCertMissing > 0) nextAction = "Upload the missing certificates (mandatory) to complete Experience.";
      else if (overlapIssues > 0) nextAction = "Fix the overlapping date ranges to proceed.";
      else if (industryMissingRole > 0) nextAction = "Fill mandatory Role fields for Industry entries.";
      else if (industryMissingOrg > 0) nextAction = "Fill mandatory Organization fields for Industry entries.";
      else if (lopIssues > 0) nextAction = "Fix LOP date issues (range/overlap/within joining date).";
      else nextAction = "Looks good. Click Save to finalize.";
    }

    return {
      academicMissingCert,
      industryMissingCert,
      industryMissingRole,
      industryMissingOrg,
      lopIssues,
      overlapIssues,
      score,
      nextAction,
    };
  }, [draft.experience, errors]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Click Save once you complete your updates.</p>
        </div>

        <div className="flex gap-2">
          <MiniButton variant="ghost" onClick={cancel} disabled={saving || loading}>
            Cancel
          </MiniButton>
          <MiniButton onClick={() => void saveAll()} disabled={saving || loading || hasErrors}>
            {saving ? "Saving..." : "Save"}
          </MiniButton>
        </div>
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

      <div className="mt-6">
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

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-border p-6 text-sm text-muted-foreground">Loading...</div>
        ) : null}

        {/* PROFILE (Google photo only) */}
        {!loading && activeTab === "profile" ? (
          <SectionCard title={employeeLabel}>
            <div className="grid gap-6 sm:grid-cols-[140px_1fr] items-start">
              <div className="flex flex-col items-center gap-3">
                <div className="h-28 w-28 rounded-full border border-border overflow-hidden bg-muted">
                  {photo ? <img src={photo} alt="Profile" className="h-full w-full object-cover" /> : null}
                </div>
              </div>

              <div className="grid gap-4">
                <Field label="Email (keyed by email)" error={errors.email} hint="Read-only">
                  <input
                    value={draft.email || ""}
                    readOnly
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
                  />
                </Field>

                <Field label="Name" error={errors.userPreferredName}>
                  <input
                    value={draft.userPreferredName ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, userPreferredName: e.target.value }))}
                    className={cx(
                      "w-full rounded-lg border px-3 py-2 text-sm",
                      errors.userPreferredName ? "border-red-300" : "border-border"
                    )}
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
              <Field label="Date of Birth" error={errors.dob}>
                <input
                  type="date"
                  value={draft.personal?.dob ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, personal: { ...(d.personal || {}), dob: e.target.value } }))
                  }
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    errors.dob ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="Blood Group">
                <select
                  value={draft.personal?.bloodGroup ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      personal: { ...(d.personal || {}), bloodGroup: (e.target.value || undefined) as any },
                    }))
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background"
                >
                  <option value="">Select</option>
                  {["A+","A-","B+","B-","O+","O-","AB+","AB-"].map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </Field>

              <Field label="Aadhar Number" error={errors.aadharNumber} hint="12-digit format">
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
                    errors.aadharNumber ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="PAN Card Number" error={errors.panCardNumber} hint="ABCDE1234F">
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
                    errors.panCardNumber ? "border-red-300" : "border-border"
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
              <Field label="Date of Joining TCE" error={errors.doj}>
                <input
                  type="date"
                  value={draft.academic?.dateOfJoiningTCE ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      academic: { ...(d.academic || {}), dateOfJoiningTCE: e.target.value },
                    }))
                  }
                  className={cx(
                    "w-full rounded-lg border px-3 py-2 text-sm",
                    errors.doj ? "border-red-300" : "border-border"
                  )}
                />
              </Field>

              <Field label="Current Designation">
                <select
                  value={draft.academic?.designation ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      academic: { ...(d.academic || {}), designation: (e.target.value || undefined) as any },
                    }))
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background"
                >
                  <option value="">Select</option>
                  {["Assistant","Senior Assistant","Associate","Professor"].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </Field>

              <Field label="Ph.D. Status">
                <select
                  value={draft.academic?.phdStatus ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      academic: { ...(d.academic || {}), phdStatus: (e.target.value || undefined) as any },
                    }))
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background"
                >
                  <option value="">Select</option>
                  {["Not Enrolled","Pursuing","Completed"].map((x) => (
                    <option key={x} value={x}>{x}</option>
                  ))}
                </select>
              </Field>
            </div>
          </SectionCard>
        ) : null}

        {/* EXPERIENCE */}
        {!loading && activeTab === "experience" ? (
          <div className="space-y-4">
            <SectionCard title="Experience Guidance" subtitle="This helps you finish the section correctly (HR-ready).">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Completion</div>
                    <div className="text-sm font-semibold">{expFeedback.score}%</div>
                  </div>
                  <ProgressBar value={expFeedback.score} />
                  <div className="text-sm text-muted-foreground">{expFeedback.nextAction}</div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <div className="text-sm font-semibold">Live Checks</div>
                  <div className="mt-3 grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span>Missing Academic certificates</span>
                      <span className={cx(expFeedback.academicMissingCert ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {expFeedback.academicMissingCert}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Missing Industry certificates</span>
                      <span className={cx(expFeedback.industryMissingCert ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {expFeedback.industryMissingCert}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Missing Industry Roles</span>
                      <span className={cx(expFeedback.industryMissingRole ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {expFeedback.industryMissingRole}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Missing Industry Orgs</span>
                      <span className={cx(expFeedback.industryMissingOrg ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {expFeedback.industryMissingOrg}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overlap / Range issues</span>
                      <span className={cx(expFeedback.overlapIssues ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {expFeedback.overlapIssues}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>LOP issues</span>
                      <span className={cx(expFeedback.lopIssues ? "text-red-600 font-medium" : "text-muted-foreground")}>
                        {expFeedback.lopIssues}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Current TCE Experience (Auto)"
              subtitle="Calculated from Date of Joining TCE to Today minus LOP. HR accurate. Updates instantly."
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
                        <Field label="Start date" error={errors[`lop.${lop.id}`]} hint={duration ? `Duration: ${duration}` : undefined}>
                          <input
                            type="date"
                            value={lop.startDate}
                            onChange={(ev) =>
                              setExp((e) => ({
                                ...e,
                                lopPeriods: e.lopPeriods.map((x) => (x.id === lop.id ? { ...x, startDate: ev.target.value } : x)),
                              }))
                            }
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                          />
                        </Field>

                        <Field label="End date">
                          <input
                            type="date"
                            value={lop.endDate}
                            onChange={(ev) =>
                              setExp((e) => ({
                                ...e,
                                lopPeriods: e.lopPeriods.map((x) => (x.id === lop.id ? { ...x, endDate: ev.target.value } : x)),
                              }))
                            }
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                          />
                        </Field>

                        <MiniButton
                          variant="danger"
                          onClick={() => setExp((e) => ({ ...e, lopPeriods: e.lopPeriods.filter((x) => x.id !== lop.id) }))}
                        >
                          Delete
                        </MiniButton>
                      </div>
                      {errors[`lop.${lop.id}`] ? <div className="mt-2 text-xs text-red-600">{errors[`lop.${lop.id}`]}</div> : null}
                      <div className="mt-3 flex justify-end">
                        <MiniButton onClick={() => void saveAll({ scope: "experience" })} disabled={saving || loading || hasExperienceErrors}>
                          Save this section
                        </MiniButton>
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
                        { id: uuid(), institution: "", startDate: todayISO(), endDate: todayISO(), certificate: null as any },
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

                  const entryHasCoreErrors =
                    !!errors[`ao.inst.${a.id}`] ||
                    !!errors[`ao.range.${a.id}`] ||
                    !!errors[`ao.overlap.${a.id}`] ||
                    !!errors[`cross.${a.id}`];

                  const canUploadAndSave = !busy && !!pending && !entryHasCoreErrors;

                  return (
                    <div key={a.id} className="rounded-xl border border-border p-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Institution" error={errors[`ao.inst.${a.id}`]} hint="Type to search; custom allowed">
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
                            error={errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`]}
                            hint={duration ? `Duration: ${duration}` : undefined}
                          >
                            <input
                              type="date"
                              value={a.startDate}
                              onChange={(ev) =>
                                setExp((e) => ({
                                  ...e,
                                  academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                                    x.id === a.id ? { ...x, startDate: ev.target.value } : x
                                  ),
                                }))
                              }
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                          </Field>

                          <Field
                            label="End"
                            error={errors[`ao.range.${a.id}`] || errors[`ao.overlap.${a.id}`] || errors[`cross.${a.id}`]}
                          >
                            <input
                              type="date"
                              value={a.endDate}
                              onChange={(ev) =>
                                setExp((e) => ({
                                  ...e,
                                  academicOutsideTCE: e.academicOutsideTCE.map((x) =>
                                    x.id === a.id ? { ...x, endDate: ev.target.value } : x
                                  ),
                                }))
                              }
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
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
                            ) : (
                              <div className="mt-1 text-xs text-red-600">{errors[`ao.cert.${a.id}`] || "Certificate is mandatory."}</div>
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

                            {localErr ? <div className="mt-2 text-xs text-red-600">{localErr}</div> : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {a.certificate ? (
                              <MiniButton variant="danger" onClick={() => void deleteCertificate("academicOutsideTCE", a.id)} disabled={busy}>
                                Delete Certificate
                              </MiniButton>
                            ) : null}

                            <label className="px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted transition cursor-pointer">
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

                      {errors[`cross.${a.id}`] ? <div className="text-xs text-red-600">{errors[`cross.${a.id}`]}</div> : null}
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
                        { id: uuid(), organization: "", role: "", startDate: todayISO(), endDate: todayISO(), certificate: null as any },
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

                  const entryHasCoreErrors =
                    !!errors[`in.org.${x.id}`] ||
                    !!errors[`in.role.${x.id}`] ||
                    !!errors[`in.range.${x.id}`] ||
                    !!errors[`in.overlap.${x.id}`] ||
                    !!errors[`cross.${x.id}`];

                  const canUploadAndSave = !busy && !!pending && !entryHasCoreErrors;

                  return (
                    <div key={x.id} className="rounded-xl border border-border p-3 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Company / Organization" error={errors[`in.org.${x.id}`]}>
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

                        <Field label="Role (mandatory)" error={errors[`in.role.${x.id}`]}>
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
                              errors[`in.role.${x.id}`] ? "border-red-300" : "border-border"
                            )}
                          />
                        </Field>

                        <div className="grid gap-3 grid-cols-2 sm:col-span-2">
                          <Field
                            label="Start"
                            error={errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`]}
                            hint={duration ? `Duration: ${duration}` : undefined}
                          >
                            <input
                              type="date"
                              value={x.startDate}
                              onChange={(ev) =>
                                setExp((e) => ({
                                  ...e,
                                  industry: e.industry.map((it) => (it.id === x.id ? { ...it, startDate: ev.target.value } : it)),
                                }))
                              }
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                            />
                          </Field>

                          <Field
                            label="End"
                            error={errors[`in.range.${x.id}`] || errors[`in.overlap.${x.id}`] || errors[`cross.${x.id}`]}
                          >
                            <input
                              type="date"
                              value={x.endDate}
                              onChange={(ev) =>
                                setExp((e) => ({
                                  ...e,
                                  industry: e.industry.map((it) => (it.id === x.id ? { ...it, endDate: ev.target.value } : it)),
                                }))
                              }
                              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
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
                            ) : (
                              <div className="mt-1 text-xs text-red-600">{errors[`in.cert.${x.id}`] || "Certificate is mandatory."}</div>
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

                            {localErr ? <div className="mt-2 text-xs text-red-600">{localErr}</div> : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {x.certificate ? (
                              <MiniButton variant="danger" onClick={() => void deleteCertificate("industry", x.id)} disabled={busy}>
                                Delete Certificate
                              </MiniButton>
                            ) : null}

                            <label className="px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted transition cursor-pointer">
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

                      {errors[`cross.${x.id}`] ? <div className="text-xs text-red-600">{errors[`cross.${x.id}`]}</div> : null}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Totals" subtitle="HR accurate totals computed automatically (12Y 9M 6D).">
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
          <SectionCard title="Uploads" subtitle="Single file each. Max 20MB. Choose file → Upload & Save. Preview supported.">
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

                        <label className="px-3 py-2 rounded-lg text-sm border border-border hover:bg-muted transition cursor-pointer">
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

        {hasErrors && !loading ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            There are validation issues. Fix them before saving.
          </div>
        ) : null}
      </div>
    </div>
  );
}
