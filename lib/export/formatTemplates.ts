import "server-only";
import { atomicWriteTextFileSync } from "@/lib/data/fileAtomic";

import fs from "node:fs";
import path from "node:path";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { getDataRoot } from "@/lib/userStore";
import { isCategoryKey } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { getExportableFields } from "@/lib/export/exportService";
import { canExport } from "@/lib/admin/roles";
import { getCoordinatorsConfig, canCoordinatorExport } from "@/lib/admin/coordinators";

/**
 * Export *format* templates (Phase 3) — distinct from the quick-export presets in
 * `templates.ts`. A format template is a named, per-category COLUMN ORDER (e.g.
 * "NAAC" ordering of the case-studies columns).
 *
 * Ownership:
 * - DLCs (with the export power) author templates for their own categories.
 * - The master authors templates for any category and assigns specific
 *   master-owned ones to coordinator types (`CoordinatorType.exportTemplateIds`).
 * Templates are category-scoped and NOT shared between DLCs.
 */

export type ExportFormatTemplate = {
  id: string;
  label: string;
  category: CategoryKey;
  columns: string[]; // ordered field keys (subset of the category's exportable fields)
  createdBy: string;
  ownerScope: "master" | "dlc";
};

export type ExportFormatTemplatesConfig = {
  version: number;
  templates: ExportFormatTemplate[];
};

const CONFIG_VERSION = 1 as const;

function configPath() {
  return path.join(process.cwd(), getDataRoot(), "admin", "export-format-templates.json");
}

function slugId(label: string): string {
  return (
    label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) ||
    `tpl-${Date.now()}`
  );
}

/** Field keys that may appear in a template for `category` (the exportable set). */
export function exportableKeysForCategory(category: string): string[] {
  if (!isCategoryKey(category)) return [];
  return getExportableFields(category).map((f) => f.key);
}

function normalizeTemplate(raw: unknown): ExportFormatTemplate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const label = typeof r.label === "string" ? r.label.trim() : "";
  if (!label) return null;
  const category = typeof r.category === "string" ? r.category : "";
  if (!isCategoryKey(category)) return null;

  // Keep only real, exportable columns for this category, preserving order + dedupe.
  const allowed = new Set(exportableKeysForCategory(category));
  const seen = new Set<string>();
  const columns: string[] = [];
  if (Array.isArray(r.columns)) {
    for (const c of r.columns) {
      if (typeof c === "string" && allowed.has(c) && !seen.has(c)) {
        seen.add(c);
        columns.push(c);
      }
    }
  }
  if (columns.length === 0) return null; // a format with no valid columns is meaningless

  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : slugId(label);
  const ownerScope = r.ownerScope === "master" ? "master" : "dlc";
  const createdBy = typeof r.createdBy === "string" ? normalizeEmail(r.createdBy) : "";

  return { id, label, category: category as CategoryKey, columns, createdBy, ownerScope };
}

function sanitize(raw: unknown): ExportFormatTemplatesConfig {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const byId = new Map<string, ExportFormatTemplate>();
  if (Array.isArray(r.templates)) {
    for (const t of r.templates) {
      const n = normalizeTemplate(t);
      if (n) byId.set(n.id, n);
    }
  }
  return {
    version: CONFIG_VERSION,
    templates: Array.from(byId.values()).sort((a, b) => a.label.localeCompare(b.label)),
  };
}

function write(config: ExportFormatTemplatesConfig): ExportFormatTemplatesConfig {
  const filePath = configPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  atomicWriteTextFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export function getFormatTemplatesConfig(): ExportFormatTemplatesConfig {
  try {
    const filePath = configPath();
    if (!fs.existsSync(filePath)) return { version: CONFIG_VERSION, templates: [] };
    const raw = fs.readFileSync(filePath, "utf8");
    return sanitize(raw.trim() ? JSON.parse(raw) : null);
  } catch {
    return { version: CONFIG_VERSION, templates: [] };
  }
}

export function getFormatTemplateById(id: string): ExportFormatTemplate | null {
  return getFormatTemplatesConfig().templates.find((t) => t.id === id) ?? null;
}

export type ExportFormatTemplateInput = Partial<Omit<ExportFormatTemplate, "category">> & {
  category?: string;
};

/** Create/update a format template. Returns the new config, or null if invalid. */
export function upsertFormatTemplate(input: ExportFormatTemplateInput): ExportFormatTemplatesConfig | null {
  const normalized = normalizeTemplate(input);
  if (!normalized) return null;
  const config = getFormatTemplatesConfig();
  const next = config.templates.filter((t) => t.id !== normalized.id);
  next.push(normalized);
  return write(sanitize({ ...config, templates: next }));
}

export function removeFormatTemplate(id: string): ExportFormatTemplatesConfig {
  const config = getFormatTemplatesConfig();
  return write(sanitize({ ...config, templates: config.templates.filter((t) => t.id !== id) }));
}

/** Master-assigned template ids for a person (union of their coordinator types). */
function assignedTemplateIds(email: string): Set<string> {
  const config = getCoordinatorsConfig();
  const typeIds = new Set(config.assignments.find((a) => a.email === normalizeEmail(email))?.typeIds ?? []);
  const ids = new Set<string>();
  for (const type of config.types) {
    if (typeIds.has(type.id)) type.exportTemplateIds.forEach((id) => ids.add(id));
  }
  return ids;
}

/**
 * Templates a viewer may use:
 * - global exporter (master / export-admin) → all templates;
 * - a coordinator → templates they authored for categories they can export,
 *   plus master-authored templates assigned to their type.
 */
export function listTemplatesForViewer(email: string): ExportFormatTemplate[] {
  const normalized = normalizeEmail(email);
  const all = getFormatTemplatesConfig().templates;
  if (canExport(normalized)) return all;
  const assigned = assignedTemplateIds(normalized);
  return all.filter(
    (t) =>
      (t.createdBy === normalized && canCoordinatorExport(normalized, t.category)) ||
      assigned.has(t.id),
  );
}
