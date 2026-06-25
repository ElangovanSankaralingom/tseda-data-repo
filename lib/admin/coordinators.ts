import "server-only";

import fs from "node:fs";
import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getDataRoot } from "@/lib/userStore";
import { isCategoryKey } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { canManageEditRequests } from "@/lib/admin/roles";

/**
 * Coordinator (DLC) layer — Phase 2.
 *
 * A *coordinator type* is a named, reusable role (e.g. "Case Studies Coordinator")
 * the master defines: a set of categories + a set of powers. People are assigned
 * to types. Effective scope for a person = the UNION of their types' categories,
 * with powers OR-ed together.
 *
 * Powers (per the agreed model): approve EDIT requests + export, both scoped to the
 * type's categories. Delete approval is NEVER a coordinator power — deletes stay
 * with masters/reviewers.
 *
 * Stored in `<dataRoot>/admin/coordinators.json`, mirroring the roles store.
 */

export type CoordinatorPowers = {
  approveEdits: boolean;
  approveDeletes: boolean;
  export: boolean;
};

export type CoordinatorType = {
  id: string;
  label: string;
  categories: CategoryKey[];
  powers: CoordinatorPowers;
  exportTemplateIds: string[];
};

export type CoordinatorAssignment = {
  email: string;
  typeIds: string[];
};

export type CoordinatorsConfig = {
  version: number;
  types: CoordinatorType[];
  assignments: CoordinatorAssignment[];
};

export type CoordinatorScope = {
  categories: CategoryKey[];
  approveEdits: boolean;
  approveDeletes: boolean;
  export: boolean;
};

const COORDINATORS_CONFIG_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function configPath() {
  return path.join(process.cwd(), getDataRoot(), "admin", "coordinators.json");
}

// ---------------------------------------------------------------------------
// Normalisation / validation
// ---------------------------------------------------------------------------

/** Slugify a label into a stable id: lowercase, hyphenated, [a-z0-9-]. */
export function slugifyTypeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizePowers(value: unknown): CoordinatorPowers {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    approveEdits: record.approveEdits === true,
    approveDeletes: record.approveDeletes === true,
    export: record.export === true,
  };
}

function normalizeCategories(value: unknown): CategoryKey[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<CategoryKey>();
  for (const item of value) {
    if (typeof item === "string" && isCategoryKey(item)) out.add(item);
  }
  return Array.from(out);
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const item of value) {
    if (typeof item === "string" && item.trim()) out.add(item.trim());
  }
  return Array.from(out);
}

/** A type is valid only if it has a label and at least one real category. */
function normalizeType(raw: unknown): CoordinatorType | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  if (!label) return null;
  const categories = normalizeCategories(record.categories);
  if (categories.length === 0) return null;
  const rawId = typeof record.id === "string" && record.id.trim() ? record.id.trim() : label;
  const id = slugifyTypeId(rawId);
  if (!id) return null;
  return {
    id,
    label,
    categories,
    powers: normalizePowers(record.powers),
    exportTemplateIds: normalizeStringList(record.exportTemplateIds),
  };
}

function sanitizeConfig(raw: unknown): CoordinatorsConfig {
  const record = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;

  // Types — dedupe by id (last wins).
  const typesById = new Map<string, CoordinatorType>();
  const rawTypes = Array.isArray(record.types) ? record.types : [];
  for (const rawType of rawTypes) {
    const normalized = normalizeType(rawType);
    if (normalized) typesById.set(normalized.id, normalized);
  }
  const validTypeIds = new Set(typesById.keys());

  // Assignments — normalise emails, keep only typeIds that still exist, drop empties.
  const assignmentsByEmail = new Map<string, Set<string>>();
  const rawAssignments = Array.isArray(record.assignments) ? record.assignments : [];
  for (const rawAssignment of rawAssignments) {
    if (!rawAssignment || typeof rawAssignment !== "object") continue;
    const a = rawAssignment as Record<string, unknown>;
    const email = normalizeEmail(String(a.email ?? ""));
    if (!email) continue;
    const typeIds = normalizeStringList(a.typeIds).filter((id) => validTypeIds.has(id));
    if (typeIds.length === 0) continue;
    const existing = assignmentsByEmail.get(email) ?? new Set<string>();
    typeIds.forEach((id) => existing.add(id));
    assignmentsByEmail.set(email, existing);
  }

  return {
    version: COORDINATORS_CONFIG_VERSION,
    types: Array.from(typesById.values()).sort((a, b) => a.label.localeCompare(b.label)),
    assignments: Array.from(assignmentsByEmail.entries())
      .map(([email, ids]) => ({ email, typeIds: Array.from(ids) }))
      .sort((a, b) => a.email.localeCompare(b.email)),
  };
}

// ---------------------------------------------------------------------------
// Load / write
// ---------------------------------------------------------------------------

function emptyConfig(): CoordinatorsConfig {
  return { version: COORDINATORS_CONFIG_VERSION, types: [], assignments: [] };
}

function writeConfig(config: CoordinatorsConfig): CoordinatorsConfig {
  const filePath = configPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return config;
}

export function getCoordinatorsConfig(): CoordinatorsConfig {
  const filePath = configPath();
  try {
    if (!fs.existsSync(filePath)) return emptyConfig();
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = raw.trim() ? JSON.parse(raw) : null;
    return sanitizeConfig(parsed);
  } catch {
    return emptyConfig();
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export type CoordinatorTypeInput = Partial<Omit<CoordinatorType, "powers">> & {
  powers?: Partial<CoordinatorPowers>;
};

/** Create or update a coordinator type. Returns the new config, or null if invalid. */
export function upsertCoordinatorType(input: CoordinatorTypeInput): CoordinatorsConfig | null {
  const normalized = normalizeType(input);
  if (!normalized) return null;
  const config = getCoordinatorsConfig();
  const nextTypes = config.types.filter((t) => t.id !== normalized.id);
  nextTypes.push(normalized);
  return writeConfig(sanitizeConfig({ ...config, types: nextTypes }));
}

/** Delete a coordinator type; assignments referencing it are auto-cleaned by sanitize. */
export function removeCoordinatorType(typeId: string): CoordinatorsConfig {
  const id = slugifyTypeId(String(typeId ?? ""));
  const config = getCoordinatorsConfig();
  const nextTypes = config.types.filter((t) => t.id !== id);
  return writeConfig(sanitizeConfig({ ...config, types: nextTypes }));
}

/** Set the full set of coordinator types a person is assigned to (replaces). */
export function setCoordinatorAssignment(email: string, typeIds: string[]): CoordinatorsConfig {
  const normalizedEmail = normalizeEmail(email);
  const config = getCoordinatorsConfig();
  const nextAssignments = config.assignments.filter((a) => a.email !== normalizedEmail);
  if (normalizedEmail && typeIds.length > 0) {
    nextAssignments.push({ email: normalizedEmail, typeIds: normalizeStringList(typeIds) });
  }
  return writeConfig(sanitizeConfig({ ...config, assignments: nextAssignments }));
}

export function getCoordinatorAssignment(email: string): string[] {
  const normalizedEmail = normalizeEmail(email);
  const config = getCoordinatorsConfig();
  return config.assignments.find((a) => a.email === normalizedEmail)?.typeIds ?? [];
}

/** Add a single type to a person's assignments (read-modify-write). */
export function assignCoordinatorType(email: string, typeId: string): CoordinatorsConfig {
  const current = getCoordinatorAssignment(email);
  return setCoordinatorAssignment(email, Array.from(new Set([...current, typeId])));
}

/** Remove a single type from a person's assignments. */
export function unassignCoordinatorType(email: string, typeId: string): CoordinatorsConfig {
  const current = getCoordinatorAssignment(email);
  return setCoordinatorAssignment(email, current.filter((id) => id !== typeId));
}

/** Emails assigned to a given coordinator type. */
export function listAssigneesForType(typeId: string): string[] {
  const config = getCoordinatorsConfig();
  return config.assignments.filter((a) => a.typeIds.includes(typeId)).map((a) => a.email);
}

// ---------------------------------------------------------------------------
// Scope + permission helpers (GP2b)
// ---------------------------------------------------------------------------

/** Effective scope for a person: union of assigned types' categories, OR of powers. */
export function getCoordinatorScope(email: string): CoordinatorScope {
  const config = getCoordinatorsConfig();
  const typeIds = new Set(config.assignments.find((a) => a.email === normalizeEmail(email))?.typeIds ?? []);
  const categories = new Set<CategoryKey>();
  let approveEdits = false;
  let approveDeletes = false;
  let exportPower = false;
  for (const type of config.types) {
    if (!typeIds.has(type.id)) continue;
    type.categories.forEach((c) => categories.add(c));
    approveEdits = approveEdits || type.powers.approveEdits;
    approveDeletes = approveDeletes || type.powers.approveDeletes;
    exportPower = exportPower || type.powers.export;
  }
  return { categories: Array.from(categories), approveEdits, approveDeletes, export: exportPower };
}

/**
 * Per-type power check: does the person hold ANY assigned type that BOTH covers
 * `category` AND grants `power`? Powers are bound to the categories of the type
 * that grants them — a power from one type does NOT leak onto another type's
 * categories (which a flattened union would wrongly allow).
 */
function hasPowerInCategory(email: string, category: string, power: keyof CoordinatorPowers): boolean {
  if (!isCategoryKey(category)) return false;
  const config = getCoordinatorsConfig();
  const typeIds = new Set(config.assignments.find((a) => a.email === normalizeEmail(email))?.typeIds ?? []);
  return config.types.some(
    (t) => typeIds.has(t.id) && t.powers[power] && t.categories.includes(category),
  );
}

export function canCoordinatorApproveEdit(email: string, category: string): boolean {
  return hasPowerInCategory(email, category, "approveEdits");
}

export function canCoordinatorApproveDelete(email: string, category: string): boolean {
  return hasPowerInCategory(email, category, "approveDeletes");
}

export function canCoordinatorExport(email: string, category: string): boolean {
  return hasPowerInCategory(email, category, "export");
}

/**
 * Can this person approve an EDIT request in `category`?
 * Master/Reviewer can approve in any category (global); a coordinator can approve
 * only in their scoped categories. (Owner/self-approval is enforced at the call
 * site with the entry's owner — E1.)
 */
export function canApproveEditForCategory(email: string, category: string): boolean {
  return canManageEditRequests(email) || canCoordinatorApproveEdit(email, category);
}

/**
 * Can this person approve a DELETE request in `category` (and act on its bin)?
 * Master/Reviewer globally; a coordinator with the approveDeletes power in this
 * category. (Owner/self-approval is enforced at the call site — E1.)
 */
export function canApproveDeleteForCategory(email: string, category: string): boolean {
  return canManageEditRequests(email) || canCoordinatorApproveDelete(email, category);
}

/** True if the person can approve deletes in ANY category (global or coordinator). */
export function isDeleteApprover(email: string): boolean {
  return canManageEditRequests(email) || getCoordinatorScope(email).approveDeletes;
}

/** True if the person is an edit-approval coordinator in ANY category. */
export function isEditApprovalCoordinator(email: string): boolean {
  return getCoordinatorScope(email).approveEdits;
}

/** True if the person is a coordinator with ANY approval power (edit or delete). */
export function isApprovalCoordinator(email: string): boolean {
  const scope = getCoordinatorScope(email);
  return scope.approveEdits || scope.approveDeletes;
}

/**
 * Filter a pending-request list to what a coordinator may act on:
 * EDIT requests in categories where they hold approveEdits, and DELETE requests
 * in categories where they hold approveDeletes. Per-type, per-power.
 */
export function filterPendingForCoordinator<
  T extends { categoryKey: string; status: string }
>(rows: T[], email: string): T[] {
  return rows.filter((r) => {
    if (r.status === "EDIT_REQUESTED") return canCoordinatorApproveEdit(email, r.categoryKey);
    if (r.status === "DELETE_REQUESTED") return canCoordinatorApproveDelete(email, r.categoryKey);
    return false;
  });
}

/** Emails of coordinators who can approve edits in `category` — for notification routing. */
export function listCoordinatorEmailsForCategory(category: string): string[] {
  if (!isCategoryKey(category)) return [];
  const config = getCoordinatorsConfig();
  const typeIdsForCategory = new Set(
    config.types.filter((t) => t.powers.approveEdits && t.categories.includes(category)).map((t) => t.id)
  );
  return config.assignments
    .filter((a) => a.typeIds.some((id) => typeIdsForCategory.has(id)))
    .map((a) => a.email);
}
