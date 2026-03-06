import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { getDataRoot } from "@/lib/userStore";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";
import { buildTelemetrySummaryFromEvents } from "@/lib/telemetry/summary";
import {
  isTelemetryEventName,
  TELEMETRY_VERSION,
  type ReadTelemetryEventsOptions,
  type TelemetryActorRole,
  type TelemetryEvent,
  type TelemetryEventInput,
  type TelemetryMeta,
  type TelemetrySummary,
} from "@/lib/telemetry/types";

const DEFAULT_READ_LIMIT = 1000;
const MAX_READ_LIMIT = 50_000;
const MAX_META_VALUE_LENGTH = 500;

function getTelemetryRootDir() {
  return path.join(process.cwd(), getDataRoot(), "telemetry");
}

function getTelemetryEventsPath() {
  return path.join(getTelemetryRootDir(), "events.log");
}

function getTelemetrySummaryPath() {
  return path.join(getTelemetryRootDir(), "summary.json");
}

function toSafeString(value: unknown, maxLength = 256) {
  const text = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

function toSafeNumber(value: unknown) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  return Math.round(num);
}

function toSafeRole(value: unknown): TelemetryActorRole {
  return value === "admin" ? "admin" : "user";
}

function toSafeMeta(meta: unknown): TelemetryMeta {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {};
  }

  const next: TelemetryMeta = {};
  for (const [key, value] of Object.entries(meta as Record<string, unknown>)) {
    const safeKey = toSafeString(key, 80);
    if (!safeKey) continue;
    if (typeof value === "string") {
      next[safeKey] = value.trim().slice(0, MAX_META_VALUE_LENGTH);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      next[safeKey] = value;
      continue;
    }
    if (value === null) {
      next[safeKey] = null;
    }
  }
  return next;
}

function normalizeActorEmail(value: unknown) {
  const normalized = normalizeEmail(toSafeString(value, 320));
  return normalized || "unknown";
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

function ensureEventName(value: unknown) {
  const event = toSafeString(value, 120);
  if (!isTelemetryEventName(event)) {
    throw new Error(`Unsupported telemetry event: ${event || "<empty>"}`);
  }
  return event;
}

export function buildTelemetryEvent(input: TelemetryEventInput): TelemetryEvent {
  return {
    v: TELEMETRY_VERSION,
    ts: normalizeTimestamp(input.ts),
    event: ensureEventName(input.event),
    actorEmail: normalizeActorEmail(input.actorEmail),
    role: toSafeRole(input.role),
    category: toSafeString(input.category ?? "", 80) || null,
    entryId: toSafeString(input.entryId ?? "", 160) || null,
    status: toSafeString(input.status ?? "", 80) || null,
    success: input.success !== false,
    durationMs: toSafeNumber(input.durationMs),
    meta: toSafeMeta(input.meta),
  };
}

async function ensureTelemetryStore() {
  await fs.mkdir(getTelemetryRootDir(), { recursive: true });
}

export async function trackEvent(input: TelemetryEventInput): Promise<Result<void>> {
  try {
    const event = buildTelemetryEvent(input);
    await ensureTelemetryStore();
    await fs.appendFile(getTelemetryEventsPath(), `${JSON.stringify(event)}\n`, "utf8");
    return ok(undefined);
  } catch (error) {
    return err(normalizeError(error));
  }
}

function parseEventLine(line: string): TelemetryEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as Partial<TelemetryEventInput>;
    if (!parsed.event) return null;
    return buildTelemetryEvent({
      event: parsed.event,
      actorEmail: parsed.actorEmail ?? "unknown",
      role: parsed.role,
      category: parsed.category,
      entryId: parsed.entryId,
      status: parsed.status,
      success: parsed.success,
      durationMs: parsed.durationMs,
      meta: parsed.meta,
      ts: parsed.ts,
    });
  } catch {
    return null;
  }
}

function toSafeLimit(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_READ_LIMIT;
  if (value <= 0) return 0;
  return Math.min(Math.floor(value), MAX_READ_LIMIT);
}

export async function readTelemetryEvents(
  options: ReadTelemetryEventsOptions = {}
): Promise<Result<TelemetryEvent[]>> {
  try {
    const limit = toSafeLimit(options.limit);
    const sinceMs =
      typeof options.sinceISO === "string" && options.sinceISO.trim()
        ? Date.parse(options.sinceISO)
        : Number.NaN;
    const filterEvents =
      options.events && options.events.length > 0 ? new Set(options.events) : null;

    const raw = await fs.readFile(getTelemetryEventsPath(), "utf8").catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("ENOENT")) return "";
      throw error;
    });
    if (!raw.trim()) return ok([]);

    const lines = raw.split("\n");
    const items: TelemetryEvent[] = [];
    for (const line of lines) {
      const event = parseEventLine(line);
      if (!event) continue;
      if (filterEvents && !filterEvents.has(event.event)) continue;
      if (!Number.isNaN(sinceMs)) {
        const tsMs = Date.parse(event.ts);
        if (Number.isNaN(tsMs) || tsMs < sinceMs) continue;
      }
      items.push(event);
    }

    if (limit > 0 && items.length > limit) {
      return ok(items.slice(items.length - limit));
    }
    if (limit === 0) return ok([]);
    return ok(items);
  } catch (error) {
    return err(normalizeError(error));
  }
}

export async function summarizeTelemetry(
  options: ReadTelemetryEventsOptions = {}
): Promise<Result<TelemetrySummary>> {
  const eventsResult = await readTelemetryEvents({
    ...options,
    limit: options.limit ?? MAX_READ_LIMIT,
  });
  if (!eventsResult.ok) return err(eventsResult.error);

  try {
    const summary = buildTelemetrySummaryFromEvents(eventsResult.data);
    await ensureTelemetryStore();
    await fs.writeFile(getTelemetrySummaryPath(), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    return ok(summary);
  } catch (error) {
    return err(normalizeError(error));
  }
}

export async function readTelemetrySummaryCache(): Promise<Result<TelemetrySummary | null>> {
  try {
    const raw = await fs.readFile(getTelemetrySummaryPath(), "utf8").catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("ENOENT")) return "";
      throw error;
    });
    if (!raw.trim()) return ok(null);
    const parsed = JSON.parse(raw) as TelemetrySummary;
    if (!parsed || typeof parsed !== "object") return ok(null);
    if (typeof parsed.generatedAt !== "string") return ok(null);
    if (typeof parsed.totalEvents !== "number") return ok(null);
    return ok(parsed);
  } catch (error) {
    return err(normalizeError(error));
  }
}

