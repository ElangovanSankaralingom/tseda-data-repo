import "server-only";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCategoryFlow, isValidCategorySlug } from "@/data/categoryRegistry";
import { recordEntryMilestones } from "@/lib/feed/feedEvents";
import { readCategoryEntryById } from "@/lib/dataStore";
import { AppError, normalizeError } from "@/lib/errors";
import { validatePreUploadFields } from "@/lib/categoryRequirements";
import { commitDraft, updateEntry } from "@/lib/entries/lifecycle";
import { computeEditWindowExpiry, normalizeEntryStatus } from "@/lib/entries/workflow";
import { ALLOWED_EMAIL_SUFFIX } from "@/lib/config/appConfig";
import { normalizeEmail } from "@/lib/facultyDirectory";
import { checkStreakEligibility } from "@/lib/streakProgress";
import { facultyCanMutate, resolveFacultyName } from "@/lib/admin/facultyRegistry";
import {
  getEditWindowDays,
  getStreakBufferDays,
  getPastEntryWindowDays,
  getPdfSignatoryName,
  getPdfSignatoryDesignation,
  isStreaksEnabled,
} from "@/lib/settings/consumer";
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
  if (!email.endsWith(ALLOWED_EMAIL_SUFFIX)) {
    return null;
  }
  return email;
}

type PdfPatchOptions = {
  editWindowDays: number;
  streakBufferDays: number;
  pastEntryWindowDays: number;
  streaksEnabled: boolean;
};

function buildPdfPatch(
  entry: Entry,
  category: CategoryKey,
  pdfMeta: Entry["pdfMeta"],
  opts: PdfPatchOptions,
) {
  // Streaks off → no new eligibility (existing counts are preserved elsewhere).
  const streakEligible = opts.streaksEnabled && checkStreakEligibility(entry);
  const nowISO = pdfMeta?.generatedAtISO ?? new Date().toISOString();

  const currentStatus = normalizeEntryStatus(entry);
  const newStatus = currentStatus === "DRAFT" ? "GENERATED" : currentStatus;

  const patch: Record<string, unknown> = {
    pdfMeta,
    pdfSourceHash: hashPrePdfFields(entry as Record<string, unknown>, category),
    pdfStale: false,
    pdfGenerated: true,
    pdfGeneratedAt: nowISO,
    streakEligible,
    confirmationStatus: newStatus,
  };

  // Set editWindowExpiresAt when transitioning DRAFT → GENERATED for the first time
  if (currentStatus === "DRAFT" && newStatus === "GENERATED") {
    patch.committedAtISO = nowISO;
    patch.editWindowExpiresAt = computeEditWindowExpiry(nowISO, {
      endDate: (entry as Record<string, unknown>).endDate,
      streakEligible,
    }, {
      editWindowDays: opts.editWindowDays,
      streakBufferDays: opts.streakBufferDays,
      pastEntryWindowDays: opts.pastEntryWindowDays,
    });
  }

  // Preserve existing editWindowExpiresAt if already GENERATED
  if (!patch.editWindowExpiresAt && (entry as Record<string, unknown>).editWindowExpiresAt) {
    patch.editWindowExpiresAt = (entry as Record<string, unknown>).editWindowExpiresAt;
  }

  return patch;
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

  // RECORD FLOW: "generate" means SUBMIT — commit the completed record (the
  // engine enforces that all fields AND proof uploads are present) and stop.
  // There is no permission-letter PDF in this flow.
  if (getCategoryFlow(args.category) === "record") {
    const submitted = await commitDraft(args.email, args.category, entryId);
    return { pdfMeta: null, entry: submitted };
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
  const [signatoryName, signatoryDesignation] = await Promise.all([
    getPdfSignatoryName(),
    getPdfSignatoryDesignation(),
  ]);
  const bytes = await generateEntryPdfBytes({
    categoryName: pdfData.categoryName,
    fields: pdfData.fields,
    facultyName: resolveFacultyName(args.email) || args.email,
    signatoryName,
    signatoryDesignation,
  });

  const pdfMeta = await storeEntryPdf({
    email: args.email,
    categoryFolder: args.category,
    entryId,
    fileNameBase: pdfData.fileNameBase,
    bytes,
  });

  const [editWindowDays, streakBufferDays, pastEntryWindowDays, streaksEnabled] =
    await Promise.all([
      getEditWindowDays(),
      getStreakBufferDays(),
      getPastEntryWindowDays(),
      isStreaksEnabled(),
    ]);

  const persisted = await updateEntry(
    args.email,
    args.category,
    entryId,
    buildPdfPatch(entry as Entry, args.category, pdfMeta, {
      editWindowDays,
      streakBufferDays,
      pastEntryWindowDays,
      streaksEnabled,
    })
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
    // LLP / read-only: a faculty on leave may view but not generate entries.
    if (!facultyCanMutate(email)) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Your account is read-only while on leave. You can view your entries but not change them.",
      });
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

    // Feed milestones at the moment they happen (idempotent by event id):
    // permission flow → streak_started on generate; record flow → the
    // submission IS the win, so streak_won fires right here — there is no
    // later save to catch it (the entry just locked).
    recordEntryMilestones(email, category as CategoryKey, result.entry as Record<string, unknown>);

    return Response.json(result, { status: 200 });
  } catch (error) {
    const appError = normalizeError(error);
    return Response.json(
      { error: appError.message, code: appError.code },
      { status: statusCodeFromError(appError) }
    );
  }
}
