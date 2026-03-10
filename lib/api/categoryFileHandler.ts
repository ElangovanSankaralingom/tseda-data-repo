import "server-only";

/**
 * Unified file upload/delete handler for all category entry routes.
 *
 * Each category route at `app/api/me/<category>/file/route.ts` is a thin
 * wrapper that delegates to these handlers. This module owns:
 * - Auth checks (session-based)
 * - Category + slot validation
 * - File storage (public/uploads/)
 * - Entry update after upload/delete
 * - Rate limiting and security assertions
 *
 * Upload slots are defined per-category. Some categories (workshops,
 * guest-lectures) nest uploads inside an `uploads` object on the entry;
 * others store them as top-level fields.
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isValidCategorySlug, type CategorySlug } from "@/data/categoryRegistry";
import { readCategoryEntryById, upsertCategoryEntry } from "@/lib/dataStore";
import { normalizeError } from "@/lib/errors";
import { isEntryEditable } from "@/lib/entries/lock";
import { assertUploadMetadataInput } from "@/lib/security/limits";
import { enforceRateLimitForRequest, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { safeEmailDir } from "@/lib/userStore";
import { validateCsrf } from "@/lib/security/csrf";
import { validateUploadedFile, sanitizeFilename } from "@/lib/security/fileValidation";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";

// ── Constants ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_BYTES = 20 * 1024 * 1024;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

// ── Per-category upload slot configuration ───────────────────────────────────
//
// Each entry lists allowed slot names and whether the slot stores an array
// (e.g. geotaggedPhotos) or a single object (e.g. permissionLetter).
// `nested` means uploads are stored under `entry.uploads.{slot}` rather
// than `entry.{slot}`.

type SlotConfig = {
  slots: ReadonlySet<string>;
  arraySlots: ReadonlySet<string>;
  nested: boolean;
};

const CATEGORY_UPLOAD_CONFIG: Record<CategorySlug, SlotConfig> = {
  "fdp-attended": {
    slots: new Set(["permissionLetter", "completionCertificate"]),
    arraySlots: new Set(),
    nested: false,
  },
  "fdp-conducted": {
    slots: new Set(["permissionLetter", "geotaggedPhotos"]),
    arraySlots: new Set(["geotaggedPhotos"]),
    nested: false,
  },
  "case-studies": {
    slots: new Set(["permissionLetter", "travelPlan", "geotaggedPhotos"]),
    arraySlots: new Set(["geotaggedPhotos"]),
    nested: false,
  },
  "guest-lectures": {
    slots: new Set(["permissionLetter", "brochure", "attendance", "speakerProfile", "geotaggedPhotos"]),
    arraySlots: new Set(["geotaggedPhotos"]),
    nested: true,
  },
  workshops: {
    slots: new Set(["permissionLetter", "brochure", "attendance", "organiserProfile", "geotaggedPhotos"]),
    arraySlots: new Set(["geotaggedPhotos"]),
    nested: true,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function safeSegment(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, "_");
}

async function getAuthorizedEmail() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? "";
  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) return null;
  return email;
}

function normalizeStoredPath(storedPath: string) {
  const normalized = path.posix.normalize(storedPath).replace(/^\/+/, "");
  if (!normalized || normalized.startsWith("..") || normalized.includes("../")) {
    throw new Error("Invalid storedPath");
  }
  return normalized;
}

function parseStoredPathParts(storedPath: string, category: string) {
  const normalized = normalizeStoredPath(storedPath);
  const parts = normalized.split("/");

  // Expected: uploads/<email>/<category>/<recordId>/<slot>/<fileName>
  if (parts.length < 6) return null;
  if (parts[0] !== "uploads" || parts[2] !== category) return null;

  return { recordId: parts[3], slot: parts[4] };
}

function buildStoredPath(
  email: string,
  category: string,
  recordId: string,
  slot: string,
  fileName: string,
) {
  const relDir = path.posix.join(
    "uploads",
    safeEmailDir(email),
    category,
    safeSegment(recordId),
    slot,
  );
  const stampedFileName = `${Date.now()}_${randomUUID()}_${safeName(fileName)}`;
  return path.posix.join(relDir, stampedFileName);
}

function handleErrorResponse(error: unknown) {
  const appError = normalizeError(error);
  if (appError.code === "RATE_LIMITED") {
    return NextResponse.json({ error: appError.message, code: appError.code }, { status: 429 });
  }
  if (appError.code === "PAYLOAD_TOO_LARGE") {
    return NextResponse.json({ error: appError.message, code: appError.code }, { status: 413 });
  }
  if (appError.code === "VALIDATION_ERROR") {
    return NextResponse.json({ error: appError.message, code: appError.code }, { status: 400 });
  }
  const message = appError.message || "Operation failed.";
  return NextResponse.json({ error: message }, { status: message === "Forbidden" ? 403 : 500 });
}

// ── POST handler ─────────────────────────────────────────────────────────────

export async function handleCategoryFilePost(request: Request, category: CategorySlug) {
  const csrfError = validateCsrf(request);
  if (csrfError) return NextResponse.json({ error: csrfError }, { status: 403 });

  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidCategorySlug(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const config = CATEGORY_UPLOAD_CONFIG[category];

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: `upload.${category}.post`,
      options: RATE_LIMIT_PRESETS.uploadOps,
    });

    const form = await request.formData();
    const recordId = String(form.get("recordId") ?? "").trim();
    const slot = String(form.get("slot") ?? "").trim();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    assertUploadMetadataInput(
      { recordId, slot, fileName: file.name, mimeType: file.type, size: file.size },
      `${category} upload request`,
    );

    if (!recordId) {
      return NextResponse.json({ error: "recordId required" }, { status: 400 });
    }

    // Verify entry exists and has a generated PDF
    const existing = await readCategoryEntryById(email, category, recordId);
    if (!existing) {
      return NextResponse.json({ error: "Generate the entry first." }, { status: 400 });
    }
    const pdfMeta = existing.pdfMeta as { storedPath?: string | null; url?: string | null } | null | undefined;
    if (!pdfMeta?.storedPath || !pdfMeta?.url) {
      return NextResponse.json({ error: "Generate the entry first." }, { status: 400 });
    }
    if (!isEntryEditable(existing)) {
      return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
    }

    if (!config.slots.has(slot)) {
      return NextResponse.json({ error: "invalid slot" }, { status: 400 });
    }

    // Full file validation: size, MIME type, and magic bytes
    const fileBuffer = await file.arrayBuffer();
    const fileCheck = validateUploadedFile(
      { size: file.size, type: file.type, name: file.name },
      fileBuffer,
    );
    if (!fileCheck.valid) {
      return NextResponse.json({ error: fileCheck.error }, { status: 400 });
    }

    const sanitizedName = sanitizeFilename(file.name);
    const storedPath = buildStoredPath(email, category, recordId, slot, sanitizedName);
    const absPath = path.join(process.cwd(), "public", storedPath);

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, Buffer.from(fileBuffer));

    return NextResponse.json({
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      url: `/${storedPath}`,
      storedPath,
    });
  } catch (error) {
    return handleErrorResponse(error);
  }
}

// ── DELETE handler ───────────────────────────────────────────────────────────

export async function handleCategoryFileDelete(request: Request, category: CategorySlug) {
  const csrfError = validateCsrf(request);
  if (csrfError) return NextResponse.json({ error: csrfError }, { status: 403 });

  const email = await getAuthorizedEmail();
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isValidCategorySlug(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const config = CATEGORY_UPLOAD_CONFIG[category];

  try {
    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: `upload.${category}.delete`,
      options: RATE_LIMIT_PRESETS.uploadOps,
    });

    const body = (await request.json()) as { storedPath?: string };
    assertUploadMetadataInput(
      { storedPath: body?.storedPath ?? "" },
      `${category} upload delete request`,
    );

    const storedPath = normalizeStoredPath(String(body?.storedPath ?? "").trim());
    const ownerPrefix = path.posix.join("uploads", safeEmailDir(email), category) + "/";

    if (!storedPath.startsWith(ownerPrefix)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check entry lock status
    const parsed = parseStoredPathParts(storedPath, category);
    if (parsed?.recordId) {
      const existing = await readCategoryEntryById(email, category, parsed.recordId);
      if (existing && !isEntryEditable(existing)) {
        return NextResponse.json({ error: "This entry is locked." }, { status: 403 });
      }
    }

    // Delete the file
    await fs.unlink(path.join(process.cwd(), "public", storedPath)).catch(() => null);

    // Update entry to clear the slot
    if (parsed?.recordId && parsed.slot && config.slots.has(parsed.slot)) {
      const existing = await readCategoryEntryById(email, category, parsed.recordId);
      if (existing) {
        const resetValue = config.arraySlots.has(parsed.slot) ? [] : null;
        const nowISO = new Date().toISOString();

        if (config.nested) {
          // Nested: entry.uploads.{slot}
          const currentUploads =
            existing.uploads && typeof existing.uploads === "object"
              ? { ...(existing.uploads as Record<string, unknown>) }
              : {};
          currentUploads[parsed.slot] = resetValue;
          await upsertCategoryEntry(email, category, {
            ...existing,
            uploads: currentUploads,
            updatedAt: nowISO,
          });
        } else {
          // Top-level: entry.{slot}
          await upsertCategoryEntry(email, category, {
            ...existing,
            [parsed.slot]: resetValue,
            updatedAt: nowISO,
          });
        }
      }
    }

    return NextResponse.json({ ok: true, storedPath });
  } catch (error) {
    return handleErrorResponse(error);
  }
}
