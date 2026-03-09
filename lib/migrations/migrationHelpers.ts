import "server-only";
import { CATEGORY_KEYS } from "@/lib/categories";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import type { UserIndex } from "@/lib/data/indexStore";
import { isEntryStatus, type EntryStatus } from "@/lib/types/entry";

export const ENTRY_SCHEMA_VERSION = 1;
export const CATEGORY_STORE_SCHEMA_VERSION = 2;
export const USER_INDEX_SCHEMA_VERSION = 2;
export const WAL_EVENT_SCHEMA_VERSION = 1;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function toVersion(value: unknown, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;
  return Math.floor(value);
}

export function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toISO(value: unknown, fallbackISO: string): string {
  const candidate = toTrimmedString(value);
  if (!candidate) return fallbackISO;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? fallbackISO : candidate;
}

export function toOptionalISO(value: unknown): string | null {
  const candidate = toTrimmedString(value);
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  return Number.isNaN(parsed) ? null : candidate;
}

export function toNonNegativeInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return Math.floor(value);
}

export function emptyCategoryMap<T>(valueFactory: () => T) {
  return CATEGORY_KEYS.reduce<Record<CategoryKey, T>>((next, categoryKey) => {
    next[categoryKey] = valueFactory();
    return next;
  }, {} as Record<CategoryKey, T>);
}

export function runRecordMigrations(
  raw: Record<string, unknown>,
  version: number,
  latestVersion: number,
  migrations: Record<number, (value: Record<string, unknown>, nowISO: string) => Record<string, unknown>>,
  nowISO: string
) {
  let current = { ...raw };
  let nextVersion = version;
  while (nextVersion < latestVersion) {
    const migrate = migrations[nextVersion];
    if (!migrate) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: `Missing migration path from v${nextVersion} to v${nextVersion + 1}.`,
      });
    }
    current = migrate(current, nowISO);
    nextVersion += 1;
  }
  return current;
}

export function normalizeIndexSearchMap(
  raw: unknown
): UserIndex["searchIndexByEntryId"] {
  if (!isRecord(raw)) return {};
  const next: UserIndex["searchIndexByEntryId"] = {};

  for (const value of Object.values(raw)) {
    if (!isRecord(value)) continue;
    const entryId = toTrimmedString(value.entryId);
    const categoryKey = toTrimmedString(value.categoryKey) as CategoryKey;
    const title = toTrimmedString(value.title);
    const text = toTrimmedString(value.text);
    const status = toTrimmedString(value.status) as EntryStatus;
    if (!entryId || !CATEGORY_KEYS.includes(categoryKey) || !title || !text) continue;
    if (!isEntryStatus(status)) continue;

    const key = `${categoryKey}:${entryId}`;
    next[key] = {
      entryId,
      categoryKey,
      title,
      text,
      status,
      updatedAtISO: toOptionalISO(value.updatedAtISO),
      createdAtISO: toOptionalISO(value.createdAtISO),
    };
  }

  return next;
}
