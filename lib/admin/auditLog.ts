import "server-only";
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { isCategoryKey } from "@/lib/categories";
import type { WalAction, WalActorRole, WalEvent } from "@/lib/data/wal";
import { normalizeEntryStatus } from "@/lib/entries/stateMachine";
import type { CategoryKey } from "@/lib/entries/types";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { logger } from "@/lib/logger";
import type { Result } from "@/lib/result";
import { safeAction } from "@/lib/safeAction";
import type { Entry, EntryStatus } from "@/lib/types/entry";
import { getUsersRootDir } from "@/lib/userStore";

const AUDIT_ACTIONS = ["REQUEST_EDIT", "GRANT_EDIT"] as const;
const AUDIT_ACTION_SET = new Set<WalAction>(AUDIT_ACTIONS);

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEvent = {
  ts: string;
  actorEmail: string;
  actorRole: WalActorRole;
  userEmail: string;
  category: CategoryKey;
  entryId: string;
  action: AuditAction;
  statusFrom: EntryStatus | null;
  statusTo: EntryStatus | null;
  summary: string;
};

type RecentAuditOptions = {
  limit?: number;
  userEmail?: string;
  category?: CategoryKey;
  action?: AuditAction;
  fromISO?: string;
  toISO?: string;
};

type ParsedAuditEvent = {
  event: AuditEvent;
  eventTimeMs: number;
};

function isAuditAction(value: string): value is AuditAction {
  return value === "APPROVE" || value === "REJECT" || value === "SEND_FOR_CONFIRMATION";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asEntry(value: unknown): Entry | null {
  return isRecord(value) ? (value as Entry) : null;
}

function getEntryStatus(value: Entry | null): EntryStatus | null {
  if (!value) return null;
  return normalizeEntryStatus(value);
}

function pickEntryTitle(entry: Entry | null) {
  if (!entry) return "";
  const candidates = [
    entry.programName,
    entry.eventName,
    entry.placeOfVisit,
    entry.organizationName,
    entry.organisationName,
    entry.speakerName,
    entry.purposeOfVisit,
  ];

  for (const candidate of candidates) {
    const text = String(candidate ?? "").trim();
    if (text) return text;
  }
  return "";
}

function collectAttachmentIds(value: unknown, out: Set<string>) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectAttachmentIds(item, out));
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
    collectAttachmentIds(nested, out);
  }
}

function countAttachments(entry: Entry | null) {
  if (!entry) return 0;
  const ids = new Set<string>();

  collectAttachmentIds(entry.uploads, ids);
  collectAttachmentIds(entry.attachments, ids);
  collectAttachmentIds(entry.permissionLetter, ids);
  collectAttachmentIds(entry.completionCertificate, ids);
  collectAttachmentIds(entry.travelPlan, ids);
  collectAttachmentIds(entry.brochure, ids);
  collectAttachmentIds(entry.attendance, ids);
  collectAttachmentIds(entry.speakerProfile, ids);
  collectAttachmentIds(entry.organiserProfile, ids);
  collectAttachmentIds(entry.geotaggedPhotos, ids);

  return ids.size;
}

function toSummary(event: WalEvent, before: Entry | null, after: Entry | null) {
  const parts = new Array<string>();
  const statusFrom = getEntryStatus(before);
  const statusTo = getEntryStatus(after);

  if (statusFrom && statusTo && statusFrom !== statusTo) {
    parts.push(`status: ${statusFrom} -> ${statusTo}`);
  } else if (!statusFrom && statusTo) {
    parts.push(`status: ${statusTo}`);
  }

  const beforeTitle = pickEntryTitle(before);
  const afterTitle = pickEntryTitle(after);
  if (beforeTitle && afterTitle && beforeTitle !== afterTitle) {
    parts.push(`title: "${beforeTitle}" -> "${afterTitle}"`);
  } else if (!beforeTitle && afterTitle) {
    parts.push(`title: "${afterTitle}"`);
  }

  const beforeAttachmentCount = countAttachments(before);
  const afterAttachmentCount = countAttachments(after);
  if (beforeAttachmentCount !== afterAttachmentCount) {
    parts.push(`attachments: ${beforeAttachmentCount} -> ${afterAttachmentCount}`);
  }

  const reason = typeof event.meta?.reason === "string" ? event.meta.reason.trim() : "";
  if (reason) {
    parts.push(`reason: ${reason}`);
  }

  if (parts.length === 0) {
    return "No tracked field changes.";
  }

  return parts.join(" • ");
}

function parseWalEvent(line: string): ParsedAuditEvent | null {
  const parsed = JSON.parse(line) as unknown;
  if (!isRecord(parsed)) return null;

  const actionRaw = String(parsed.action ?? "").trim().toUpperCase();
  if (!isAuditAction(actionRaw) || !AUDIT_ACTION_SET.has(actionRaw)) return null;

  const categoryRaw = String(parsed.category ?? "").trim().toLowerCase();
  if (!isCategoryKey(categoryRaw)) return null;

  const ts = String(parsed.ts ?? "").trim();
  const eventTimeMs = Date.parse(ts);
  if (!ts || Number.isNaN(eventTimeMs)) return null;

  const event = parsed as WalEvent;
  const before = asEntry(event.before);
  const after = asEntry(event.after);
  const actorRole = event.actor?.role === "admin" ? "admin" : "user";

  const mapped: AuditEvent = {
    ts,
    actorEmail: normalizeEmail(event.actor?.email ?? ""),
    actorRole,
    userEmail: normalizeEmail(event.userEmail ?? ""),
    category: categoryRaw,
    entryId: String(event.entryId ?? "").trim(),
    action: actionRaw,
    statusFrom: getEntryStatus(before),
    statusTo: getEntryStatus(after),
    summary: toSummary(event, before, after),
  };

  if (!mapped.userEmail || !mapped.entryId) return null;
  return { event: mapped, eventTimeMs };
}

function toLowerTrimmed(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export async function getRecentAuditEvents(options: RecentAuditOptions = {}): Promise<Result<AuditEvent[]>> {
  return safeAction(async () => {
    const usersRoot = getUsersRootDir();
    const limit = Number.isFinite(options.limit)
      ? Math.max(1, Math.min(500, Number(options.limit)))
      : 100;
    const startedAt = Date.now();

    const ownerFilter = toLowerTrimmed(options.userEmail);
    const actionFilter = options.action;
    const categoryFilter = options.category;
    const fromMs = options.fromISO ? Date.parse(options.fromISO) : Number.NaN;
    const toMs = options.toISO ? Date.parse(options.toISO) : Number.NaN;

    const parsedEvents = new Array<ParsedAuditEvent>();
    let skippedLines = 0;

    let userDirs: Dirent[] = [];
    try {
      userDirs = await fs.readdir(usersRoot, { withFileTypes: true });
    } catch (error) {
      const code = (error as { code?: string } | null)?.code;
      if (code === "ENOENT") {
        return [];
      }
      throw error;
    }

    for (const userDir of userDirs) {
      if (!userDir.isDirectory()) continue;

      const walPath = path.join(usersRoot, userDir.name, "events.log");
      let raw = "";
      try {
        raw = await fs.readFile(walPath, "utf8");
      } catch (error) {
        const code = (error as { code?: string } | null)?.code;
        if (code === "ENOENT") continue;
        throw error;
      }

      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed: ParsedAuditEvent | null = null;
        try {
          parsed = parseWalEvent(trimmed);
        } catch {
          parsed = null;
        }

        if (!parsed) {
          skippedLines += 1;
          continue;
        }

        if (ownerFilter && !parsed.event.userEmail.toLowerCase().includes(ownerFilter)) {
          continue;
        }
        if (categoryFilter && parsed.event.category !== categoryFilter) {
          continue;
        }
        if (actionFilter && parsed.event.action !== actionFilter) {
          continue;
        }
        if (!Number.isNaN(fromMs) && parsed.eventTimeMs < fromMs) {
          continue;
        }
        if (!Number.isNaN(toMs) && parsed.eventTimeMs > toMs) {
          continue;
        }

        parsedEvents.push(parsed);
      }
    }

    parsedEvents.sort((left, right) => right.eventTimeMs - left.eventTimeMs);

    if (skippedLines > 0) {
      logger.warn({
        event: "admin.audit.invalid-wal-lines",
        count: skippedLines,
      });
    }
    const events = parsedEvents.slice(0, limit).map((item) => item.event);
    logger.info({
      event: "admin.audit.query",
      count: events.length,
      limit,
      durationMs: Date.now() - startedAt,
      ownerFilter: ownerFilter || undefined,
      category: categoryFilter ?? undefined,
      action: actionFilter ?? undefined,
    });
    return events;
  }, { context: "admin.audit.getRecentAuditEvents" });
}
