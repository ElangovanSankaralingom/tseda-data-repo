import "server-only";
import { CATEGORY_KEYS } from "@/lib/categories";
import type { CategoryKey } from "@/lib/entries/types";
import { AppError, normalizeError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";
import type { WalAction, WalEvent } from "@/lib/data/wal";
import {
  WAL_EVENT_SCHEMA_VERSION,
  isRecord,
  toVersion,
  toTrimmedString,
  toISO,
  runRecordMigrations,
} from "./migrationHelpers";
import { migrateEntry } from "./entryMigrations";

const WAL_ACTIONS = new Set<WalAction>([
  "CREATE",
  "UPDATE",
  "DELETE",
  "REQUEST_EDIT",
  "GRANT_EDIT",
  "UPLOAD_ADD",
  "UPLOAD_REMOVE",
  "UPLOAD_REPLACE",
]);

function normalizeWalAction(value: unknown): WalAction {
  const action = toTrimmedString(value).toUpperCase() as WalAction;
  return WAL_ACTIONS.has(action) ? action : "UPDATE";
}

function normalizeWalRole(value: unknown): "user" | "admin" {
  const role = toTrimmedString(value).toLowerCase();
  return role === "admin" ? "admin" : "user";
}

function migrateWalEventV0ToV1(raw: Record<string, unknown>, nowISO: string) {
  const actorRaw = isRecord(raw.actor) ? raw.actor : {};
  const actorEmail = toTrimmedString(actorRaw.email) || toTrimmedString(raw.userEmail);
  const userEmail = toTrimmedString(raw.userEmail) || actorEmail;
  const entryId = toTrimmedString(raw.entryId ?? raw.id);
  const category = toTrimmedString(raw.category) as CategoryKey;

  if (!entryId || !category || !CATEGORY_KEYS.includes(category)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Invalid WAL event payload",
      details: { entryId, category },
    });
  }

  const beforeRaw = isRecord(raw.before) ? raw.before : null;
  const afterRaw = isRecord(raw.after) ? raw.after : null;
  const beforeMigrated = beforeRaw ? migrateEntry(beforeRaw) : null;
  const afterMigrated = afterRaw ? migrateEntry(afterRaw) : null;

  const metaRaw = isRecord(raw.meta) ? raw.meta : null;
  const meta = metaRaw
    ? {
        reason: toTrimmedString(metaRaw.reason) || undefined,
        ip: toTrimmedString(metaRaw.ip) || undefined,
        userAgent: toTrimmedString(metaRaw.userAgent) || undefined,
        notes: toTrimmedString(metaRaw.notes) || undefined,
      }
    : undefined;

  const next: WalEvent = {
    v: WAL_EVENT_SCHEMA_VERSION,
    ts: toISO(raw.ts, nowISO),
    actor: {
      email: actorEmail,
      role: normalizeWalRole(actorRaw.role),
    },
    userEmail,
    category,
    entryId,
    action: normalizeWalAction(raw.action),
    before: beforeMigrated?.ok ? beforeMigrated.data : null,
    after: afterMigrated?.ok ? afterMigrated.data : null,
    meta,
  };

  return next as unknown as Record<string, unknown>;
}

export function migrateWalEvent(raw: unknown): Result<WalEvent> {
  try {
    if (!isRecord(raw)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid WAL event payload",
      });
    }

    const nowISO = new Date().toISOString();
    const rawVersion = toVersion(raw.v, 0);
    const migrated = runRecordMigrations(
      raw,
      rawVersion,
      WAL_EVENT_SCHEMA_VERSION,
      {
        0: migrateWalEventV0ToV1,
      },
      nowISO
    );

    const finalized = migrateWalEventV0ToV1(migrated, nowISO) as unknown as WalEvent;
    finalized.v = WAL_EVENT_SCHEMA_VERSION;
    return ok(finalized);
  } catch (error) {
    return err(normalizeError(error));
  }
}
