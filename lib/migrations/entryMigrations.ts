import "server-only";
import { getCategorySchema, isValidCategorySlug } from "@/data/categoryRegistry";
import { normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import { normalizeEntry as normalizeEntryRecord } from "@/lib/normalize";
import { AppError, normalizeError } from "@/lib/errors";
import { err, ok, type Result } from "@/lib/result";
import { type Entry } from "@/lib/types/entry";
import {
  ENTRY_SCHEMA_VERSION,
  isRecord,
  toTrimmedString,
  toISO,
  runRecordMigrations,
} from "./migrationHelpers";

type LegacyWorkflowCompatibilityStatus =
  | "draft"
  | "final"
  | "completed"
  | "pending"
  | "pending_confirmation"
  | "approved"
  | "rejected";

function getLegacyWorkflowCompatibilityStatus(value: unknown): LegacyWorkflowCompatibilityStatus | null {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "draft") return "draft";
  if (normalized === "final") return "final";
  if (normalized === "completed") return "completed";
  if (normalized === "pending") return "pending";
  if (normalized === "pending_confirmation") return "pending_confirmation";
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return null;
}

export function applyLegacyWorkflowStatusCompatibility(record: Record<string, unknown>, nowISO: string) {
  const currentConfirmationStatus = toTrimmedString(record.confirmationStatus);
  if (
    currentConfirmationStatus === "DRAFT" ||
    currentConfirmationStatus === "GENERATED" ||
    currentConfirmationStatus === "EDIT_REQUESTED" ||
    currentConfirmationStatus === "DELETE_REQUESTED" ||
    currentConfirmationStatus === "EDIT_GRANTED" ||
    currentConfirmationStatus === "ARCHIVED"
  ) {
    stripLegacyWorkflowStatus(record);
    return;
  }

  const legacyConfirmationStatus = getLegacyWorkflowCompatibilityStatus(record.confirmationStatus);
  const legacyStatus = getLegacyWorkflowCompatibilityStatus(record.status);
  const workflowStatus = legacyConfirmationStatus ?? legacyStatus;

  if (!workflowStatus) {
    stripLegacyWorkflowStatus(record);
    return;
  }

  if (
    (workflowStatus === "final" || workflowStatus === "completed") &&
    !toTrimmedString(record.committedAtISO)
  ) {
    record.committedAtISO = toISO(record.updatedAt, nowISO);
  }

  if (workflowStatus === "draft" || workflowStatus === "final" || workflowStatus === "completed") {
    record.confirmationStatus = "DRAFT";
  } else if (workflowStatus === "pending" || workflowStatus === "pending_confirmation") {
    record.confirmationStatus = "GENERATED";
  } else if (workflowStatus === "approved") {
    record.confirmationStatus = "GENERATED";
  } else {
    record.confirmationStatus = "GENERATED";
  }

  stripLegacyWorkflowStatus(record);
}

export function stripLegacyWorkflowStatus(record: Record<string, unknown>) {
  const normalized = toTrimmedString(record.status).toLowerCase();
  if (
    normalized === "draft" ||
    normalized === "final" ||
    normalized === "completed" ||
    normalized === "pending" ||
    normalized === "pending_confirmation" ||
    normalized === "approved" ||
    normalized === "rejected"
  ) {
    delete record.status;
  }
}

function normalizeLegacyFinalization(record: Record<string, unknown>, nowISO: string) {
  const finalizedFlags = [
    record.finalised,
    record.finalized,
    record.isFinalized,
    record.isFinalised,
  ];
  const isLegacyFinalized = finalizedFlags.some((value) => value === true);

  if (isLegacyFinalized && !toTrimmedString(record.committedAtISO)) {
    record.committedAtISO = toISO(record.updatedAt, nowISO);
  }

  if (isLegacyFinalized) {
    const status = normalizeEntryStatus(record as EntryStateLike);
    if (status === "DRAFT") {
      record.confirmationStatus = "GENERATED";
    }
  }
}

function migrateEntryV0ToV1(raw: Record<string, unknown>, nowISO: string) {
  const next = { ...raw };

  applyLegacyWorkflowStatusCompatibility(next, nowISO);
  normalizeLegacyFinalization(next, nowISO);
  next.confirmationStatus = normalizeEntryStatus(next as EntryStateLike);
  stripLegacyWorkflowStatus(next);

  if (!Array.isArray(next.attachments)) {
    next.attachments = [];
  }

  const createdAt = toISO(next.createdAt, nowISO);
  const updatedAt = toISO(next.updatedAt, createdAt);
  next.createdAt = createdAt;
  next.updatedAt = updatedAt;

  next.schemaVersion = ENTRY_SCHEMA_VERSION;
  return next;
}

export function migrateEntry(raw: unknown): Result<Entry> {
  try {
    if (!isRecord(raw)) {
      throw new AppError({
        code: "VALIDATION_ERROR",
        message: "Invalid entry payload",
      });
    }

    const nowISO = new Date().toISOString();
    const rawVersion = (typeof raw.schemaVersion === "number" ? raw.schemaVersion : typeof raw.v === "number" ? raw.v : 0);
    const migrated = runRecordMigrations(
      raw,
      rawVersion <= 0 ? 0 : Math.floor(rawVersion),
      ENTRY_SCHEMA_VERSION,
      {
        0: migrateEntryV0ToV1,
      },
      nowISO
    );

    const categorySlug = toTrimmedString(migrated.category).toLowerCase();
    const normalized = normalizeEntryRecord(
      migrated as Entry,
      isValidCategorySlug(categorySlug) ? getCategorySchema(categorySlug) : undefined
    ) as Record<string, unknown>;

    applyLegacyWorkflowStatusCompatibility(
      normalized,
      toISO(normalized.updatedAt, toISO(normalized.createdAt, nowISO))
    );
    normalized.confirmationStatus = normalizeEntryStatus(normalized as EntryStateLike);
    stripLegacyWorkflowStatus(normalized);
    if (!Array.isArray(normalized.attachments)) {
      normalized.attachments = [];
    }
    normalized.createdAt = toISO(normalized.createdAt, nowISO);
    normalized.updatedAt = toISO(normalized.updatedAt, toISO(normalized.createdAt, nowISO));
    normalized.schemaVersion = ENTRY_SCHEMA_VERSION;

    return ok(normalized as Entry);
  } catch (error) {
    return err(normalizeError(error));
  }
}
