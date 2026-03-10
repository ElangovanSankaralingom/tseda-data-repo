import "server-only";

/**
 * Shared types, constants, and internal utility functions used by all engine
 * sub-modules. No exported functions here own business logic — they provide
 * infrastructure (storage wrappers, WAL helpers, telemetry, normalization).
 */
import { ENTRY_SCHEMAS } from "@/data/schemas";
import { rebuildUserIndex, updateIndexForEntryMutation } from "@/lib/data/indexStore";
import { createDataLayer } from "@/lib/data/createDataLayer";
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

/**
 * Returns the canonical workflow status for an entry by delegating to the
 * workflow module's status normalization.
 *
 * @param entry - The entry record to inspect.
 * @returns The normalized workflow status (e.g. DRAFT, GENERATED, ARCHIVED).
 */
export function getWorkflowStatus(entry: EntryLike): EntryWorkflowStatus {
  return normalizeEntryStatus(entry);
}

/**
 * Coerces an unknown value into an {@link EntryEngineRecord}. Returns an empty
 * object if the value is falsy, not an object, or an array.
 *
 * @param value - The value to coerce.
 * @returns A plain object suitable for use as an entry record.
 */
export function ensureRecord(value: unknown): EntryEngineRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as EntryEngineRecord;
}

/**
 * Normalizes an entry ID by converting to string and trimming whitespace.
 *
 * @param value - The raw ID value (may be undefined, null, or any type).
 * @returns A trimmed string representation of the ID.
 */
export function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

/**
 * Resolves the actor email for WAL events. Returns the normalized form of
 * `value`, falling back to `fallbackEmail` if normalization yields an empty string.
 *
 * @param value - The candidate actor email.
 * @param fallbackEmail - Fallback email to use if `value` normalizes to empty.
 * @returns The resolved actor email.
 */
export function getWalActorEmail(value: string, fallbackEmail: string) {
  const normalized = normalizeEmail(value);
  return normalized || fallbackEmail;
}

// ── Guard helpers ────────────────────────────────────────────────────────────

/**
 * Enforces rate-limit and payload size guards for user-initiated entry mutations.
 *
 * @param userEmail - Email of the user performing the mutation.
 * @param action - The action identifier used for rate-limit keying.
 * @param payload - Optional payload to validate against entry mutation size limits.
 */
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

/**
 * Enforces rate-limit and payload size guards for admin-initiated mutations.
 *
 * @param adminEmail - Email of the admin performing the mutation.
 * @param action - The action identifier used for rate-limit keying.
 * @param payload - Optional payload to validate against admin action size limits.
 */
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
// All storage access goes through the DataLayer abstraction.
// Default backend is JSON files; can be swapped to SQLite via DATA_LAYER env.

const dataLayer = createDataLayer();

/**
 * Reads the raw list of entry records for a user and category from storage.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key to read entries for.
 * @returns Array of raw entry records.
 */
export async function readListRaw(
  userEmail: string,
  category: CategoryKey
): Promise<EntryEngineRecord[]> {
  return dataLayer.listEntries(userEmail, category);
}

/**
 * Writes a complete list of entry records for a user and category to storage,
 * replacing the existing list.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key to write entries for.
 * @param list - The complete list of entry records to persist.
 */
export async function writeListRaw(
  userEmail: string,
  category: CategoryKey,
  list: EntryEngineRecord[]
) {
  await dataLayer.replaceEntries(userEmail, category, list);
}

/**
 * Reads a single entry by ID from the user's category store.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key to search in.
 * @param entryId - ID of the entry to read.
 * @returns The entry record if found, or `null`.
 */
export async function readEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return dataLayer.getEntry(userEmail, category, entryId);
}

/**
 * Inserts or updates a single entry in the user's category store.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key to upsert into.
 * @param entry - The entry record to insert or update.
 * @param options - Optional insertion position ("start" or "end") for new entries.
 * @returns The persisted entry record.
 */
export async function upsertEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entry: EntryEngineRecord,
  options?: { insertPosition?: "start" | "end" }
): Promise<EntryEngineRecord> {
  return dataLayer.saveEntry(userEmail, category, entry, options);
}

/**
 * Deletes a single entry by ID from the user's category store.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key to delete from.
 * @param entryId - ID of the entry to delete.
 * @returns The deleted entry record, or `null` if not found.
 */
export async function deleteEntryRaw(
  userEmail: string,
  category: CategoryKey,
  entryId: string
): Promise<EntryEngineRecord | null> {
  return dataLayer.deleteEntry(userEmail, category, entryId);
}

// ── Index helpers ────────────────────────────────────────────────────────────

/**
 * Refreshes the user index after an entry mutation. Attempts an incremental
 * index update first; if that fails, falls back to a full index rebuild.
 *
 * @param userEmail - Email of the entry owner.
 * @param category - The category key of the mutated entry.
 * @param beforeEntry - The entry state before the mutation, or `null` for creates.
 * @param afterEntry - The entry state after the mutation, or `null` for deletes.
 */
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

/**
 * Triggers a Next.js cache revalidation for the user's dashboard summary tag.
 * No-ops silently in test environments or if the email is empty.
 *
 * @param userEmail - Email of the user whose dashboard cache should be invalidated.
 */
export function revalidateDashboardSummary(userEmail: string) {
  const ne = normalizeEmail(userEmail);
  if (!ne) return;
  if (process.env.NODE_ENV === "test") return;
  const dashboardTag = getDashboardTag(ne);
  import("next/cache.js")
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

/**
 * Appends a single WAL event for the user, throwing if the append fails.
 *
 * @param userEmail - Email of the user whose WAL receives the event.
 * @param event - The WAL event to append.
 */
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

/**
 * Appends multiple WAL events in a single batch for the user, throwing if the
 * append fails. No-ops if the events array is empty.
 *
 * @param userEmail - Email of the user whose WAL receives the events.
 * @param events - Array of WAL events to append.
 */
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

/**
 * Diffs two entry lists and produces the WAL events needed to represent a
 * full category replacement (CREATE for new entries, UPDATE for changed entries,
 * DELETE for removed entries).
 *
 * @param actorEmail - Email of the actor performing the replacement.
 * @param actorRole - Role of the actor ("user" or "admin").
 * @param ownerEmail - Email of the entry owner.
 * @param category - The category key being replaced.
 * @param beforeList - The previous list of entries.
 * @param afterList - The new list of entries.
 * @returns Array of WAL events representing all changes.
 */
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

/**
 * Prepares an entry for persistence by setting timestamps, preserving the
 * current workflow status, and normalizing against the category schema.
 *
 * @param entry - The entry data to prepare.
 * @param nowISO - Current ISO timestamp used for `createdAt`/`updatedAt` defaults.
 * @param category - The category key used to look up the schema for normalization.
 * @returns The normalized entry ready for storage.
 */
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

/**
 * Throws a FORBIDDEN {@link AppError} listing the immutable fields that were
 * illegally modified while the entry is in a pending confirmation state.
 *
 * @param changedFields - Names of the fields that were changed.
 */
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

/**
 * Records a telemetry event for a successful entry mutation.
 *
 * @param context - Telemetry context describing the mutation action, actor, and timing.
 */
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

/**
 * Records telemetry events for a failed entry mutation. Emits the base
 * "action.failure" event and, depending on the error type, additional events
 * for validation failures, rate-limit hits, or payload-too-large errors.
 *
 * @param context - Telemetry context describing the mutation action, actor, and timing.
 * @param error - The error that caused the mutation to fail.
 */
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

