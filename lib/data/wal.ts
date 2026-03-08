import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "@/lib/errors";
import type { CategoryKey } from "@/lib/entries/types";
import {
  migrateWalEvent,
  WAL_EVENT_SCHEMA_VERSION,
} from "@/lib/migrations";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import type { Entry } from "@/lib/types/entry";
import { getUserStoreDir } from "@/lib/userStore";
import { logger } from "@/lib/logger";

const WAL_FILE_NAME = "events.log";
const WAL_VERSION = WAL_EVENT_SCHEMA_VERSION;
const MAX_STRING_LENGTH = 8_192;
const MAX_DEPTH = 10;

export type WalAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "REQUEST_EDIT"
  | "GRANT_EDIT"
  | "CANCEL_EDIT_REQUEST"
  | "REJECT_EDIT"
  | "FINALIZE"
  | "UPLOAD_ADD"
  | "UPLOAD_REMOVE"
  | "UPLOAD_REPLACE";

export type WalActorRole = "user" | "admin";

export type WalEvent = {
  v: number;
  ts: string;
  actor: {
    email: string;
    role: WalActorRole;
  };
  userEmail: string;
  category: CategoryKey;
  entryId: string;
  action: WalAction;
  before: Entry | null;
  after: Entry | null;
  meta?: {
    reason?: string;
    ip?: string;
    userAgent?: string;
    notes?: string;
  };
};

type BuildEventParams = {
  actorEmail: string;
  actorRole: WalActorRole;
  userEmail: string;
  category: CategoryKey;
  entryId: string;
  action: WalAction;
  before: Entry | null;
  after: Entry | null;
  meta?: WalEvent["meta"];
  ts?: string;
};

function getWalFilePath(userEmail: string) {
  return path.join(getUserStoreDir(userEmail), WAL_FILE_NAME);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (value.length <= MAX_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[max-depth]";

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (isRecord(value)) {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      next[key] = sanitizeValue(nested, depth + 1);
    }
    return next;
  }

  return String(value);
}

function sanitizeEntry(entry: Entry | null): Entry | null {
  if (!entry) return null;
  const sanitized = sanitizeValue(entry);
  if (!isRecord(sanitized)) return null;
  return sanitized as Entry;
}

function collectUploadIds(value: unknown, out: Set<string>) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectUploadIds(item, out));
    return;
  }
  if (!isRecord(value)) return;

  const storedPath = typeof value.storedPath === "string" ? value.storedPath.trim() : "";
  const url = typeof value.url === "string" ? value.url.trim() : "";
  const fileName = typeof value.fileName === "string" ? value.fileName.trim() : "";
  const mimeType = typeof value.mimeType === "string" ? value.mimeType.trim() : "";

  if (storedPath || url || fileName || mimeType) {
    out.add(`${storedPath}|${url}|${fileName}|${mimeType}`);
    return;
  }

  for (const nested of Object.values(value)) {
    collectUploadIds(nested, out);
  }
}

function getUploadSet(entry: Entry | null) {
  const uploads = new Set<string>();
  if (!entry) return uploads;

  const uploadRoots: unknown[] = [
    entry.uploads,
    entry.attachments,
    entry.permissionLetter,
    entry.completionCertificate,
    entry.brochure,
    entry.attendance,
    entry.organiserProfile,
    entry.travelPlan,
    entry.geotaggedPhotos,
  ];

  uploadRoots.forEach((value) => collectUploadIds(value, uploads));
  return uploads;
}

function hasSetValue(set: Set<string>, value: string) {
  return set.has(value);
}

export function inferWalUpdateAction(
  before: Entry | null,
  after: Entry | null
): WalAction {
  const beforeUploads = getUploadSet(before);
  const afterUploads = getUploadSet(after);

  if (beforeUploads.size === 0 && afterUploads.size === 0) {
    return "UPDATE";
  }

  let additions = 0;
  let removals = 0;

  for (const value of afterUploads) {
    if (!hasSetValue(beforeUploads, value)) additions += 1;
  }

  for (const value of beforeUploads) {
    if (!hasSetValue(afterUploads, value)) removals += 1;
  }

  if (additions === 0 && removals === 0) {
    return "UPDATE";
  }
  if (additions > 0 && removals === 0) {
    return "UPLOAD_ADD";
  }
  if (removals > 0 && additions === 0) {
    return "UPLOAD_REMOVE";
  }
  return "UPLOAD_REPLACE";
}

export function buildEvent(params: BuildEventParams): WalEvent {
  return {
    v: WAL_VERSION,
    ts: params.ts ?? new Date().toISOString(),
    actor: {
      email: params.actorEmail,
      role: params.actorRole,
    },
    userEmail: params.userEmail,
    category: params.category,
    entryId: params.entryId,
    action: params.action,
    before: sanitizeEntry(params.before),
    after: sanitizeEntry(params.after),
    meta: params.meta,
  };
}

export async function ensureWalFile(userEmail: string): Promise<Result<void>> {
  return safeAction(async () => {
    const walFilePath = getWalFilePath(userEmail);
    await fs.mkdir(path.dirname(walFilePath), { recursive: true });
    let created = false;
    try {
      await fs.access(walFilePath);
    } catch {
      await fs.writeFile(walFilePath, "", "utf8");
      created = true;
    }
    if (created) {
      logger.info({
        event: "wal.file.created",
        userEmail,
      });
    }
  }, { context: "wal.ensureWalFile" });
}

export async function appendEvent(userEmail: string, event: WalEvent): Promise<Result<void>> {
  return safeAction(async () => {
    const ensured = await ensureWalFile(userEmail);
    if (!ensured.ok) {
      throw ensured.error;
    }

    const migrated = migrateWalEvent(event);
    if (!migrated.ok) {
      throw migrated.error;
    }

    const walFilePath = getWalFilePath(userEmail);
    const line = `${JSON.stringify(migrated.data)}\n`;
    await fs.appendFile(walFilePath, line, "utf8");
    logger.info({
      event: "wal.append",
      userEmail,
      category: migrated.data.category,
      entryId: migrated.data.entryId,
      action: migrated.data.action,
      sizeBytes: Buffer.byteLength(line),
    });
  }, { context: "wal.appendEvent" });
}

export async function appendEvents(userEmail: string, events: WalEvent[]): Promise<Result<void>> {
  return safeAction(async () => {
    if (!events.length) return;

    const ensured = await ensureWalFile(userEmail);
    if (!ensured.ok) {
      throw ensured.error;
    }

    const migratedResults = events.map((event) => migrateWalEvent(event));
    const failed = migratedResults.find((result) => !result.ok);
    if (failed && !failed.ok) {
      throw failed.error;
    }
    const migratedEvents = migratedResults
      .filter((result): result is { ok: true; data: WalEvent } => result.ok)
      .map((result) => result.data);
    if (!migratedEvents.length) return;

    const walFilePath = getWalFilePath(userEmail);
    const payload = migratedEvents.map((event) => JSON.stringify(event)).join("\n");
    await fs.appendFile(walFilePath, `${payload}\n`, "utf8");
    logger.info({
      event: "wal.append.batch",
      userEmail,
      count: migratedEvents.length,
      sizeBytes: Buffer.byteLength(payload),
    });
  }, { context: "wal.appendEvents" });
}

export async function readEvents(
  userEmail: string,
  options?: { sinceTs?: string }
): Promise<Result<WalEvent[]>> {
  return safeAction(async () => {
    const walFilePath = getWalFilePath(userEmail);
    let raw = "";

    try {
      raw = await fs.readFile(walFilePath, "utf8");
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") return [];
      throw new AppError({
        code: "IO_ERROR",
        message: "Failed to read WAL events",
        cause: error,
      });
    }

    const sinceTime = options?.sinceTs ? Date.parse(options.sinceTs) : Number.NaN;
    const events: WalEvent[] = [];
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const migrated = migrateWalEvent(parsed);
        if (!migrated.ok) continue;
        const event = migrated.data;
        if (options?.sinceTs && !Number.isNaN(sinceTime)) {
          const eventTime = Date.parse(event.ts);
          if (Number.isNaN(eventTime) || eventTime < sinceTime) continue;
        }
        events.push(event);
      } catch {
        continue;
      }
    }
    logger.debug({
      event: "wal.read",
      userEmail,
      count: events.length,
      sinceTs: options?.sinceTs ?? null,
    });
    return events;
  }, { context: "wal.readEvents" });
}
