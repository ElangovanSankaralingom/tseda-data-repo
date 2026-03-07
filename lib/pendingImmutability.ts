import { ENTRY_SCHEMAS } from "@/data/schemas";
import { isEntryFinalized, normalizeEntryStatus, type EntryStateLike } from "@/lib/entries/stateMachine";
import type { CategoryKey } from "@/lib/entries/types";

type PendingEntryLike = EntryStateLike & Record<string, unknown>;

const DEFAULT_MUTABLE_WHEN_PENDING = new Set([
  "id",
  "status",
  "confirmationStatus",
  "requestEditStatus",
  "requestEditRequestedAtISO",
  "requestEditMessage",
  "createdAt",
  "updatedAt",
  "pdfMeta",
  "pdfSourceHash",
  "pdfStale",
  "streak",
  "attachments",
  "uploads",
  "permissionLetter",
  "completionCertificate",
  "travelPlan",
  "geotaggedPhotos",
  "brochure",
  "attendance",
  "speakerProfile",
  "organiserProfile",
  "notes",
  "remarks",
  "editWindowExpiresAt",
  "editRequestedAt",
  "editRequestMessage",
  "editGrantedAt",
  "editGrantedBy",
]);

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

export function getImmutableFieldKeysWhenPending(category: CategoryKey): string[] {
  const schema = ENTRY_SCHEMAS[category];
  if (Array.isArray(schema.immutableWhenPending) && schema.immutableWhenPending.length > 0) {
    return [...new Set(schema.immutableWhenPending.map((value) => String(value).trim()).filter(Boolean))];
  }

  return schema.fields
    .map((field) => field.key)
    .filter((fieldKey) => !DEFAULT_MUTABLE_WHEN_PENDING.has(fieldKey));
}

export function canEditField(entry: EntryStateLike, category: CategoryKey, fieldKey: string): boolean {
  if (isEntryFinalized(entry)) return false;
  const status = normalizeEntryStatus(entry);
  // EDIT_REQUESTED entries are not editable (waiting for admin grant)
  if (status === "EDIT_REQUESTED") return false;
  return true;
}

export function getChangedImmutableFieldsWhenPending(
  category: CategoryKey,
  beforeEntry: PendingEntryLike,
  afterEntry: PendingEntryLike
): string[] {
  // In the new workflow, immutability is enforced when finalized (edit window expired)
  if (!isEntryFinalized(beforeEntry)) {
    return [];
  }

  const immutableFieldKeys = getImmutableFieldKeysWhenPending(category);
  const changed = new Array<string>();

  for (const fieldKey of immutableFieldKeys) {
    const beforeValue = beforeEntry[fieldKey];
    const afterValue = afterEntry[fieldKey];
    if (stableStringify(beforeValue) !== stableStringify(afterValue)) {
      changed.push(fieldKey);
    }
  }

  return changed;
}

export function hasPendingImmutableFieldChanges(
  category: CategoryKey,
  beforeEntry: PendingEntryLike,
  afterEntry: PendingEntryLike
): boolean {
  return getChangedImmutableFieldsWhenPending(category, beforeEntry, afterEntry).length > 0;
}
