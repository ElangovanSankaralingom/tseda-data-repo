import "server-only";

import { getServerSession } from "next-auth";
import { type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  cancelDeleteRequest,
  cancelEditGrant,
  cancelEditRequest,
  commitDraft,
  createEntry,
  deleteEntry as deleteEngineEntry,
  finalizeEntry,
  listEntriesForCategory,
  requestDelete,
  requestEdit,
  updateEntry,
} from "@/lib/entries/lifecycle";
import { isValidCategorySlug, getCategorySchema, type CategorySlug } from "@/data/categoryRegistry";
import { entryToApiResponse, entriesToApiResponse } from "@/lib/entries/toApiResponse";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { assertEntryMutationInput, assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { isEntryEditable } from "@/lib/entries/lock";
import type { CategoryKey } from "@/lib/entries/types";
import { validateCsrf } from "@/lib/security/csrf";
import { apiSuccess, apiPaginated, apiError, apiErrorFromCatch, parsePagination } from "@/lib/api/response";
import { runWithRequestContext, getCurrentRequestId } from "@/lib/api/asyncContext";
import { logger } from "@/lib/logger";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";

/**
 * Shared route handler for all 5 category API routes.
 *
 * Each category route becomes a thin wrapper:
 *   export const GET = (req) => handleCategoryGet(req, 'fdp-attended');
 *   export const POST = (req) => handleCategoryPost(req, 'fdp-attended');
 *
 * All responses use the standard envelope: { success, data, error, meta }.
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type AuthResult = { email: string } | null;

async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) return null;
  return { email };
}

function validateCategory(key: string): CategorySlug {
  if (!isValidCategorySlug(key)) {
    throw new Error(`Invalid category: ${key}`);
  }
  return key;
}

function entryResponse(persisted: unknown, category: CategorySlug) {
  return apiSuccess(entryToApiResponse(persisted as Record<string, unknown>, category));
}

/** Attach x-request-id header and log the completed request. */
function finishResponse(
  response: ReturnType<typeof apiSuccess>,
  method: string,
  path: string,
  startedAt: number,
) {
  const requestId = getCurrentRequestId();
  const durationMs = Date.now() - startedAt;
  response.headers.set("x-request-id", requestId);
  logger.info({
    event: "api.request",
    method,
    path,
    status: String(response.status),
    durationMs,
    requestId,
  });
  return response;
}

// ---------------------------------------------------------------------------
// GET — list entries for category (with pagination)
// ---------------------------------------------------------------------------

export async function handleCategoryGet(
  _req: NextRequest | Request,
  categoryKey: string,
) {
  const incomingId = _req.headers.get("x-request-id") ?? undefined;
  return runWithRequestContext(async () => {
    const startedAt = Date.now();
    const path = `/api/me/${categoryKey}`;

    const auth = await requireAuth();
    if (!auth) return finishResponse(apiError("Unauthorized", "UNAUTHORIZED"), "GET", path, startedAt);

    let category: CategorySlug;
    try {
      category = validateCategory(categoryKey);
    } catch {
      return finishResponse(apiError("Invalid category", "VALIDATION_ERROR"), "GET", path, startedAt);
    }

    try {
      enforceRateLimitForRequest({
        request: _req,
        userEmail: auth.email,
        action: `entry.read.${category}`,
        options: RATE_LIMIT_PRESETS.entryReads,
      });
    } catch (error) {
      return finishResponse(apiErrorFromCatch(error, "Too many requests"), "GET", path, startedAt);
    }

    const entries = await listEntriesForCategory(
      auth.email,
      category as CategoryKey,
    );

    const allFormatted = entriesToApiResponse(
      entries as Record<string, unknown>[],
      category,
    );

    // Pagination
    const url = _req instanceof Request ? new URL(_req.url) : null;
    const searchParams = url?.searchParams ?? null;
    const { page, pageSize } = parsePagination(searchParams);
    const total = allFormatted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(page, totalPages);
    const start = (clampedPage - 1) * pageSize;
    const data = allFormatted.slice(start, start + pageSize);

    return finishResponse(apiPaginated(data, { total, page: clampedPage, pageSize, totalPages }), "GET", path, startedAt);
  }, incomingId);
}

// ---------------------------------------------------------------------------
// POST — create entry for category
// ---------------------------------------------------------------------------

export async function handleCategoryPost(
  request: NextRequest | Request,
  categoryKey: string,
) {
  const incomingId = request.headers.get("x-request-id") ?? undefined;
  return runWithRequestContext(async () => {
    const startedAt = Date.now();
    const path = `/api/me/${categoryKey}`;

    const csrfError = validateCsrf(request);
    if (csrfError) return finishResponse(apiError(csrfError, "FORBIDDEN"), "POST", path, startedAt);

    const auth = await requireAuth();
    if (!auth) return finishResponse(apiError("Unauthorized", "UNAUTHORIZED"), "POST", path, startedAt);

    try {
      let category: CategorySlug;
      try {
        category = validateCategory(categoryKey);
      } catch {
        return finishResponse(apiError("Invalid category", "VALIDATION_ERROR"), "POST", path, startedAt);
      }

      // Rate limit
      enforceRateLimitForRequest({
        request,
        userEmail: auth.email,
        action: `entry.create.${category}`,
        options: RATE_LIMIT_PRESETS.entryMutations,
      });

      // Parse body
      const body = (await request.json()) as { entry?: unknown };
      const entryPayload = body?.entry;
      if (!entryPayload || typeof entryPayload !== "object") {
        return finishResponse(apiError("entry required", "VALIDATION_ERROR"), "POST", path, startedAt);
      }

      // Payload size check
      assertEntryMutationInput(entryPayload, `create ${category}`);

      const record = entryPayload as Record<string, unknown>;
      const id = String(record.id ?? "").trim();
      if (!id) {
        return finishResponse(apiError("entry.id required", "VALIDATION_ERROR"), "POST", path, startedAt);
      }

      // Schema validation
      const schema = getCategorySchema(category);
      const validationErrors = schema.validate(record, "create");
      if (validationErrors.length > 0) {
        return finishResponse(apiError(validationErrors[0].message, "VALIDATION_ERROR"), "POST", path, startedAt);
      }

      // Check if entry already exists and is locked
      const existingEntries = await listEntriesForCategory(
        auth.email,
        category as CategoryKey,
      );
      const existing = existingEntries.find(
        (e) => (e as Record<string, unknown>).id === id,
      ) ?? null;

      if (existing && !isEntryEditable(existing)) {
        return finishResponse(apiError("This entry is locked.", "FORBIDDEN"), "POST", path, startedAt);
      }

      // Build entry with lifecycle fields
      const now = new Date().toISOString();
      const entryData: Record<string, unknown> = {
        ...record,
        id,
        category,
        ownerEmail: auth.email,
        createdAt: (existing as Record<string, unknown>)?.createdAt ?? now,
        updatedAt: now,
      };

      // If new entry, set initial status
      if (!existing) {
        entryData.confirmationStatus = entryData.confirmationStatus ?? "DRAFT";
      }

      // Persist (engine handles streak field normalization)
      const persisted = existing
        ? await updateEntry(auth.email, category as CategoryKey, id, entryData)
        : await createEntry(auth.email, category as CategoryKey, entryData);

      return finishResponse(entryResponse(persisted, category), "POST", path, startedAt);
    } catch (error) {
      return finishResponse(apiErrorFromCatch(error, "Save failed"), "POST", path, startedAt);
    }
  }, incomingId);
}

// ---------------------------------------------------------------------------
// PATCH — update entry for category
// ---------------------------------------------------------------------------

/**
 * Supported patch actions (sent via body.action):
 * - undefined / "save": Regular field update (merge incoming fields into existing)
 * - "generate": Transition DRAFT → GENERATED (commit / generate PDF)
 * - "finalise": Mark entry as finalized (no-op if already finalized)
 * - "request_edit": Request edit on finalized entry
 * - "request_delete": Request deletion on finalized entry
 * - "cancel_request_edit": Cancel a pending edit request
 * - "cancel_request_delete": Cancel a pending delete request
 */
export async function handleCategoryPatch(
  request: NextRequest | Request,
  categoryKey: string,
) {
  const incomingId = request.headers.get("x-request-id") ?? undefined;
  return runWithRequestContext(async () => {
    const startedAt = Date.now();
    const path = `/api/me/${categoryKey}`;

    const csrfError = validateCsrf(request);
    if (csrfError) return finishResponse(apiError(csrfError, "FORBIDDEN"), "PATCH", path, startedAt);

    const auth = await requireAuth();
    if (!auth) return finishResponse(apiError("Unauthorized", "UNAUTHORIZED"), "PATCH", path, startedAt);

    try {
      let category: CategorySlug;
      try {
        category = validateCategory(categoryKey);
      } catch {
        return finishResponse(apiError("Invalid category", "VALIDATION_ERROR"), "PATCH", path, startedAt);
      }

      // Rate limit
      enforceRateLimitForRequest({
        request,
        userEmail: auth.email,
        action: `entry.update.${category}`,
        options: RATE_LIMIT_PRESETS.entryMutations,
      });

      // Parse body
      const body = (await request.json()) as {
        entry?: unknown;
        action?: string;
        id?: string;
      };

      const action = typeof body.action === "string" ? body.action.trim() : "save";
      const entryPayload = body.entry;
      const entryRecord =
        entryPayload && typeof entryPayload === "object"
          ? (entryPayload as Record<string, unknown>)
          : null;

      // For action-only requests (request_edit, etc.), id can come from body directly
      const entryId = String(entryRecord?.id ?? body.id ?? "").trim();
      if (!entryId) {
        return finishResponse(apiError("entry.id required", "VALIDATION_ERROR"), "PATCH", path, startedAt);
      }

      // Payload size check
      if (entryRecord) {
        assertEntryMutationInput(entryRecord, `update ${category}`);
      } else if (body.action) {
        assertActionPayload(body, `${action} payload`, SECURITY_LIMITS.actionPayloadMaxBytes);
      }

      // --- Action-based dispatch ---

      if (action === "request_edit") {
        const persisted = await requestEdit(auth.email, category as CategoryKey, entryId);
        return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
      }

      if (action === "request_delete") {
        const persisted = await requestDelete(auth.email, category as CategoryKey, entryId);
        return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
      }

      if (action === "cancel_request_edit") {
        const persisted = await cancelEditRequest(auth.email, category as CategoryKey, entryId);
        return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
      }

      if (action === "cancel_edit_grant") {
        const persisted = await cancelEditGrant(auth.email, category as CategoryKey, entryId);
        return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
      }

      if (action === "cancel_request_delete") {
        const persisted = await cancelDeleteRequest(auth.email, category as CategoryKey, entryId);
        return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
      }

      if (action === "generate") {
        const extraFields = entryRecord
          ? Object.fromEntries(
              Object.entries(entryRecord).filter(
                ([k]) => k !== "id" && k !== "ownerEmail" && k !== "category" && k !== "confirmationStatus",
              ),
            )
          : undefined;
        const persisted = await commitDraft(auth.email, category as CategoryKey, entryId, extraFields);
        return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
      }

      if (action === "finalise") {
        const persisted = await finalizeEntry(auth.email, category as CategoryKey, entryId);
        return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
      }

      // --- Regular field update (action === "save" or default) ---

      if (!entryRecord) {
        return finishResponse(apiError("entry required", "VALIDATION_ERROR"), "PATCH", path, startedAt);
      }

      // Schema validation (update mode)
      const schema = getCategorySchema(category);
      const validationErrors = schema.validate(entryRecord, "update");
      if (validationErrors.length > 0) {
        return finishResponse(apiError(validationErrors[0].message, "VALIDATION_ERROR"), "PATCH", path, startedAt);
      }

      const persisted = await updateEntry(
        auth.email,
        category as CategoryKey,
        entryId,
        entryRecord as Record<string, unknown>,
      );

      return finishResponse(entryResponse(persisted, category), "PATCH", path, startedAt);
    } catch (error) {
      return finishResponse(apiErrorFromCatch(error, "Save failed"), "PATCH", path, startedAt);
    }
  }, incomingId);
}

// ---------------------------------------------------------------------------
// DELETE — delete entry for category
// ---------------------------------------------------------------------------

export async function handleCategoryDelete(
  request: NextRequest | Request,
  categoryKey: string,
) {
  const incomingId = request.headers.get("x-request-id") ?? undefined;
  return runWithRequestContext(async () => {
    const startedAt = Date.now();
    const path = `/api/me/${categoryKey}`;

    const csrfError = validateCsrf(request);
    if (csrfError) return finishResponse(apiError(csrfError, "FORBIDDEN"), "DELETE", path, startedAt);

    const auth = await requireAuth();
    if (!auth) return finishResponse(apiError("Unauthorized", "UNAUTHORIZED"), "DELETE", path, startedAt);

    try {
      let category: CategorySlug;
      try {
        category = validateCategory(categoryKey);
      } catch {
        return finishResponse(apiError("Invalid category", "VALIDATION_ERROR"), "DELETE", path, startedAt);
      }

      // Parse body
      const body = (await request.json()) as { id?: string };
      const id = String(body?.id ?? "").trim();
      if (!id) {
        return finishResponse(apiError("id required", "VALIDATION_ERROR"), "DELETE", path, startedAt);
      }

      // Load existing entry to check editability
      const existingEntries = await listEntriesForCategory(
        auth.email,
        category as CategoryKey,
      );
      const existing = existingEntries.find(
        (e) => String((e as Record<string, unknown>).id ?? "") === id,
      ) ?? null;

      if (existing && !isEntryEditable(existing)) {
        return finishResponse(apiError("This entry is locked.", "FORBIDDEN"), "DELETE", path, startedAt);
      }

      // Delete via engine
      await deleteEngineEntry(auth.email, category as CategoryKey, id);

      return finishResponse(apiSuccess({ ok: true }), "DELETE", path, startedAt);
    } catch (error) {
      return finishResponse(apiErrorFromCatch(error, "Delete failed"), "DELETE", path, startedAt);
    }
  }, incomingId);
}
