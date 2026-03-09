import "server-only";

/**
 * Shared types, constants, and internal utility functions used by all engine
 * sub-modules. No exported functions here own business logic — they provide
 * infrastructure (storage wrappers, WAL helpers, telemetry, normalization).
 */
import { ENTRY_SCHEMAS } from "@/data/schemas";
import { CATEGORY_KEYS } from "@/lib/categories";
import { rebuildUserIndex, updateIndexForEntryMutation } from "@/lib/data/indexStore";
import {
  deleteCategoryEntry as deleteCategoryEntryInStore,
  readCategoryEntries,
  readCategoryEntryById,
  upsertCategoryEntry as upsertCategoryEntryInStore,
  writeCategoryEntries,
} from "@/lib/dataStore";
import {
  appendEvent,
  appendEvents,
  buildEvent,
  inferWalUpdateAction,
  type WalActorRole,
} from "@/lib/data/wal";
import { getDashboardTag } from "@/lib/dashboard/tags";
import type { CategoryKey } from "@/lib/entries/types";
import { AppError, logError, normalizeError } from "@/lib/errors";
import {
  normalizeEntryStatus,
  type EntryStateLike,
} from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { normalizeEntry } from "@/lib/normalize";
import { getChangedImmutableFieldsWhenPending } from "@/lib/pendingImmutability";
import { assertActionPayload, assertEntryMutationInput, SECURITY_LIMITS } from "@/lib/security/limits";
import { enforceRateLimitOrThrow, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { trackEvent } from "@/lib/telemetry/telemetry";
import type { Entry, EntryStatus as EntryWorkflowStatus } from "@/lib/types/entry";
import { logger } from "@/lib/logger";

// ── Types ────────────────────────────────────────────────────────────────────

export type EntryEngineRecord = Entry;

export type EntryStreakSummary = {
  activated: number;
  wins: number;
  byCategory: Record<CategoryKey, { activated: number; wins: number }>;
};

export type EntryLike = EntryEngineRecord & {
  id?: unknown;
  status?: unknown;
  requestEditStatus?: unknown;
  confirmationStatus?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  sentForConfirmationAtISO?: unknown;
  requestEditRequestedAtISO?: unknown;
  confirmedAtISO?: unknown;
  confirmedBy?: unknown;
  confirmationRejectedReason?: unknown;
};
export type WorkflowEntryLike = EntryLike & EntryStateLike;

// ── Constants ────────────────────────────────────────────────────────────────

export const PROTECTED_UPDATE_KEYS = new Set([
  "id",
  "createdAt",
  "status",
  "confirmationStatus",
  "committedAtISO",
  "generatedAt",
  "editWindowExpiresAt",
  "editRequestedAt",
  "editRequestMessage",
  "editGrantedAt",
  "editGrantedBy",
  "editGrantedDays",
  "editRejectedReason",
  "deleteRequestedAt",
  "requestType",
  "requestCount",
  "requestCountResetAt",
  "archivedAt",
  "archiveReason",
  "streakPermanentlyRemoved",
  // Legacy fields (kept for migration safety)
  "sentForConfirmationAtISO",
  "confirmedAtISO",
  "confirmedBy",
  "confirmationRejectedReason",
]);

const ENTRY_MUTATION_EVENT_BY_ACTION = {
  create: "entry.create",
  update: "entry.update",
  delete: "entry.delete",
  commitDraft: "entry.commit_draft",
  requestEdit: "entry.request_edit",
  grantEdit: "entry.grant_edit",
  cancelEditRequest: "entry.cancel_edit_request",
  rejectEdit: "entry.reject_edit",
  finalize: "entry.finalize",
  requestDelete: "entry.request_delete",
  cancelDeleteRequest: "entry.cancel_delete_request",
  approveDelete: "entry.approve_delete",
  archiveEntry: "entry.archive",
  restoreEntry: "entry.restore",
} as const;

export type EntryMutationActionName = keyof typeof ENTRY_MUTATION_EVENT_BY_ACTION;

export type EntryMutationTelemetryContext = {
  action: EntryMutationActionName;
  actorEmail: string;
  role: "user" | "admin";
  ownerEmail: string;
  category: CategoryKey;
  entryId: string | null;
  durationMs: number;
  status?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  source?: "manual" | "autosave" | "admin" | "upload";
  meta?: Record<string, string | number | boolean | null | undefined>;
};

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function getWorkflowStatus(entry: EntryLike): EntryWorkflowStatus {
  return normalizeEntryStatus(entry);
}

export function ensureRecord(value: unknown): EntryEngineRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as EntryEngineRecord;
}

export function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

export function getWalActorEmail(value: string, fallbackEmail: string) {
  const normalized = normalizeEmail(value);
  return normalized || fallbackEmail;
}

// ── Guard helpers ────────────────────────────────────────────────────────────

export function enforceEntryMutationGuards(
  userEmail: string,
  action: string,
  payload?: unknown
) {
  const ne = normalizeEmail(userEmail);
  enforceRateLimitOrThrow(
    `user:${ne}:action:${action}`,
    RATE_LIMIT_PRESETS.entryMutations
  );
  if (payload !== undefined) {
    assertEntryMutationInput(payload, `${action} payload`);
  }
}

export function enforceAdminMutationGuards(
  adminEmail: string,
  action: string,
  payload?: unknown
) {
  const ne = normalizeEmail(adminEmail);
  enforceRateLimitOrThrow(
    `user:${ne}:action:${action}`,
    RATE_LIMIT_PRESETS.adminOps
  );
  if (payload !== undefined) {
    assertActionPayload(payload, `${action} payload`, SECURITY_LIMITS.actionPayloadMaxBytes);
  }
}

// ── Storage wrappers ─────────────────────────────────────────────────────────

export async function readListRaw(
  userEmail: string,
  category: CategoryKey
): Promise<EntryEngineRecord[]> {
  return readCategoryEntries(userEmail, category);
}

export async function writeListRaw(
  userEmail: string,
  category: CategoryKey,
  list: EntryEngineRecord[]
) {
  await writeCategoryEntries(userEmail, category, list);
}

export async function readEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return readCategoryEntryById(userEmail, category, entryId);
}

export async function upsertEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entry: EntryEngineRecord,
  options?: { insertPosition?: "start" | "end" }
): Promise<EntryEngineRecord> {
  return upsertCategoryEntryInStore(userEmail, category, entry, options);
}

export async function deleteEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return deleteCategoryEntryInStore(userEmail, category, entryId);
}

// ── Index helpers ────────────────────────────────────────────────────────────

export async function refreshIndexForMutation(
  userEmail: string,
  category: CategoryKey,
  beforeEntry: EntryEngineRecord | null,
  afterEntry: EntryEngineRecord | null
) {
  const startedAt = Date.now();
  const indexResult = await updateIndexForEntryMutation(userEmail, category, beforeEntry, afterEntry);
  if (indexResult.ok) {
    logger.debug({
      event: "entry.index.refresh.success",
      userEmail,
      category,
      durationMs: Date.now() - startedAt,
    });
    return;
  }

  logError(indexResult.error, "entryEngine.refreshIndexForMutation");
  const rebuildResult = await rebuildUserIndex(userEmail);
  if (!rebuildResult.ok) {
    logError(rebuildResult.error, "entryEngine.rebuildUserIndex");
    logger.error({
      event: "entry.index.refresh.rebuild-failed",
      userEmail,
      category,
      errorCode: rebuildResult.error.code,
      durationMs: Date.now() - startedAt,
    });
    return;
  }
  logger.warn({
    event: "entry.index.refresh.rebuilt",
    userEmail,
    category,
    durationMs: Date.now() - startedAt,
  });
}

export function revalidateDashboardSummary(userEmail: string) {
  const ne = normalizeEmail(userEmail);
  if (!ne) return;
  if (process.env.NODE_ENV === "test") return;
  const dashboardTag = getDashboardTag(ne);
  void import("next/cache.js")
    .then((module) => {
      if (typeof module.revalidateTag === "function") {
        module.revalidateTag(dashboardTag, "max");
      }
    })
    .catch((error) => {
      logError(error, "entryEngine.revalidateDashboardSummary");
    });
}

// ── WAL helpers ──────────────────────────────────────────────────────────────

export async function appendWalEventOrThrow(userEmail: string, event: ReturnType<typeof buildEvent>) {
  const walResult = await appendEvent(userEmail, event);
  if (!walResult.ok) {
    throw walResult.error;
  }
  logger.debug({
    event: "entry.wal.append",
    userEmail,
    category: event.category,
    entryId: event.entryId,
    action: event.action,
  });
}

export async function appendWalEventsOrThrow(userEmail: string, events: Array<ReturnType<typeof buildEvent>>) {
  if (!events.length) return;
  const walResult = await appendEvents(userEmail, events);
  if (!walResult.ok) {
    throw walResult.error;
  }
  logger.debug({
    event: "entry.wal.append.batch",
    userEmail,
    count: events.length,
  });
}

export function buildWalEventsForReplace(
  actorEmail: string,
  actorRole: WalActorRole,
  ownerEmail: string,
  category: CategoryKey,
  beforeList: EntryEngineRecord[],
  afterList: EntryEngineRecord[]
) {
  const beforeById = new Map<string, EntryEngineRecord>();
  const afterById = new Map<string, EntryEngineRecord>();

  for (const entry of beforeList) {
    const id = normalizeId(entry.id);
    if (!id) continue;
    beforeById.set(id, entry);
  }
  for (const entry of afterList) {
    const id = normalizeId(entry.id);
    if (!id) continue;
    afterById.set(id, entry);
  }

  const walEvents = new Array<ReturnType<typeof buildEvent>>();
  for (const [id, afterEntry] of afterById) {
    const beforeEntry = beforeById.get(id) ?? null;
    if (!beforeEntry) {
      walEvents.push(
        buildEvent({
          actorEmail,
          actorRole,
          userEmail: ownerEmail,
          category,
          entryId: id,
          action: "CREATE",
          before: null,
          after: afterEntry,
        })
      );
      continue;
    }

    if (JSON.stringify(beforeEntry) === JSON.stringify(afterEntry)) {
      continue;
    }

    walEvents.push(
      buildEvent({
        actorEmail,
        actorRole,
        userEmail: ownerEmail,
        category,
        entryId: id,
        action: inferWalUpdateAction(beforeEntry, afterEntry),
        before: beforeEntry,
        after: afterEntry,
      })
    );
  }

  for (const [id, beforeEntry] of beforeById) {
    if (afterById.has(id)) continue;
    walEvents.push(
      buildEvent({
        actorEmail,
        actorRole,
        userEmail: ownerEmail,
        category,
        entryId: id,
        action: "DELETE",
        before: beforeEntry,
        after: null,
      })
    );
  }

  return walEvents;
}

// ── Entry preparation ────────────────────────────────────────────────────────

export function prepareEntryForWrite(entry: EntryLike, nowISO: string, category: CategoryKey) {
  const existingStatus = getWorkflowStatus(entry);
  const base: EntryLike = {
    ...entry,
    createdAt:
      typeof entry.createdAt === "string" && entry.createdAt.trim()
        ? entry.createdAt
        : nowISO,
    updatedAt: nowISO,
    confirmationStatus: existingStatus,
  };
  const normalized = normalizeEntry(base as Entry, ENTRY_SCHEMAS[category]) as EntryLike;
  return normalized;
}

export function throwPendingImmutableError(changedFields: string[]) {
  throw new AppError({
    code: "FORBIDDEN",
    message: `Pending confirmation — core fields cannot be edited. Remove changes to: ${changedFields.join(", ")}.`,
    details: { changedFields },
  });
}

// ── Telemetry helpers ────────────────────────────────────────────────────────

async function trackTelemetrySafe(
  payload: {
    event: (typeof ENTRY_MUTATION_EVENT_BY_ACTION)[EntryMutationActionName] | "action.failure" | "validation.failure" | "rate_limit.hit" | "payload.too_large";
    actorEmail: string;
    role: "user" | "admin";
    category?: CategoryKey | null;
    entryId?: string | null;
    status?: string | null;
    success?: boolean;
    durationMs?: number | null;
    meta?: Record<string, string | number | boolean | null | undefined>;
  }
) {
  const tracked = await trackEvent({
    event: payload.event,
    actorEmail: payload.actorEmail,
    role: payload.role,
    category: payload.category ?? null,
    entryId: payload.entryId ?? null,
    status: payload.status ?? null,
    success: payload.success,
    durationMs: payload.durationMs ?? null,
    meta: payload.meta,
  });
  if (!tracked.ok) {
    logger.warn({
      event: "telemetry.track.failed",
      actorEmail: payload.actorEmail,
      category: payload.category ?? undefined,
      entryId: payload.entryId ?? undefined,
      errorCode: tracked.error.code,
    });
  }
}

export async function trackEntryMutationSuccess(context: EntryMutationTelemetryContext) {
  await trackTelemetrySafe({
    event: ENTRY_MUTATION_EVENT_BY_ACTION[context.action],
    actorEmail: context.actorEmail,
    role: context.role,
    category: context.category,
    entryId: context.entryId,
    status: context.status ?? context.toStatus ?? null,
    success: true,
    durationMs: context.durationMs,
    meta: {
      action: context.action,
      source: context.source ?? (context.role === "admin" ? "admin" : "manual"),
      fromStatus: context.fromStatus ?? null,
      toStatus: context.toStatus ?? context.status ?? null,
      ownerEmail: context.ownerEmail,
      ...context.meta,
    },
  });
}

export async function trackEntryMutationFailure(
  context: EntryMutationTelemetryContext,
  error: unknown
) {
  const normalized = normalizeError(error);
  const baseMeta = {
    action: context.action,
    source: context.source ?? (context.role === "admin" ? "admin" : "manual"),
    errorCode: normalized.code,
    ownerEmail: context.ownerEmail,
    fromStatus: context.fromStatus ?? null,
    toStatus: context.toStatus ?? null,
    ...context.meta,
  };

  await trackTelemetrySafe({
    event: "action.failure",
    actorEmail: context.actorEmail,
    role: context.role,
    category: context.category,
    entryId: context.entryId,
    status: context.status ?? context.fromStatus ?? null,
    success: false,
    durationMs: context.durationMs,
    meta: baseMeta,
  });

  if (normalized.code === "VALIDATION_ERROR") {
    await trackTelemetrySafe({
      event: "validation.failure",
      actorEmail: context.actorEmail,
      role: context.role,
      category: context.category,
      entryId: context.entryId,
      success: false,
      durationMs: context.durationMs,
      meta: baseMeta,
    });
  }
  if (normalized.code === "RATE_LIMITED") {
    await trackTelemetrySafe({
      event: "rate_limit.hit",
      actorEmail: context.actorEmail,
      role: context.role,
      category: context.category,
      entryId: context.entryId,
      success: false,
      durationMs: context.durationMs,
      meta: baseMeta,
    });
  }
  if (normalized.code === "PAYLOAD_TOO_LARGE") {
    await trackTelemetrySafe({
      event: "payload.too_large",
      actorEmail: context.actorEmail,
      role: context.role,
      category: context.category,
      entryId: context.entryId,
      success: false,
      durationMs: context.durationMs,
      meta: baseMeta,
    });
  }
}

