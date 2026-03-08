import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isValidCategorySlug } from "@/data/categoryRegistry";
import { readCategoryEntryById } from "@/lib/dataStore";
import { AppError, normalizeError } from "@/lib/errors";
import { validatePreUploadFields } from "@/lib/categoryRequirements";
import { commitDraft, updateEntry } from "@/lib/entries/lifecycle";
import { normalizeEntryStatus } from "@/lib/entries/workflow";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { checkStreakEligibility } from "@/lib/streakProgress";
import { generateEntryPdfBytes, storeEntryPdf } from "@/lib/entry-pdf";
import { buildEntryPdfData } from "@/lib/pdf/buildPdfData";
import { hashPrePdfFields } from "@/lib/pdfSnapshot";
import {
  assertActionPayload,
  assertEntryMutationInput,
  SECURITY_LIMITS,
} from "@/lib/security/limits";
import {
  enforceRateLimitForRequest,
  RATE_LIMIT_PRESETS,
} from "@/lib/security/rateLimit";
import type { CategoryKey } from "@/lib/entries/types";
import type { Entry } from "@/lib/types/entry";

type GeneratePdfArgs = {
  email: string;
  category: CategoryKey;
  entryId: string;
};

type RunGenerateRequestArgs = {
  category: string;
  entryId: string;
  draft?: unknown;
};

function statusCodeFromError(error: AppError) {
  if (error.code === "UNAUTHORIZED") return 401;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "RATE_LIMITED") return 429;
  if (error.code === "PAYLOAD_TOO_LARGE") return 413;
  if (error.code === "VALIDATION_ERROR") return 400;
  return 500;
}

async function getAuthorizedTceEmail() {
  const session = await getServerSession(authOptions);
  const email = normalizeEmail(session?.user?.email ?? "");
  if (!email.endsWith("@tce.edu")) {
    return null;
  }
  return email;
}

function buildPdfPatch(entry: Entry, category: CategoryKey, pdfMeta: Entry["pdfMeta"]) {
  const streakEligible = checkStreakEligibility(entry);

  return {
    pdfMeta,
    pdfSourceHash: hashPrePdfFields(entry as Record<string, unknown>, category),
    pdfStale: false,
    pdfGenerated: true,
    pdfGeneratedAt: pdfMeta?.generatedAtISO ?? new Date().toISOString(),
    streakEligible,
  };
}

export async function generateAndPersistEntryPdf(args: GeneratePdfArgs) {
  const entryId = String(args.entryId ?? "").trim();
  if (!entryId) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "id required" });
  }

  let entry = await readCategoryEntryById(args.email, args.category, entryId);
  if (!entry) {
    throw new AppError({ code: "NOT_FOUND", message: "Entry not found" });
  }
  if (!validatePreUploadFields(args.category, entry as Record<string, unknown>)) {
    throw new AppError({
      code: "VALIDATION_ERROR",
      message: "Complete all required fields before generating the entry.",
    });
  }

  // Auto-transition DRAFT → GENERATED when generating PDF
  const currentStatus = normalizeEntryStatus(entry as Entry);
  if (currentStatus === "DRAFT") {
    entry = await commitDraft(args.email, args.category, entryId);
  }

  const pdfData = buildEntryPdfData(args.category, entry as Entry);
  const bytes = await generateEntryPdfBytes({
    categoryName: pdfData.categoryName,
    fields: pdfData.fields,
  });

  const pdfMeta = await storeEntryPdf({
    email: args.email,
    categoryFolder: args.category,
    entryId,
    fileNameBase: pdfData.fileNameBase,
    bytes,
  });

  const persisted = await updateEntry(
    args.email,
    args.category,
    entryId,
    buildPdfPatch(entry as Entry, args.category, pdfMeta)
  );

  return { pdfMeta, entry: persisted };
}

export async function runGeneratePdfRequest(
  request: Request,
  args: RunGenerateRequestArgs
) {
  try {
    assertActionPayload(
      args,
      "generate request",
      SECURITY_LIMITS.entryPayloadMaxBytes + SECURITY_LIMITS.actionPayloadMaxBytes
    );

    const email = await getAuthorizedTceEmail();
    if (!email) {
      throw new AppError({ code: "UNAUTHORIZED", message: "Unauthorized" });
    }

    const category = String(args.category ?? "").trim();
    if (!isValidCategorySlug(category)) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "Unsupported category" });
    }
    const requestedEntryId = String(args.entryId ?? "").trim();

    enforceRateLimitForRequest({
      request,
      userEmail: email,
      action: `entry.generate.${category}`,
      options: RATE_LIMIT_PRESETS.entryMutations,
    });

    const draftRecord =
      args.draft && typeof args.draft === "object"
        ? (args.draft as Record<string, unknown>)
        : null;
    const draftId = draftRecord ? String(draftRecord.id ?? "").trim() : "";
    const entryId = requestedEntryId || draftId;
    if (!entryId) {
      throw new AppError({ code: "VALIDATION_ERROR", message: "id required" });
    }
    if (draftRecord) {
      assertEntryMutationInput(draftRecord, "generate draft");
      if (requestedEntryId && draftId && draftId !== requestedEntryId) {
        throw new AppError({
          code: "VALIDATION_ERROR",
          message: "Draft id does not match the target entry id.",
        });
      }
      await updateEntry(email, category, entryId, draftRecord);
    }

    const result = await generateAndPersistEntryPdf({
      email,
      category,
      entryId,
    });

    return Response.json(result, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    return Response.json(
      { error: appError.message, code: appError.code },
      { status: statusCodeFromError(appError) }
    );
  }
}
