import "server-only";

import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  createEntry,
  listEntriesForCategory,
  updateEntry,
} from "@/lib/entries/lifecycle";
import { isValidCategorySlug, getCategorySchema, type CategorySlug } from "@/data/categoryRegistry";
import { entryToApiResponse, entriesToApiResponse } from "@/lib/entries/toApiResponse";
import { normalizeEntryStreakFields } from "@/lib/entries/postSave";
import { normalizeError } from "@/lib/errors";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { assertEntryMutationInput } from "@/lib/security/limits";
import { isEntryEditable } from "@/lib/entries/lock";
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
