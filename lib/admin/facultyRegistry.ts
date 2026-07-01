import "server-only";

import fs from "node:fs";
import path from "node:path";
import { normalizeEmail, FACULTY, getCanonicalName } from "@/lib/facultyDirectory";
import { getDataRoot } from "@/lib/userStore";
import { isRootMaster } from "@/lib/admin";

/**
 * Faculty Registry (Phase 6) — replaces the hardcoded faculty list with a
 * master-managed, PERMANENT record.
 *
 * - Records are never deleted, only deactivated. Faculty come and go; the record
 *   (and all their data) stays.
 * - Status: active (full) · llp (read-only: view, no create/edit) · inactive
 *   (sign-in blocked, data kept).
 * - Departments are a master-editable list; a faculty may belong to several.
 *
 * NOTE: this layer is the data model + CRUD only. Wiring it into the sign-in gate
 * and the entry-mutation (LLP read-only) layer is a separate, deliberate step.
 */

export type FacultyStatus = "active" | "llp" | "inactive";
export type BetaStatus = "none" | "requested" | "member";

export type FacultyRecord = {
  email: string;
  name: string;
  departments: string[]; // department ids; empty = "Unassigned"
  status: FacultyStatus;
  betaStatus: BetaStatus;
  addedBy?: string;
  addedAtISO?: string;
};

export type Department = { id: string; label: string };

export type FacultyRegistryConfig = {
  version: number;
  faculty: FacultyRecord[];
  departments: Department[];
};

const VERSION = 1 as const;

export const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "architecture", label: "Faculty of Architecture" },
  { id: "planning", label: "Faculty of Planning" },
  { id: "design", label: "Faculty of Design" },
];

function configPath() {
  return path.join(process.cwd(), getDataRoot(), "admin", "faculty-registry.json");
}

function slugId(label: string): string {
  return (
    label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) ||
    `dept-${Date.now()}`
  );
}

const VALID_STATUS = new Set<FacultyStatus>(["active", "llp", "inactive"]);

function normalizeStatus(v: unknown): FacultyStatus {
  return typeof v === "string" && VALID_STATUS.has(v as FacultyStatus) ? (v as FacultyStatus) : "active";
}

const VALID_BETA = new Set<BetaStatus>(["none", "requested", "member"]);

function normalizeBeta(v: unknown): BetaStatus {
  return typeof v === "string" && VALID_BETA.has(v as BetaStatus) ? (v as BetaStatus) : "none";
}

function normalizeDept(raw: unknown): Department | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === "string" ? r.label.trim() : "";
  if (!label) return null;
  const id = typeof r.id === "string" && r.id.trim() ? slugId(r.id) : slugId(label);
  return { id, label };
}

function normalizeRecord(raw: unknown, validDeptIds: Set<string>): FacultyRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const email = normalizeEmail(String(r.email ?? ""));
  if (!email) return null;
  const departments = Array.isArray(r.departments)
    ? Array.from(new Set(r.departments.filter((d): d is string => typeof d === "string" && validDeptIds.has(d))))
    : [];
  return {
    email,
    name: typeof r.name === "string" && r.name.trim() ? r.name.trim() : email,
    departments,
    status: normalizeStatus(r.status),
    betaStatus: normalizeBeta(r.betaStatus),
    addedBy: typeof r.addedBy === "string" ? r.addedBy : undefined,
    addedAtISO: typeof r.addedAtISO === "string" ? r.addedAtISO : undefined,
  };
}

function seedConfig(): FacultyRegistryConfig {
  const nowISO = new Date().toISOString();
  return {
    version: VERSION,
    departments: DEFAULT_DEPARTMENTS.map((d) => ({ ...d })),
    // Seed from the previously-hardcoded directory so existing faculty keep access.
    faculty: FACULTY.map((f) => ({
      email: normalizeEmail(f.email),
      name: f.name,
      departments: ["architecture"],
      status: "active" as FacultyStatus,
      betaStatus: "none" as BetaStatus,
      addedBy: "system:seed",
      addedAtISO: nowISO,
    })),
  };
}

function sanitize(raw: unknown): FacultyRegistryConfig {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;

  const deptById = new Map<string, Department>();
  const rawDepts = Array.isArray(r.departments) ? r.departments : DEFAULT_DEPARTMENTS;
  for (const d of rawDepts) {
    const n = normalizeDept(d);
    if (n) deptById.set(n.id, n);
  }
  const validDeptIds = new Set(deptById.keys());

  const byEmail = new Map<string, FacultyRecord>();
  const rawFaculty = Array.isArray(r.faculty) ? r.faculty : [];
  for (const f of rawFaculty) {
    const n = normalizeRecord(f, validDeptIds);
    if (n) byEmail.set(n.email, n);
  }

  return {
    version: VERSION,
    departments: Array.from(deptById.values()).sort((a, b) => a.label.localeCompare(b.label)),
    faculty: Array.from(byEmail.values()).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function write(config: FacultyRegistryConfig): FacultyRegistryConfig {
  const filePath = configPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function getFacultyRegistry(): FacultyRegistryConfig {
  const filePath = configPath();
  try {
    if (!fs.existsSync(filePath)) return write(seedConfig());
    const raw = fs.readFileSync(filePath, "utf8");
    return sanitize(raw.trim() ? JSON.parse(raw) : null);
  } catch {
    return seedConfig();
  }
}

export function getFacultyRecord(email: string): FacultyRecord | null {
  const e = normalizeEmail(email);
  return getFacultyRegistry().faculty.find((f) => f.email === e) ?? null;
}

// --- CRUD (records are permanent — never deleted) ---

/** Add a faculty (no-op if already present). */
export function addFaculty(email: string, name: string | undefined, addedBy: string): FacultyRegistryConfig {
  const e = normalizeEmail(email);
  const config = getFacultyRegistry();
  if (!e || config.faculty.some((f) => f.email === e)) return config;
  config.faculty.push({
    email: e,
    name: name?.trim() || e,
    departments: [],
    status: "active",
    betaStatus: "none",
    addedBy,
    addedAtISO: new Date().toISOString(),
  });
  return write(sanitize(config));
}

/** Bulk add emails; returns how many were newly added. */
export function addFacultyBulk(emails: string[], addedBy: string): { config: FacultyRegistryConfig; added: number } {
  const config = getFacultyRegistry();
  const existing = new Set(config.faculty.map((f) => f.email));
  let added = 0;
  const nowISO = new Date().toISOString();
  for (const raw of emails) {
    const e = normalizeEmail(raw);
    if (!e || existing.has(e)) continue;
    existing.add(e);
    config.faculty.push({ email: e, name: e, departments: [], status: "active", betaStatus: "none", addedBy, addedAtISO: nowISO });
    added += 1;
  }
  return { config: write(sanitize(config)), added };
}

export function setFacultyStatus(email: string, status: FacultyStatus): FacultyRegistryConfig {
  const e = normalizeEmail(email);
  const config = getFacultyRegistry();
  const rec = config.faculty.find((f) => f.email === e);
  if (rec) rec.status = normalizeStatus(status);
  return write(sanitize(config));
}

export function setFacultyDepartments(email: string, departmentIds: string[]): FacultyRegistryConfig {
  const e = normalizeEmail(email);
  const config = getFacultyRegistry();
  const valid = new Set(config.departments.map((d) => d.id));
  const rec = config.faculty.find((f) => f.email === e);
  if (rec) rec.departments = Array.from(new Set(departmentIds.filter((id) => valid.has(id))));
  return write(sanitize(config));
}

// --- Beta program ---

export function getBetaStatus(email: string): BetaStatus {
  return getFacultyRecord(email)?.betaStatus ?? "none";
}

export function setBetaStatus(email: string, status: BetaStatus): FacultyRegistryConfig {
  const e = normalizeEmail(email);
  const config = getFacultyRegistry();
  const rec = config.faculty.find((f) => f.email === e);
  if (rec) rec.betaStatus = VALID_BETA.has(status) ? status : "none";
  return write(sanitize(config));
}

/** True only for explicit beta members — no implicit admin access. */
export function isBetaTester(email: string): boolean {
  return getBetaStatus(email) === "member";
}

// --- Departments (master-editable) ---

export function upsertDepartment(label: string, id?: string): FacultyRegistryConfig {
  const config = getFacultyRegistry();
  const dept = normalizeDept({ label, id });
  if (!dept) return config;
  const next = config.departments.filter((d) => d.id !== dept.id);
  next.push(dept);
  config.departments = next;
  return write(sanitize(config));
}

/** Delete a department; its faculty are moved to "Unassigned" (id removed). */
export function removeDepartment(id: string): FacultyRegistryConfig {
  const config = getFacultyRegistry();
  config.departments = config.departments.filter((d) => d.id !== id);
  config.faculty.forEach((f) => {
    f.departments = f.departments.filter((d) => d !== id);
  });
  return write(sanitize(config));
}

// --- Gate helpers (NOT yet wired into sign-in / mutation — Phase 6b/c) ---

/** May this email sign in? On the registry and not inactive, OR the root master. */
export function isFacultyAllowed(email: string): boolean {
  if (isRootMaster(email)) return true;
  const rec = getFacultyRecord(email);
  return !!rec && rec.status !== "inactive";
}

/** May this faculty create/edit entries? Active only (LLP is read-only). */
export function facultyCanMutate(email: string): boolean {
  if (isRootMaster(email)) return true;
  return getFacultyRecord(email)?.status === "active";
}

/**
 * Resolve a faculty's display name, registry-first so faculty added through the
 * registry (not in the legacy hardcoded list) still get a proper name. Falls
 * back to the hardcoded directory, then null.
 */
export function resolveFacultyName(email: string): string | null {
  const rec = getFacultyRecord(email);
  if (rec && rec.name && rec.name !== rec.email) return rec.name;
  return getCanonicalName(email) ?? rec?.name ?? null;
}
