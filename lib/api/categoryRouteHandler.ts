import "server-only";

import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  cancelDeleteRequest,
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
import { normalizeError } from "@/lib/errors";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { assertEntryMutationInput, assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { isEntryEditable } from "@/lib/entries/lock";
import type { CategoryKey } from "@/lib/entries/types";
import { validateCsrf } from "@/lib/security/csrf";

/**
 * Shared route handler for all 5 category API routes.
 *
 * Each category route becomes a thin wrapper:
 *   export const GET = (req) => handleCategoryGet(req, 'fdp-attended');
 *   export const POST = (req) => handleCategoryPost(req, 'fdp-attended');
 *
 * This module owns:
 * - Auth checks
 * - Category validation
 * - Schema-based field validation
 * - Delegation to engine.ts for persistence
 * - Response formatting via entryToApiResponse
 *
 * This module does NOT own:
 * - Business rules (those live in workflow.ts)
 * - Persistence internals (those live in engine.ts)
 * - PDF generation (that lives in pdfService.ts)
 */

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type AuthResult = { email: string } | null;

async function requireAuth(): Promise<AuthResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith("@tce.edu")) return null;
  return { email };
}

function validateCategory(key: string): CategorySlug {
  if (!isValidCategorySlug(key)) {
    throw new Error(`Invalid category: ${key}`);
  }
  return key;
}

function errorResponse(message: string, status: number, code?: string): NextResponse {
  return NextResponse.json(
    code ? { error: message, code } : { error: message },
    { status },
  );
}

function mutationErrorResponse(error: unknown, fallbackMessage: string): NextResponse {
  const appError = normalizeError(error);
  if (appError.code === "RATE_LIMITED") {
    return errorResponse(appError.message, 429, appError.code);
  }
  if (appError.code === "PAYLOAD_TOO_LARGE") {
    return errorResponse(appError.message, 413, appError.code);
  }
  if (appError.code === "VALIDATION_ERROR") {
    return errorResponse(appError.message, 400, appError.code);
  }
  if (appError.code === "FORBIDDEN") {
    return errorResponse(appError.message || "Forbidden", 403);
  }
  if (appError.code === "NOT_FOUND") {
    return errorResponse(appError.message || "Entry not found", 404);
  }
  return errorResponse(appError.message || fallbackMessage, 500);
}

// ---------------------------------------------------------------------------
// GET — list entries for category
// ---------------------------------------------------------------------------

export async function handleCategoryGet(
  _req: NextRequest | Request,
  categoryKey: string,
): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth) return errorResponse("Unauthorized", 401);

  let category: CategorySlug;
  try {
    category = validateCategory(categoryKey);
  } catch {
    return errorResponse("Invalid category", 400);
  }

  try {
    enforceRateLimitForRequest({
      request: _req,
      userEmail: auth.email,
      action: `entry.read.${category}`,
      options: RATE_LIMIT_PRESETS.entryReads,
    });
  } catch (error) {
    return mutationErrorResponse(error, "Too many requests");
  }

  const entries = await listEntriesForCategory(
    auth.email,
    category as CategoryKey,
  );

  const response = entriesToApiResponse(
    entries as Record<string, unknown>[],
    category,
  );

  return NextResponse.json(response, { status: 200 });
}

// ---------------------------------------------------------------------------
// POST — create entry for category
// ---------------------------------------------------------------------------

export async function handleCategoryPost(
  request: NextRequest | Request,
  categoryKey: string,
): Promise<NextResponse> {
  const csrfError = validateCsrf(request);
  if (csrfError) return errorResponse(csrfError, 403);

  const auth = await requireAuth();
  if (!auth) return errorResponse("Unauthorized", 401);

  try {
    let category: CategorySlug;
    try {
      category = validateCategory(categoryKey);
    } catch {
      return errorResponse("Invalid category", 400);
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
      return errorResponse("entry required", 400);
    }

    // Payload size check
    assertEntryMutationInput(entryPayload, `create ${category}`);

    const record = entryPayload as Record<string, unknown>;
    const id = String(record.id ?? "").trim();
    if (!id) {
      return errorResponse("entry.id required", 400);
    }

    // Schema validation
    const schema = getCategorySchema(category);
    const validationErrors = schema.validate(record, "create");
    if (validationErrors.length > 0) {
      return errorResponse(validationErrors[0].message, 400, "VALIDATION_ERROR");
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
      return errorResponse("This entry is locked.", 403);
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

    const response = entryToApiResponse(
      persisted as Record<string, unknown>,
      category,
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Save failed");
  }
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
): Promise<NextResponse> {
  const csrfError = validateCsrf(request);
  if (csrfError) return errorResponse(csrfError, 403);

  const auth = await requireAuth();
  if (!auth) return errorResponse("Unauthorized", 401);

  try {
    let category: CategorySlug;
    try {
      category = validateCategory(categoryKey);
    } catch {
      return errorResponse("Invalid category", 400);
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
      return errorResponse("entry.id required", 400);
    }

    // Payload size check
    if (entryRecord) {
      assertEntryMutationInput(entryRecord, `update ${category}`);
    } else if (body.action) {
      assertActionPayload(body, `${action} payload`, SECURITY_LIMITS.actionPayloadMaxBytes);
    }

    // --- Action-based dispatch ---
    // Each action delegates to the corresponding engine function which handles
    // validation, WAL logging, index updates, streak logic, and telemetry.

    if (action === "request_edit") {
      const persisted = await requestEdit(
        auth.email,
        category as CategoryKey,
        entryId,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "request_delete") {
      const persisted = await requestDelete(
        auth.email,
        category as CategoryKey,
        entryId,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "cancel_request_edit") {
      const persisted = await cancelEditRequest(
        auth.email,
        category as CategoryKey,
        entryId,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "cancel_request_delete") {
      const persisted = await cancelDeleteRequest(
        auth.email,
        category as CategoryKey,
        entryId,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "generate") {
      const extraFields = entryRecord
        ? Object.fromEntries(
            Object.entries(entryRecord).filter(
              ([k]) => k !== "id" && k !== "ownerEmail" && k !== "category" && k !== "confirmationStatus",
            ),
          )
        : undefined;
      const persisted = await commitDraft(
        auth.email,
        category as CategoryKey,
        entryId,
        extraFields,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "finalise") {
      const persisted = await finalizeEntry(
        auth.email,
        category as CategoryKey,
        entryId,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    // --- Regular field update (action === "save" or default) ---

    if (!entryRecord) {
      return errorResponse("entry required", 400);
    }

    // Schema validation (update mode)
    const schema = getCategorySchema(category);
    const validationErrors = schema.validate(entryRecord, "update");
    if (validationErrors.length > 0) {
      return errorResponse(validationErrors[0].message, 400, "VALIDATION_ERROR");
    }

    // Pass incoming fields to engine — it handles merge, editability check,
    // PDF staleness, streak normalization, WAL logging, and index refresh.
    const persisted = await updateEntry(
      auth.email,
      category as CategoryKey,
      entryId,
      entryRecord as Record<string, unknown>,
    );

    return NextResponse.json(
      entryToApiResponse(persisted as Record<string, unknown>, category),
      { status: 200 },
    );
  } catch (error) {
    return mutationErrorResponse(error, "Save failed");
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete entry for category
// ---------------------------------------------------------------------------

export async function handleCategoryDelete(
  request: NextRequest | Request,
  categoryKey: string,
): Promise<NextResponse> {
  const csrfError = validateCsrf(request);
  if (csrfError) return errorResponse(csrfError, 403);

  const auth = await requireAuth();
  if (!auth) return errorResponse("Unauthorized", 401);

  try {
    let category: CategorySlug;
    try {
      category = validateCategory(categoryKey);
    } catch {
      return errorResponse("Invalid category", 400);
    }

    // Parse body
    const body = (await request.json()) as { id?: string };
    const id = String(body?.id ?? "").trim();
    if (!id) {
      return errorResponse("id required", 400);
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
      return errorResponse("This entry is locked.", 403);
    }

    // Delete via engine
    await deleteEngineEntry(auth.email, category as CategoryKey, id);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return mutationErrorResponse(error, "Delete failed");
  }
}
