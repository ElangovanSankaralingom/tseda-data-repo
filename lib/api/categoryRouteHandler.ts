import "server-only";

import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  createEntry,
  deleteEntry as deleteEngineEntry,
  listEntriesForCategory,
  updateEntry,
} from "@/lib/entries/lifecycle";
import { isValidCategorySlug, getCategorySchema, type CategorySlug } from "@/data/categoryRegistry";
import { entryToApiResponse, entriesToApiResponse } from "@/lib/entries/toApiResponse";
import { normalizeEntryStreakFields } from "@/lib/entries/postSave";
import { normalizeError } from "@/lib/errors";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { assertEntryMutationInput, assertActionPayload, SECURITY_LIMITS } from "@/lib/security/limits";
import { isEntryEditable } from "@/lib/entries/lock";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";
import type { PdfSnapshotCategory } from "@/lib/pdfSnapshot";
import {
  normalizeEntryStatus,
  isEntryCommitted,
  isEntryFinalized,
  transitionEntry,
  type EntryStateLike,
  type EntryTransitionAction,
} from "@/lib/entries/workflow";
import type { CategoryKey } from "@/lib/entries/types";

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

function normalizeEntry(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return normalizeEntryStreakFields(record);
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

  const entries = await listEntriesForCategory(
    auth.email,
    category as CategoryKey,
    (val) => normalizeEntry(val),
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

    // Normalize streak fields before persist
    normalizeEntryStreakFields(entryData);

    // Persist
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

    // Load existing entry
    const existingEntries = await listEntriesForCategory(
      auth.email,
      category as CategoryKey,
    );
    const existing = existingEntries.find(
      (e) => String((e as Record<string, unknown>).id ?? "") === entryId,
    ) ?? null;

    if (!existing) {
      return errorResponse("Entry not found", 404);
    }

    const existingRecord = existing as Record<string, unknown>;
    const existingStatus = normalizeEntryStatus(existingRecord as EntryStateLike);
    const now = new Date().toISOString();

    // --- Action-based dispatch ---

    if (action === "request_edit") {
      if (!isEntryCommitted(existingRecord as EntryStateLike)) {
        return errorResponse("Request edit is allowed only for completed entries.", 400);
      }
      const updated = transitionEntry(
        existingRecord as EntryStateLike,
        "requestEdit",
        { nowISO: now },
      );
      const persisted = await updateEntry(
        auth.email,
        category as CategoryKey,
        entryId,
        updated as Record<string, unknown>,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "request_delete") {
      if (!isEntryCommitted(existingRecord as EntryStateLike)) {
        return errorResponse("Request delete is allowed only for completed entries.", 400);
      }
      const updated = transitionEntry(
        existingRecord as EntryStateLike,
        "requestDelete",
        { nowISO: now },
      );
      const persisted = await updateEntry(
        auth.email,
        category as CategoryKey,
        entryId,
        updated as Record<string, unknown>,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "cancel_request_edit") {
      if (existingStatus !== "EDIT_REQUESTED") {
        return NextResponse.json(
          entryToApiResponse(existingRecord, category),
          { status: 200 },
        );
      }
      const updated = transitionEntry(
        existingRecord as EntryStateLike,
        "cancelEditRequest",
        { nowISO: now },
      );
      const persisted = await updateEntry(
        auth.email,
        category as CategoryKey,
        entryId,
        updated as Record<string, unknown>,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "cancel_request_delete") {
      if (existingStatus !== "DELETE_REQUESTED") {
        return NextResponse.json(
          entryToApiResponse(existingRecord, category),
          { status: 200 },
        );
      }
      const updated = transitionEntry(
        existingRecord as EntryStateLike,
        "cancelDeleteRequest",
        { nowISO: now },
      );
      const persisted = await updateEntry(
        auth.email,
        category as CategoryKey,
        entryId,
        updated as Record<string, unknown>,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "generate") {
      if (existingStatus !== "DRAFT" && existingStatus !== "EDIT_GRANTED") {
        return errorResponse("Entry cannot be generated from its current status.", 400);
      }
      const transitionAction: EntryTransitionAction =
        existingStatus === "EDIT_GRANTED" ? "generateEntry" : "generateEntry";
      const updated = transitionEntry(
        existingRecord as EntryStateLike,
        transitionAction,
        { nowISO: now },
      );
      // Merge any incoming fields (e.g., PDF data sent along with generate)
      const merged: Record<string, unknown> = {
        ...(updated as Record<string, unknown>),
        ...(entryRecord ?? {}),
        confirmationStatus: (updated as EntryStateLike).confirmationStatus,
        updatedAt: now,
      };
      normalizeEntryStreakFields(merged);
      const persisted = await updateEntry(
        auth.email,
        category as CategoryKey,
        entryId,
        merged,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    if (action === "finalise") {
      if (isEntryFinalized(existingRecord as EntryStateLike)) {
        return NextResponse.json(
          entryToApiResponse(existingRecord, category),
          { status: 200 },
        );
      }
      // Finalise = set editWindowExpiresAt to now (forces finalization)
      const updated: Record<string, unknown> = {
        ...existingRecord,
        editWindowExpiresAt: now,
        updatedAt: now,
      };
      normalizeEntryStreakFields(updated);
      const persisted = await updateEntry(
        auth.email,
        category as CategoryKey,
        entryId,
        updated,
      );
      return NextResponse.json(
        entryToApiResponse(persisted as Record<string, unknown>, category),
        { status: 200 },
      );
    }

    // --- Regular field update (action === "save" or default) ---

    if (!isEntryEditable(existing)) {
      return errorResponse("This entry is locked.", 403);
    }

    if (!entryRecord) {
      return errorResponse("entry required", 400);
    }

    // Schema validation (update mode)
    const schema = getCategorySchema(category);
    const validationErrors = schema.validate(entryRecord, "update");
    if (validationErrors.length > 0) {
      return errorResponse(validationErrors[0].message, 400, "VALIDATION_ERROR");
    }

    // Merge incoming fields into existing entry
    const merged: Record<string, unknown> = {
      ...existingRecord,
    };

    // Apply each field from the incoming record
    for (const [key, value] of Object.entries(entryRecord)) {
      // Don't allow overwriting lifecycle fields from client
      if (key === "id" || key === "ownerEmail" || key === "category") continue;
      merged[key] = value;
    }

    merged.updatedAt = now;
    merged.createdAt = existingRecord.createdAt ?? now;

    // Recompute PDF staleness after field merge
    if (merged.pdfMeta && merged.pdfSourceHash) {
      merged.pdfStale =
        hashPrePdfFields(merged, category as PdfSnapshotCategory) !==
        String(merged.pdfSourceHash);
    }

    // Normalize streak fields
    normalizeEntryStreakFields(merged);

    // Persist
    const persisted = await updateEntry(
      auth.email,
      category as CategoryKey,
      entryId,
      merged,
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
